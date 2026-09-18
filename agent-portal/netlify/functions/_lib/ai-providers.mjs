const DEFAULT_OPENAI_MODEL = 'gpt-5.6';
const DEFAULT_ANTHROPIC_MODEL = 'claude-sonnet-4-20250514';
const DEFAULT_ANTHROPIC_FALLBACK_MODEL = 'claude-3-5-haiku-20241022';

function clean(value) {
  const v = String(value || '').trim();
  if (!v) return '';
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1).trim();
  return v;
}

function key(name) { return clean(process.env[name]); }
function providerTimeoutMs() {
  const raw = Number(process.env.VEUX_AI_TIMEOUT_MS || 12000);
  return Number.isFinite(raw) ? Math.min(25000, Math.max(3000, raw)) : 12000;
}
async function timedFetch(url, options, label) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), providerTimeoutMs());
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (error) {
    if (error?.name === 'AbortError') throw providerError(`${label} request timed out.`, 'provider timeout');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function providerError(message, detail = null) {
  const error = new Error(message);
  error.statusCode = 503;
  error.aiProviderError = true;
  if (detail) error.providerDetail = detail;
  return error;
}

function extractOpenAIText(body) {
  if (typeof body?.output_text === 'string') return body.output_text;
  const parts = [];
  for (const item of body?.output || []) {
    for (const content of item?.content || []) {
      if (content?.type === 'output_text' && typeof content?.text === 'string') parts.push(content.text);
      else if (typeof content?.text === 'string') parts.push(content.text);
    }
  }
  return parts.join('\n').trim();
}

function extractAnthropicText(body) {
  return (body?.content || []).filter(x => x?.type === 'text').map(x => x.text).join('\n').trim();
}

export function aiProviderStatus() {
  const preferredRaw = clean(process.env.VEUX_AI_PROVIDER).toLowerCase();
  const preferred = ['openai','anthropic'].includes(preferredRaw) ? preferredRaw : null;
  const openaiKey = key('OPENAI_API_KEY');
  const anthropicKey = key('ANTHROPIC_API_KEY');
  const openaiModel = clean(process.env.VEUX_OPENAI_MODEL) || DEFAULT_OPENAI_MODEL;
  const anthropicModel = clean(process.env.VEUX_ANTHROPIC_MODEL) || DEFAULT_ANTHROPIC_MODEL;
  const providers = {
    openai: { provider:'openai', configured:!!openaiKey, key_present:!!openaiKey, model:openaiModel },
    anthropic: { provider:'anthropic', configured:!!anthropicKey, key_present:!!anthropicKey, model:anthropicModel }
  };
  const baseOrder = preferred ? [preferred, preferred === 'openai' ? 'anthropic' : 'openai'] : ['openai','anthropic'];
  const usable = baseOrder.filter(name => providers[name].configured);
  return {
    ok: usable.length > 0,
    preferred,
    selected: usable[0] || null,
    usable,
    providers
  };
}

export async function callOpenAI({ instructions, input, model }) {
  const apiKey = key('OPENAI_API_KEY');
  if (!apiKey) throw providerError('OpenAI is not configured for Vera.');
  const chosenModel = clean(model) || clean(process.env.VEUX_OPENAI_MODEL) || DEFAULT_OPENAI_MODEL;
  const res = await timedFetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: chosenModel, instructions, input, store: false })
  }, 'OpenAI');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw providerError(`OpenAI request failed (${res.status}).`, body?.error?.message || 'request failed');
  const text = extractOpenAIText(body);
  if (!text) throw providerError('OpenAI returned an empty response.');
  return { provider: 'openai', model: body?.model || chosenModel, text, rawId: body?.id || null };
}

let anthropicDiscoveryCache = { model: '', expiresAt: 0 };

function anthropicConfiguredModel(explicitModel = '') {
  return clean(explicitModel) || clean(process.env.VEUX_ANTHROPIC_MODEL) || DEFAULT_ANTHROPIC_MODEL;
}

function isAnthropicModelAccessFailure(status, body) {
  const detail = String(body?.error?.message || '').toLowerCase();
  return status === 404 || (status === 403 && /model|access|permission|entitl/.test(detail));
}

async function discoverAnthropicModel(apiKey, excluded = []) {
  const blocked = new Set((excluded || []).map(String));
  const now = Date.now();
  if (anthropicDiscoveryCache.model && anthropicDiscoveryCache.expiresAt > now && !blocked.has(anthropicDiscoveryCache.model)) {
    return anthropicDiscoveryCache.model;
  }
  try {
    const res = await timedFetch('https://api.anthropic.com/v1/models?limit=100', {
      method: 'GET',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      }
    }, 'Anthropic model discovery');
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return '';
    const ids = (Array.isArray(body?.data) ? body.data : []).map(x => clean(x?.id)).filter(id => id && !blocked.has(id));
    const preferred = ids.find(id => /sonnet/i.test(id)) || ids.find(id => /haiku/i.test(id)) || ids[0] || '';
    if (preferred) anthropicDiscoveryCache = { model: preferred, expiresAt: now + 10 * 60 * 1000 };
    return preferred;
  } catch (_) {
    return '';
  }
}

