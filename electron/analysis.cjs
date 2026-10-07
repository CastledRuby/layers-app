// Real conversation analysis (docs/roadmap.md, "The plan from here", step 6):
// your Anthropic API key, kept by Windows, and asking Claude to analyse a
// chat you chose. The page builds the request (src/lib/analysis.js: what to
// look for, the answer's shape, names hidden); here it's sent, only when you
// press Analyse, and the key never reaches the page. See docs/electron.md.

const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const Client = Anthropic.Anthropic || Anthropic.default || Anthropic;
// The models Coach may ask for (src/lib/analysis.js ANALYSIS_MODELS);
// anything else gets the first, Claude Haiku 4.5, the cheapest.
const MODELS = ['claude-haiku-4-5', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1'];
const MODEL = MODELS[0];
const MAX_IMAGES = 6;
const MAX_IMAGE_CHARS = 6 * 1024 * 1024; // base64, after the page shrinks them
const MAX_TEXT_CHARS = 60000;

// A pasted key that looks like an Anthropic API key, or null.
function cleanKey(text) {
  const key = String(text || '').trim();
  return /^sk-ant-[A-Za-z0-9_-]{20,}$/.test(key) ? key : null;
}

// The key, encrypted by Windows for this user (safeStorage), in the data folder.
function keyStore(file, safeStorage) {
  return {
    get() {
      try {
        if (!fs.existsSync(file) || !safeStorage.isEncryptionAvailable()) return null;
        return safeStorage.decryptString(fs.readFileSync(file));
      } catch { return null; }
    },
    set(key) {
      if (!safeStorage.isEncryptionAvailable()) return { error: 'Windows can’t protect it here' };
      fs.mkdirSync(path.dirname(file), { recursive: true });
      fs.writeFileSync(file, safeStorage.encryptString(key));
      return { ok: true };
    },
    clear() {
      try { fs.unlinkSync(file); } catch { /* not there */ }
      return { ok: true };
    },
  };
}

// What the page sends: text and screenshots only, within limits.
function cleanContent(content) {
  if (!Array.isArray(content) || !content.length) return null;
  let images = 0;
  const out = [];
  for (const block of content) {
    if (block && block.type === 'text' && typeof block.text === 'string' && block.text.length <= MAX_TEXT_CHARS) out.push({ type: 'text', text: block.text });
    else if (block && block.type === 'image' && block.source && block.source.type === 'base64'
      && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(block.source.media_type)
      && typeof block.source.data === 'string' && block.source.data.length <= MAX_IMAGE_CHARS && ++images <= MAX_IMAGES) {
      out.push({ type: 'image', source: { type: 'base64', media_type: block.source.media_type, data: block.source.data } });
    } else return null;
  }
  return out;
}

// What went wrong, in words, from the SDK's typed errors.
function errorText(e) {
  if (e instanceof Client.AuthenticationError) return "That API key isn't working. Check it in Me (Chat analysis).";
  if (e instanceof Client.PermissionDeniedError) return "That API key isn't allowed to use Claude. Check it at console.anthropic.com.";
  if (e instanceof Client.RateLimitError) return 'Too many requests just now. Try again in a minute.';
  if (e instanceof Client.BadRequestError) {
    return /credit balance/i.test(e.message || '') ? 'Your Anthropic credit has run out. Add some at console.anthropic.com.' : "Claude couldn't take that chat. Try fewer or smaller screenshots.";
  }
  if (e instanceof Client.APIConnectionError) return "Couldn't reach Claude. Are you online?";
  if (e instanceof Client.APIError) return `Claude had a problem (${e.status || 'unknown'}). Try again shortly.`;
  return "Couldn't analyse that chat.";
}

// Asks Claude for the analysis: { system, content, schema, model? } from the
// page. Resolves to { result, usage: { input, output }, model } or { error },
// with usage and model too when Claude answered but it couldn't be used
// (that's still charged, so Me's spending counts it).
// The bigger models think first, so it waits up to 5 minutes.
// `client` is replaced in tests.
async function runAnalysis(request, { apiKey, client = null } = {}) {
  const content = cleanContent(request && request.content);
  if (!content || typeof request.system !== 'string' || !request.schema || typeof request.schema !== 'object') return { error: 'That request isn’t one Layers makes.' };
  if (!apiKey && !client) return { error: 'Add your Anthropic API key in Me first.' };
  const model = MODELS.includes(request.model) ? request.model : MODEL;
  const anthropic = client || new Client({ apiKey, timeout: 300000, maxRetries: 2 });
  try {
    const response = await anthropic.messages.create({
      model,
      max_tokens: 16000,
      system: request.system,
      messages: [{ role: 'user', content }],
      output_config: { format: { type: 'json_schema', schema: request.schema } },
    });
    const used = response.usage || {};
    const usage = { input: used.input_tokens || 0, output: used.output_tokens || 0 };
    if (response.stop_reason === 'refusal') return { error: "Claude wouldn't analyse that chat.", model, usage };
    if (response.stop_reason === 'max_tokens') return { error: 'That chat was too long to finish. Try a shorter part of it.', model, usage };
    const text = (response.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    let result;
    try { result = JSON.parse(text); } catch { return { error: "Claude's answer couldn't be read. Try again.", model, usage }; }
    return { result, model, usage };
  } catch (e) {
    return { error: errorText(e) };
  }
}

// Checks a key works, without spending anything (lists the models).
async function checkKey(apiKey, { client = null } = {}) {
  const anthropic = client || new Client({ apiKey, timeout: 30000, maxRetries: 1 });
  try {
    await anthropic.models.list({ limit: 1 });
    return { ok: true };
  } catch (e) {
    return { error: errorText(e) };
  }
}

module.exports = { checkKey, cleanContent, cleanKey, keyStore, MODEL, MODELS, runAnalysis };
