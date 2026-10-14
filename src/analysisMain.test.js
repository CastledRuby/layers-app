// Real conversation analysis, the main process's half (electron/analysis.cjs):
// the key kept encrypted (Windows' protection stood in for), only text and
// screenshots let through, and Claude's answers and failures (Claude stood in
// for: no real requests are made).
import fs from 'fs';
import os from 'os';
import { createRequire } from 'module';
import path from 'path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { checkKey, cleanContent, cleanKey, keyStore, MODEL, runAnalysis } from '../electron/analysis.cjs';

// The SDK as the main process loads it (its error classes are its own).
const Anthropic = createRequire(import.meta.url)('@anthropic-ai/sdk');
const dirs = [];
afterEach(() => { dirs.splice(0).forEach(d => fs.rmSync(d, { recursive: true, force: true })); });
const tempFile = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'layers-key-')); dirs.push(d); return path.join(d, 'anthropic-key.bin'); };
const fake = { isEncryptionAvailable: () => true, encryptString: (s) => Buffer.from(`enc:${s}`), decryptString: (b) => b.toString().slice(4) };
const KEY = 'sk-ant-api03-abcdefghijklmnopqrstuvwxyz_0123456789';
const request = { system: 'Coach', content: [{ type: 'text', text: 'The chat: hi' }], schema: { type: 'object' } };

function claude(answer) {
  const create = vi.fn(async () => (answer instanceof Error ? Promise.reject(answer) : answer));
  return { client: { messages: { create }, models: { list: vi.fn(async () => (answer instanceof Error ? Promise.reject(answer) : { data: [] })) } }, create };
}
const reply = (text, stop = 'end_turn') => ({ stop_reason: stop, content: [{ type: 'text', text }], usage: { input_tokens: 4000, output_tokens: 900 } });

