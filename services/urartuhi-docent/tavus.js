import { randomBytes, timingSafeEqual } from 'node:crypto';

export const LIVE_AVATAR_ORIGINS = [
  'https://urartuhi.com', 'https://www.urartuhi.com',
  'http://localhost:3000', 'http://localhost:5173',
  'http://localhost:8768', 'http://127.0.0.1:8768',
];
const MAX_CALL_SECONDS = 300;
const API = 'https://tavusapi.com/v2/conversations';

function equalSecret(value, expected) {
  if (typeof value !== 'string' || typeof expected !== 'string') return false;
  const left = Buffer.from(value);
  const right = Buffer.from(expected);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function registerLiveAvatarRoutes(app, {
  env = process.env, providerFetch = fetch, now = Date.now,
} = {}) {
  let session = null;
  let starting = false;
  let uncertainUntil = 0;

  function configuration() {
    const missing = [];
    if (!env.TAVUS_API_KEY?.trim()) missing.push('TAVUS_API_KEY');
    if (!env.TAVUS_PAL_ID?.trim() && !env.TAVUS_FACE_ID?.trim()) {
      missing.push('TAVUS_PAL_ID or TAVUS_FACE_ID');
    }
    if (!env.TAVUS_ACCESS_CODE || env.TAVUS_ACCESS_CODE.length < 16) {
      missing.push('TAVUS_ACCESS_CODE (at least 16 characters)');
    }
    return { ready: missing.length === 0, missing, maxCallSeconds: MAX_CALL_SECONDS,
      accountVerified: false };
  }

  function originAllowed(req, res) {
    if (LIVE_AVATAR_ORIGINS.includes(req.get('origin'))) return true;
    res.status(403).json({ error: 'Open Live Avatar from an approved Urartuhi site or local preview.' });
    return false;
  }

  async function providerRequest(url, body) {
    return providerFetch(url, {
      method: 'POST',
      headers: { 'x-api-key': env.TAVUS_API_KEY, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(20000),
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
  }

  function providerError(res, status) {
    const messages = {
      400: 'Tavus rejected the configuration or account limit. Verify your existing PAL/face and plan in the Tavus dashboard.',
      401: 'Tavus rejected the server API key. Verify the existing key in Railway Variables.',
      403: 'The Tavus account does not allow this operation. Check its permissions and plan.',
      402: 'Tavus requires available account credits. No purchase has been made.',
      429: 'Tavus rate or concurrency limit reached. Wait before trying again.',
    };
    return res.status(502).json({
      error: messages[status] || 'Tavus is unavailable. Check its dashboard before retrying.',
      providerStatus: status,
    });
  }

  app.get('/api/live-avatar-status', (_req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json(configuration());
  });

  app.post('/api/start-live-avatar', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!originAllowed(req, res)) return;
    const config = configuration();
    if (!config.ready) return res.status(503).json({
      error: `Server setup required: ${config.missing.join(', ')}. Use your existing Tavus account in Railway Variables, not this page.`,
    });
    if (!equalSecret(req.get('x-urartuhi-access-code'), env.TAVUS_ACCESS_CODE)) {
      return res.status(401).json({ error: 'Enter the private owner access code, not your Tavus API key.' });
    }
    const { characterPrompt, consent } = req.body || {};
    if (typeof characterPrompt !== 'string' || !characterPrompt.trim() || characterPrompt.length > 2000) {
      return res.status(400).json({ error: 'Enter a character description of 1 to 2000 characters.' });
    }
    if (consent !== true) return res.status(400).json({
      error: 'Confirm that starting sends your description and call media to Tavus and may use plan credits.',
    });
    if (starting || uncertainUntil > now() || (session && session.expires > now())) {
      return res.status(409).json({ error: 'A conversation is active or its creation is still uncertain. End it or wait up to six minutes; check Tavus before retrying.' });
    }
    session = null;
    starting = true;
    try {
      const body = {
        conversation_name: 'Urartuhi Live Avatar',
        conversational_context: characterPrompt.trim(),
        require_auth: true,
        max_participants: 2,
        properties: {
          max_call_duration: MAX_CALL_SECONDS,
          participant_left_timeout: 30,
          participant_absent_timeout: 60,
          enable_recording: false,
          auto_start_recording: false,
        },
      };
      if (env.TAVUS_PAL_ID?.trim()) body.pal_id = env.TAVUS_PAL_ID.trim();
      if (env.TAVUS_FACE_ID?.trim()) body.face_id = env.TAVUS_FACE_ID.trim();
      const response = await providerRequest(API, body);
      if (!response.ok) {
        if (response.status >= 500) uncertainUntil = now() + 360000;
        return providerError(res, response.status);
      }
      // Creation might have succeeded even if its response cannot be decoded.
      // Hold the lock until Tavus's call-duration bound instead of creating duplicates.
      uncertainUntil = now() + 360000;
      const data = await response.json();
      const id = data.conversation_id;
      if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id)) {
        throw new Error('Invalid conversation ID');
      }
      session = { id, token: randomBytes(32).toString('hex'), expires: now() + 360000 };
      const url = new URL(data.conversation_url);
      if (url.protocol !== 'https:' || url.username || url.password ||
          !(url.hostname === 'tavus.daily.co' || url.hostname.endsWith('.daily.co')) ||
          typeof data.meeting_token !== 'string' || !data.meeting_token) {
        // Retain the cleanup capability even when an unexpected provider payload cannot be embedded.
        return res.status(502).json({
          error: 'Tavus returned an unsupported room URL or missing private meeting token. End this session before retrying.',
          conversationId: session.id, endToken: session.token,
        });
      }
      url.searchParams.set('t', data.meeting_token);
      res.json({
        conversationUrl: url.href, conversationId: session.id,
        endToken: session.token, maxCallSeconds: MAX_CALL_SECONDS,
      });
    } catch {
      uncertainUntil = now() + 360000;
      res.status(502).json({
        error: 'Tavus creation could not be confirmed. Do not repeatedly start calls; check your Tavus dashboard or wait six minutes. Calls are capped at five minutes.',
        ...(session ? { conversationId: session.id, endToken: session.token } : {}),
      });
    } finally {
      starting = false;
    }
  });

  app.post('/api/end-live-avatar', async (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    if (!originAllowed(req, res)) return;
    const { conversationId, endToken } = req.body || {};
    if (!session || session.id !== conversationId || !equalSecret(endToken, session.token)) {
      return res.status(404).json({ error: 'No matching session on this server. Check Tavus for its status; calls are capped at five minutes.' });
    }
    const endingSession = session;
    try {
      const response = await providerRequest(`${API}/${encodeURIComponent(endingSession.id)}/end`);
      if (!response.ok) return providerError(res, response.status);
      if (session === endingSession) {
        session = null;
        uncertainUntil = 0;
      }
      res.json({ ended: true });
    } catch {
      res.status(502).json({ error: 'Could not confirm the session ended. Retry End or end it in your Tavus dashboard. The five-minute cap still applies.' });
    }
  });
}
