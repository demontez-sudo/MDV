const EMAIL_RX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_ENDPOINT = 'https://api.resend.com/emails';

function clean(value) { return String(value ?? '').trim(); }
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

export function emailDeliveryStatus({ senderEmail } = {}) {
  const apiKey = clean(process.env.RESEND_API_KEY);
  const sender = clean(senderEmail || process.env.VEUX_DEFAULT_SENDER_EMAIL).toLowerCase();
  const missing = [];
  if (!apiKey) missing.push('RESEND_API_KEY');
  if (sender && !EMAIL_RX.test(sender)) missing.push('VALID_SENDER_EMAIL');
  return {
    provider: 'resend',
    configured: Boolean(apiKey),
    sender_email: sender || null,
    sender_valid: !sender || EMAIL_RX.test(sender),
    missing,
    code: !apiKey ? 'RESEND_API_KEY_MISSING' : (sender && !EMAIL_RX.test(sender) ? 'EMAIL_SENDER_INVALID' : 'READY')
  };
}

export function requireEmailDelivery({ senderEmail } = {}) {
  const status = emailDeliveryStatus({ senderEmail });
  if (!status.configured) {
    const error = new Error('Email delivery is temporarily unavailable because the Resend runtime key is not configured.');
    error.statusCode = 503;
    error.code = 'EMAIL_PROVIDER_NOT_CONFIGURED';
    error.publicMessage = 'Email delivery is temporarily unavailable. Resend is not configured for this deployment.';
    error.delivery = status;
    throw error;
  }
  if (senderEmail && !EMAIL_RX.test(clean(senderEmail))) {
    const error = new Error('The configured sender email is invalid.');
    error.statusCode = 422;
    error.code = 'EMAIL_SENDER_INVALID';
    error.publicMessage = 'Email delivery is not ready because the sender email is invalid.';
    error.delivery = status;
    throw error;
  }
  return status;
}

function providerError(status, body, requestId) {
  const message = clean(body?.message || body?.name || body?.error || 'Resend request failed');
  const error = new Error(`Resend ${status}: ${message}`);
  error.statusCode = status === 429 ? 503 : (status >= 500 ? 502 : 502);
  error.code = body?.name || body?.code || `RESEND_${status}`;
  error.provider = 'resend';
  error.providerStatus = status;
  error.providerRequestId = requestId || null;
  error.publicMessage = status === 429
    ? 'Email delivery is temporarily rate limited. Please retry shortly.'
    : status === 401 || status === 403
      ? 'Email delivery could not authenticate with Resend. Check the deployment email configuration.'
      : 'Email delivery failed at the email provider. The record was not marked sent.';
  return error;
}

export async function sendResendEmail(message) {
  const fromEmail = clean(message.from_email).toLowerCase();
  requireEmailDelivery({ senderEmail: fromEmail });
  if (!EMAIL_RX.test(fromEmail)) {
    const error = new Error('A valid sender email is required.');
    error.statusCode = 422;
    error.code = 'EMAIL_SENDER_INVALID';
    error.publicMessage = 'Email delivery is not ready because the sender email is invalid.';
    throw error;
  }

  const apiKey = clean(process.env.RESEND_API_KEY);
  const payload = {
    from: message.from_name ? `${clean(message.from_name)} <${fromEmail}>` : fromEmail,
    to: Array.isArray(message.to_emails) ? message.to_emails : [],
    subject: clean(message.subject)
  };
  if (message.reply_to) payload.reply_to = clean(message.reply_to);
  if (message.cc_emails?.length) payload.cc = message.cc_emails;
  if (message.bcc_emails?.length) payload.bcc = message.bcc_emails;
  if (message.html_body) payload.html = message.html_body;
  if (message.text_body) payload.text = message.text_body;

  // Resend idempotency belongs on the API request header, not inside the email headers payload.
  const requestHeaders = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json'
  };
  if (message.idempotency_key) requestHeaders['Idempotency-Key'] = clean(message.idempotency_key).slice(0, 256);

  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: 'POST',
        headers: requestHeaders,
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const text = await res.text();
      let body = {};
      try { body = text ? JSON.parse(text) : {}; } catch { body = { message: text }; }
      if (res.ok) return { provider: 'resend', providerMessageId: body.id, raw: body };

      const requestId = res.headers.get('x-request-id') || res.headers.get('request-id');
      const error = providerError(res.status, body, requestId);
      lastError = error;
      if (!(res.status === 429 || res.status >= 500) || attempt === 2) throw error;
      const retryAfter = Number(res.headers.get('retry-after'));
      await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.min(retryAfter * 1000, 2500) : (300 + attempt * 500));
    } catch (error) {
      if (error?.name === 'AbortError') {
        const timeoutError = new Error('Resend request timed out');
        timeoutError.statusCode = 502;
        timeoutError.code = 'RESEND_TIMEOUT';
        timeoutError.provider = 'resend';
        timeoutError.publicMessage = 'Email delivery timed out at the email provider. Please retry.';
        lastError = timeoutError;
        if (attempt === 2) throw timeoutError;
        await sleep(300 + attempt * 500);
      } else if (error?.provider === 'resend') {
        throw error;
      } else {
        lastError = error;
        if (attempt === 2) throw error;
        await sleep(300 + attempt * 500);
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw lastError || new Error('Email delivery failed');
}

export async function deliverEmailMessage(admin, emailMessageId) {
  const { data: message, error } = await admin.from('email_messages').select('*').eq('id', emailMessageId).single();
  if (error) throw error;
  if (['sent','delivered','opened','clicked'].includes(message.status)) return message;
  if (message.scheduled_at && new Date(message.scheduled_at).getTime() > Date.now()) return message;

  const { data: processing, error: processingError } = await admin.from('email_messages').update({ status: 'processing', last_error: null, updated_at: new Date().toISOString() }).eq('id', message.id).select('id,status').single();
  if (processingError) throw processingError;
  if (processing?.status !== 'processing') throw new Error('Email delivery state could not be verified before provider send');
  try {
    const result = await sendResendEmail(message);
    const { data, error: updateError } = await admin.from('email_messages').update({
      status: 'sent', provider: result.provider, provider_message_id: result.providerMessageId, sent_at: new Date().toISOString(), failed_at: null, last_error: null
    }).eq('id', message.id).select('*').single();
    if (updateError) throw updateError;
    return data;
  } catch (error2) {
    const failedAt = new Date().toISOString();
    const { data: failedState, error: failedStateError } = await admin.from('email_messages').update({
      status: 'failed', failed_at: failedAt,
      last_error: String(error2.publicMessage || error2.message || error2).slice(0,2000),
      metadata: { ...(message.metadata || {}), delivery_error_code: error2.code || null, delivery_provider: error2.provider || 'resend' },
      updated_at: failedAt
    }).eq('id', message.id).select('id,status').single();
    if (failedStateError || failedState?.status !== 'failed') {
      const stateError = new Error(`Email provider failed and VEUX could not persist failed delivery state: ${failedStateError?.message || 'unknown state error'}`);
      stateError.cause = error2;
      throw stateError;
    }
    throw error2;
  }
}
