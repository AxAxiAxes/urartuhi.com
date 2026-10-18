import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import cors from 'cors';
import { registerLiveAvatarRoutes, LIVE_AVATAR_ORIGINS } from './tavus.js';

const validEnv = {
  TAVUS_API_KEY: 'test-only-provider-key',
  TAVUS_PAL_ID: 'p_existing_test',
  TAVUS_ACCESS_CODE: 'test-only-owner-code-long',
};
const validBody = { characterPrompt: 'Warm and curious, talk about art.', consent: true };

function fixture({ env = { ...validEnv }, providerFetch, now } = {}) {
  const routes = new Map();
  const calls = [];
  const app = {
    get(path, handler) { routes.set(`GET ${path}`, handler); },
    post(path, handler) { routes.set(`POST ${path}`, handler); },
  };
  const provider = providerFetch || (async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({
      conversation_id: 'c_test',
      conversation_url: 'https://tavus.daily.co/c_test',
      meeting_token: 'test-meeting-token',
    }) };
  });
  registerLiveAvatarRoutes(app, { env, providerFetch: provider, ...(now ? { now } : {}) });
  async function request(path, { body = validBody, origin = 'http://127.0.0.1:8768',
    code = validEnv.TAVUS_ACCESS_CODE, method = 'POST' } = {}) {
    const req = { body, get: name => ({
      origin, 'x-urartuhi-access-code': code,
    })[name] };
    const res = {
      statusCode: 200, headers: {}, body: null,
      setHeader(name, value) { this.headers[name] = value; },
      status(value) { this.statusCode = value; return this; },
      json(value) { this.body = value; return this; },
    };
    await routes.get(`${method} ${path}`)(req, res);
    return res;
  }
  return { request, calls };
}
const start = '/api/start-live-avatar';
const end = '/api/end-live-avatar';

test('readiness is configuration-only, no provider call or secret values', async () => {
  const f = fixture();
  const result = await f.request('/api/live-avatar-status', { method: 'GET' });
  assert.equal(result.body.ready, true);
  assert.equal(result.body.accountVerified, false);
  assert.equal(result.headers['Cache-Control'], 'no-store');
  assert.equal(f.calls.length, 0);
  assert.ok(!JSON.stringify(result.body).includes(validEnv.TAVUS_API_KEY));
});

test('missing setup lists variable names, does not initiate conversations', async () => {
  const f = fixture({ env: {} });
  const status = await f.request('/api/live-avatar-status', { method: 'GET' });
  assert.equal(status.body.ready, false);
  assert.equal(status.body.missing.length, 3);
  assert.equal((await f.request(start)).statusCode, 503);
  assert.equal(f.calls.length, 0);
});

test('owner authorization and allowed origin required before paid creation', async () => {
  const f = fixture();
  assert.equal((await f.request(start, { code: 'wrong' })).statusCode, 401);
  assert.equal((await f.request(start, { origin: 'https://evil.example' })).statusCode, 403);
  assert.equal((await f.request(start, { origin: '' })).statusCode, 403);
  assert.equal(f.calls.length, 0);
});

test('prompt and explicit cost/media consent validated', async () => {
  const f = fixture();
  for (const body of [{}, { ...validBody, consent: false },
    { ...validBody, characterPrompt: 42 }, { ...validBody, characterPrompt: ' ' },
    { ...validBody, characterPrompt: 'x'.repeat(2001) }]) {
    assert.equal((await f.request(start, { body })).statusCode, 400);
  }
  assert.equal(f.calls.length, 0);
});

test('current PAL contract, private meeting token and bounded call properties', async () => {
  const f = fixture();
  const result = await f.request(start);
  assert.equal(result.statusCode, 200);
  const sent = JSON.parse(f.calls[0].options.body);
  assert.equal(sent.pal_id, validEnv.TAVUS_PAL_ID);
  assert.equal(sent.require_auth, true);
  assert.equal(sent.max_participants, 2);
  assert.equal(sent.properties.max_call_duration, 300);
  assert.equal(sent.properties.participant_absent_timeout, 60);
  assert.equal(sent.properties.participant_left_timeout, 30);
  assert.equal(sent.properties.enable_recording, false);
  assert.equal(sent.properties.auto_start_recording, false);
  assert.equal(sent.persona_id, undefined);
  assert.equal(sent.replica_id, undefined);
  assert.equal(f.calls[0].options.headers['x-api-key'], validEnv.TAVUS_API_KEY);
  assert.equal(new URL(result.body.conversationUrl).searchParams.get('t'), 'test-meeting-token');
  assert.equal(result.body.endToken.length, 64);
  assert.equal((await f.request(start)).statusCode, 409);
  assert.equal(f.calls.length, 1);
});

test('existing face-only or PAL face override supported, no resource creation', async () => {
  for (const pal of [undefined, 'p_existing_test']) {
    const f = fixture({ env: { ...validEnv, TAVUS_PAL_ID: pal, TAVUS_FACE_ID: 'r_existing_test' } });
    assert.equal((await f.request(start)).statusCode, 200);
    const body = JSON.parse(f.calls[0].options.body);
    assert.equal(body.face_id, 'r_existing_test');
    assert.equal(body.pal_id, pal);
  }
});