async function anthropicMessageRequest(apiKey, chosenModel, instructions, input) {
  const res = await timedFetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json'
    },
    body: JSON.stringify({
      model: chosenModel,
      max_tokens: Number(process.env.VEUX_AI_MAX_TOKENS || 1800),
      system: instructions,
      messages: [{ role: 'user', content: input }]
    })
  }, 'Anthropic');
  const body = await res.json().catch(() => ({}));
  return { res, body };
}

export async function callAnthropic({ instructions, input, model }) {
  const apiKey = key('ANTHROPIC_API_KEY');
  if (!apiKey) throw providerError('Anthropic is not configured for Vera.');
  const requestedModel = anthropicConfiguredModel(model);
  const attempts = [];
  let chosenModel = requestedModel;
  for (let attempt = 0; attempt < 3 && chosenModel; attempt++) {
    const { res, body } = await anthropicMessageRequest(apiKey, chosenModel, instructions, input);
    if (res.ok) {
      const text = extractAnthropicText(body);
      if (!text) throw providerError('Anthropic returned an empty response.');
      return {
        provider: 'anthropic',
        model: body?.model || chosenModel,
        text,
        rawId: body?.id || null,
        model_fallback: chosenModel !== requestedModel
      };
    }
    const detail = body?.error?.message || 'request failed';
    attempts.push({ model: chosenModel, status: res.status, detail });
    if (!isAnthropicModelAccessFailure(res.status, body)) {
      const err = providerError(`Anthropic request failed (${res.status}).`, detail);
      err.modelAttempts = attempts.map(x => ({ model:x.model, status:x.status }));
      throw err;
    }
    const discovered = await discoverAnthropicModel(apiKey, attempts.map(x => x.model));
    if (discovered) {
      chosenModel = discovered;
      continue;
    }
    const configuredFallback = clean(process.env.VEUX_ANTHROPIC_FALLBACK_MODEL) || DEFAULT_ANTHROPIC_FALLBACK_MODEL;
    if (configuredFallback && !attempts.some(x => x.model === configuredFallback)) {
      chosenModel = configuredFallback;
      continue;
    }
    break;
  }
  const last = attempts[attempts.length - 1] || {};
  const err = providerError(`Anthropic request failed (${last.status || 404}).`, last.detail || 'No accessible Anthropic model was available.');
  err.modelAttempts = attempts.map(x => ({ model:x.model, status:x.status }));
  throw err;
}


function redactProviderText(value) {
  return String(value || '')
    .replace(/sk-ant-[A-Za-z0-9_-]+/gi, '[redacted]')
    .replace(/sk-[A-Za-z0-9_-]{12,}/gi, '[redacted]')
    .replace(/(bearer\s+)[A-Za-z0-9._~+\/-]+/gi, '$1[redacted]')
    .replace(/(x-api-key\s*[:=]\s*)[^\s,;]+/gi, '$1[redacted]')
    .slice(0, 260);
}

function diagnosticCategory(message, detail) {
  const text = `${message || ''} ${detail || ''}`.toLowerCase();
  if (/401|unauthor|invalid.*key|api key|authentication/.test(text)) return 'authentication';
  if (/402|credit|billing|payment|quota/.test(text)) return 'billing';
  if (/403|permission|access|not allowed/.test(text)) return 'access';
  if (/404|model.*not found|unknown model/.test(text)) return 'model_access';
  if (/429|rate limit|too many/.test(text)) return 'rate_limit';
  if (/5\d\d|overload|unavailable|timeout/.test(text)) return 'provider_unavailable';
  return 'provider_error';
}

export function safeProviderDiagnostics(failures = []) {
  return (Array.isArray(failures) ? failures : []).slice(0, 2).map(f => {
    const message = redactProviderText(f?.message || 'request failed');
    const detail = redactProviderText(f?.detail || '');
    const match = message.match(/\((\d{3})\)/);
    return {
      provider: String(f?.provider || 'unknown').toLowerCase(),
      status: match ? Number(match[1]) : null,
      category: diagnosticCategory(message, detail),
      message,
      detail: detail || null
    };
  });
}

export function formatProviderDiagnostics(failures = []) {
  return safeProviderDiagnostics(failures).map(d => `${d.provider.toUpperCase()}${d.status ? ' '+d.status : ''}: ${d.detail || d.message}`).join(' | ').slice(0, 500);
}

export async function callVeuxAI(args = {}) {
  const status = aiProviderStatus();
  if (!status.ok) throw providerError('Vera has no AI provider configured. Add an OpenAI or Anthropic API key to the maison-agent Netlify environment.');
  const failures = [];
  for (const provider of status.usable) {
    try {
      return provider === 'openai' ? await callOpenAI(args) : await callAnthropic(args);
    } catch (error) {
      failures.push({ provider, message: error?.message || 'request failed', detail: error?.providerDetail || null });
    }
  }
  const error = providerError('Vera could not reach a configured AI provider. Check the provider key, model access and billing.');
  error.failures = failures;
  throw error;
}

export function parseJsonLoose(text) {
  if (!text) return { summary: '', raw_text: '' };
  try { return JSON.parse(text); } catch {}
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try { return JSON.parse(text.slice(start, end + 1)); } catch {}
  }
  return { summary: text, raw_text: text, priorities: [], risks: [], recommendations: [], proposed_actions: [] };
}