describe('the key', () => {
  it('takes only what looks like an Anthropic API key', () => {
    expect(cleanKey(`  ${KEY}\n`)).toBe(KEY);
    expect(cleanKey('sk-ant-short')).toBeNull();
    expect(cleanKey('sk-proj-abcdefghijklmnopqrstuvwxyz')).toBeNull();
    expect(cleanKey(`${KEY} extra`)).toBeNull();
  });

  it('is kept encrypted, and forgotten when removed', () => {
    const file = tempFile();
    const store = keyStore(file, fake);
    expect(store.get()).toBeNull();
    expect(store.set(KEY)).toEqual({ ok: true });
    expect(fs.readFileSync(file, 'utf8')).toBe(`enc:${KEY}`);
    expect(keyStore(file, fake).get()).toBe(KEY);
    store.clear();
    expect(fs.existsSync(file)).toBe(false);
    expect(keyStore(file, { ...fake, isEncryptionAvailable: () => false }).set(KEY)).toMatchObject({ error: expect.any(String) });
  });

  it('is checked without spending anything', async () => {
    const good = claude(null);
    expect(await checkKey(KEY, { client: good.client })).toEqual({ ok: true });
    expect(good.create).not.toHaveBeenCalled();
    const bad = claude(new Anthropic.AuthenticationError(401, {}, 'invalid x-api-key', new Headers()));
    expect(await checkKey(KEY, { client: bad.client })).toEqual({ error: expect.stringMatching(/API key isn't working/) });
  });
});

describe('what the page may send', () => {
  it('lets through text and up to six screenshots, nothing else', () => {
    const shot = { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: 'AAA' } };
    expect(cleanContent([shot, { type: 'text', text: 'hi', extra: 1 }])).toEqual([shot, { type: 'text', text: 'hi' }]);
    expect(cleanContent(Array(7).fill(shot))).toBeNull();
    expect(cleanContent([{ type: 'image', source: { type: 'url', url: 'https://x.test/a.png' } }])).toBeNull();
    expect(cleanContent([{ type: 'document', source: {} }])).toBeNull();
    expect(cleanContent([{ type: 'image', source: { type: 'base64', media_type: 'image/svg+xml', data: 'A' } }])).toBeNull();
    expect(cleanContent([])).toBeNull();
    expect(cleanContent('hi')).toBeNull();
  });
});

describe('asking Claude', () => {
  it('asks Haiku 5.5 (thinking left to it) for the answer as JSON, and gives back the answer and tokens used', async () => {
    const { client, create } = claude(reply('{"opportunity":"Ask more"}'));
    expect(await runAnalysis(request, { client })).toEqual({ result: { opportunity: 'Ask more' }, model: MODEL, usage: { input: 4000, output: 900 } });
    const sent = create.mock.calls[0][0];
    expect(sent).toMatchObject({ model: 'claude-haiku-5-5', system: 'Coach', messages: [{ role: 'user', content: request.content }], output_config: { format: { type: 'json_schema', schema: request.schema } } });
    expect(sent).not.toHaveProperty('thinking');
  });

  it('asks the model picked in Coach, if it is one Layers offers; otherwise the cheapest', async () => {
    const opus = claude(reply('{}'));
    expect(await runAnalysis({ ...request, model: 'claude-opus-5-5' }, { client: opus.client })).toMatchObject({ model: 'claude-opus-5-5' });
    expect(opus.create.mock.calls[0][0].model).toBe('claude-opus-5-5');
    const other = claude(reply('{}'));
    expect(await runAnalysis({ ...request, model: 'claude-3-opus-20240229' }, { client: other.client })).toMatchObject({ model: 'claude-haiku-5-5' });
    expect(other.create.mock.calls[0][0].model).toBe('claude-haiku-5-5');
  });

  it('runs a deep request on the thinking models at high effort, Haiku 5.5 included; never on Haiku 4.5, nor a quick request', async () => {
    const sent = async (extra) => { const c = claude(reply('{}')); await runAnalysis({ ...request, ...extra }, { client: c.client }); return c.create.mock.calls[0][0].output_config; };
    expect(await sent({ model: 'claude-opus-5-5', deep: true })).toEqual({ format: { type: 'json_schema', schema: request.schema }, effort: 'high' });
    expect(await sent({ model: 'claude-sonnet-5-5', deep: true })).toMatchObject({ effort: 'high' });
    expect(await sent({ model: 'claude-fable-5-1', deep: true })).toMatchObject({ effort: 'high' });
    expect(await sent({ model: 'claude-haiku-5-5', deep: true })).toMatchObject({ effort: 'high' });
    expect(await sent({ model: 'claude-haiku-5-5' })).not.toHaveProperty('effort');
    expect(await sent({ model: 'claude-haiku-4-5', deep: true })).not.toHaveProperty('effort');
    expect(await sent({ model: 'claude-opus-5-5' })).not.toHaveProperty('effort');
    expect(await sent({ model: 'claude-opus-5-5', deep: 'yes' })).not.toHaveProperty('effort');
  });

  it("refuses requests Layers doesn't make, or with no key", async () => {
    const { client, create } = claude(reply('{}'));
    expect(await runAnalysis({ ...request, content: [{ type: 'tool_use' }] }, { client })).toMatchObject({ error: expect.any(String) });
    expect(await runAnalysis({ ...request, system: 5 }, { client })).toMatchObject({ error: expect.any(String) });
    expect(await runAnalysis(null, { client })).toMatchObject({ error: expect.any(String) });
    expect(create).not.toHaveBeenCalled();
    expect(await runAnalysis(request, { apiKey: null })).toEqual({ error: 'Add your Anthropic API key in Me first.' });
  });

  it("says so when Claude declines, runs out of room, or answers badly, with what it used (that's still charged)", async () => {
    const used = { model: 'claude-haiku-5-5', usage: { input: 4000, output: 900 } };
    expect(await runAnalysis(request, claude(reply('', 'refusal')))).toEqual({ error: "Claude wouldn't analyse that chat.", ...used });
    expect(await runAnalysis(request, claude(reply('{"a":', 'max_tokens')))).toMatchObject({ error: expect.stringMatching(/too long/), ...used });
    expect(await runAnalysis(request, claude(reply('not json')))).toMatchObject({ error: expect.stringMatching(/couldn't be read/), ...used });
  });

  it('holds a request to limits in all: its text, blocks, instructions and format, which every request Layers makes fits (audit 2026-10-14)', async () => {
    const { client, create } = claude(reply('{}'));
    const run = (r) => runAnalysis(r, { client });
    expect((await run({ ...request, system: 'x'.repeat(40001) })).error).toMatch(/isn.t one Layers makes/);
    expect((await run({ ...request, schema: { type: 'object', description: 'x'.repeat(20001) } })).error).toMatch(/isn.t one Layers makes/);
    expect((await run({ ...request, content: Array.from({ length: 3 }, () => ({ type: 'text', text: 'x'.repeat(25000) })) })).error).toMatch(/isn.t one Layers makes/);
    expect(cleanContent(Array.from({ length: 9 }, () => ({ type: 'text', text: 'hi' })))).toBeNull();
    expect(create).not.toHaveBeenCalled();
    const { analysisRequest } = await import('./lib/analysis.js');
    const group = [{ id: 'a', name: 'Amelie', layer: 4 }, { id: 'c', name: 'Chloe', layer: 3 }];
    const big = analysisRequest({ people: group, yourName: 'Liam', text: 'Amelie: hi\n'.repeat(9000) });
    expect((await run(big)).error).toBeUndefined();
  });

  it('puts what went wrong in words', async () => {
    const h = new Headers();
    const cases = [
      [new Anthropic.AuthenticationError(401, {}, 'invalid x-api-key', h), /API key isn't working/],
      [new Anthropic.PermissionDeniedError(403, {}, 'denied', h), /isn't allowed/],
      [new Anthropic.RateLimitError(429, {}, 'slow down', h), /Too many requests/],
      [new Anthropic.BadRequestError(400, { error: { message: 'Your credit balance is too low' } }, undefined, h), /credit has run out/],
      [new Anthropic.BadRequestError(400, { error: { message: 'image too large' } }, undefined, h), /fewer or smaller screenshots/],
      [new Anthropic.BadRequestError(400, { error: { message: 'Schema is too complex for compilation.' } }, undefined, h), /^Claude couldn't take that chat\. \(Anthropic said: Schema is too complex for compilation\.\)$/],
      [new Anthropic.APIConnectionError({ message: 'offline' }), /Are you online/],
      [new Anthropic.InternalServerError(529, {}, 'overloaded', h), /problem \(529\)/],
      [new Error('boom'), /Couldn't analyse/],
    ];
    for (const [error, words] of cases) expect(await runAnalysis(request, claude(error))).toEqual({ error: expect.stringMatching(words) });
  });
});
