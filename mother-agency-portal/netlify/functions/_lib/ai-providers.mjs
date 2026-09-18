function env(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable: ${name}`);
  return v;
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

export async function callOpenAI({ instructions, input, model = process.env.VEUX_OPENAI_MODEL }) {
  const apiKey = env('OPENAI_API_KEY');
  const chosenModel = model || env('VEUX_OPENAI_MODEL');
  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: chosenModel, instructions, input })
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${body?.error?.message || 'request failed'}`);
  return { provider: 'openai', model: body?.model || chosenModel, text: extractOpenAIText(body), rawId: body?.id || null };
}

export async function callAnthropic({ instructions, input, model = process.env.VEUX_ANTHROPIC_MODEL }) {
  const apiKey = env('ANTHROPIC_API_KEY');
  const chosenModel = model || env('VEUX_ANTHROPIC_MODEL');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
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
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${body?.error?.message || 'request failed'}`);
  return { provider: 'anthropic', model: body?.model || chosenModel, text: extractAnthropicText(body), rawId: body?.id || null };
}

export async function callVeuxAI({ provider = process.env.VEUX_AI_PROVIDER || 'anthropic', ...args }) {
  if (provider === 'openai') return callOpenAI(args);
  if (provider === 'anthropic') return callAnthropic(args);
  throw new Error(`Unsupported VEUX AI provider: ${provider}`);
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