test('end capability only cleans up the created conversation, no destructive delete', async () => {
  const f = fixture();
  const created = (await f.request(start)).body;
  assert.equal((await f.request(end, { body: {
    conversationId: created.conversationId, endToken: 'wrong',
  } })).statusCode, 404);
  assert.equal((await f.request(end, { body: created })).body.ended, true);
  assert.equal(f.calls[1].url, 'https://tavusapi.com/v2/conversations/c_test/end');
  assert.equal(f.calls[1].options.method, 'POST');
  assert.equal((await f.request(start)).statusCode, 200);
});

test('provider errors are sanitized and do not claim an active session', async () => {
  for (const status of [400, 401, 402, 403, 429, 500]) {
    const f = fixture({ providerFetch: async () => ({
      ok: false, status, text: async () => validEnv.TAVUS_API_KEY,
    }) });
    const result = await f.request(start);
    assert.equal(result.statusCode, 502);
    assert.equal(result.body.providerStatus, status);
    assert.ok(!JSON.stringify(result.body).includes(validEnv.TAVUS_API_KEY));
  }
});

test('concurrent starts are blocked while first request is pending', async () => {
  let resolve;
  const f = fixture({ providerFetch: () => new Promise(r => { resolve = r; }) });
  const pending = f.request(start);
  assert.equal((await f.request(start)).statusCode, 409);
  resolve({ ok: false, status: 429 });
  assert.equal((await pending).statusCode, 502);
});

test('uncertain creation blocks retries until bounded provider timeout', async () => {
  let clock = 1000;
  let calls = 0;
  const f = fixture({ now: () => clock, providerFetch: async () => {
    calls++;
    throw new Error('network failure containing private details');
  } });
  const result = await f.request(start);
  assert.equal(result.statusCode, 502);
  assert.ok(!result.body.error.includes('private details'));
  assert.equal((await f.request(start)).statusCode, 409);
  clock += 360001;
  await f.request(start);
  assert.equal(calls, 2);
});

test('invalid room URL/token retains cleanup capability', async () => {
  for (const response of [
    { conversation_url: 'https://evil.example/c_test', meeting_token: 'test' },
    { conversation_url: 'http://tavus.daily.co/c_test', meeting_token: 'test' },
    { conversation_url: 'https://user:pass@tavus.daily.co/c_test', meeting_token: 'test' },
    { conversation_url: 'https://tavus.daily.co/c_test' },
  ]) {
    const f = fixture({ providerFetch: async () => ({
      ok: true, json: async () => ({ conversation_id: 'c_test', ...response }),
    }) });
    const result = await f.request(start);
    assert.equal(result.statusCode, 502);
    assert.equal(result.body.conversationId, 'c_test');
    assert.equal(result.body.endToken.length, 64);
    assert.equal((await f.request(end, { body: result.body })).body.ended, true);
  }
});

test('failed End retains capability for retry', async () => {
  let endCalls = 0;
  const f = fixture({ providerFetch: async url => {
    if (url.endsWith('/end')) {
      endCalls++;
      if (endCalls === 1) return { ok: false, status: 500 };
      return { ok: true };
    }
    return { ok: true, json: async () => ({
      conversation_id: 'c_test', conversation_url: 'https://tavus.daily.co/c_test',
      meeting_token: 'test-token',
    }) };
  } });
  const created = (await f.request(start)).body;
  assert.equal((await f.request(end, { body: created })).statusCode, 502);
  assert.equal((await f.request(start)).statusCode, 409);
  assert.equal((await f.request(end, { body: created })).body.ended, true);
});

test('late duplicate End cannot discard a newer session cleanup capability', async () => {
  let creates = 0;
  const endings = [];
  const f = fixture({ providerFetch: async url => {
    if (url.endsWith('/end')) return new Promise(resolve => endings.push(resolve));
    creates++;
    return { ok: true, json: async () => ({
      conversation_id: `c_${creates}`, conversation_url: `https://tavus.daily.co/c_${creates}`,
      meeting_token: 'test-token',
    }) };
  } });
  const first = (await f.request(start)).body;
  const end1 = f.request(end, { body: first });
  const end2 = f.request(end, { body: first });
  endings[0]({ ok: true });
  await end1;
  const second = (await f.request(start)).body;
  endings[1]({ ok: true });
  await end2;
  assert.equal((await f.request(start)).statusCode, 409);
  const lastEnd = f.request(end, { body: second });
  endings[2]({ ok: true });
  assert.equal((await lastEnd).body.ended, true);
});

test('real Express HTTP wiring, CORS and missing-config guard make no provider calls', async t => {
  const app = express();
  app.use(cors({ origin: LIVE_AVATAR_ORIGINS }));
  app.use(express.json());
  let calls = 0;
  registerLiveAvatarRoutes(app, { env: {}, providerFetch: async () => { calls++; } });
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise(resolve => server.close(resolve)));
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}`;
  const headers = { Origin: 'http://127.0.0.1:8768', 'Content-Type': 'application/json' };
  const ready = await fetch(`${base}/api/live-avatar-status`, { headers });
  assert.equal(ready.headers.get('access-control-allow-origin'), headers.Origin);
  assert.equal((await ready.json()).ready, false);
  const startResponse = await fetch(`${base}${start}`, {
    method: 'POST', headers, body: JSON.stringify(validBody),
  });
  assert.equal(startResponse.status, 503);
  const rejected = await fetch(`${base}${start}`, {
    method: 'POST', headers: { ...headers, Origin: 'https://evil.example' },
    body: JSON.stringify(validBody),
  });
  assert.equal(rejected.status, 403);
  assert.equal(calls, 0);
});
