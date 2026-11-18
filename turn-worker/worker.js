// Stateless TURN credentials endpoint for retro.tools (P2P mode).
//
// Returns short-lived Cloudflare Realtime TURN credentials so browsers on
// restrictive networks can relay their (already end-to-end encrypted) WebRTC
// traffic. Stores nothing and never sees board data.
//
// Secrets/vars: TURN_KEY_ID, TURN_KEY_API_TOKEN, ALLOWED_ORIGINS (comma list)
// Optional binding: RATE_LIMITER (Workers rate limiting).

const TTL_SECONDS = 24 * 60 * 60;

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? '';
    const allowed = (env.ALLOWED_ORIGINS ?? '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);
    const originOk = allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin : allowed[0] ?? '',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      Vary: 'Origin',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: cors });
    }
    if (request.method !== 'GET' || !originOk) {
      return new Response('Forbidden', { status: 403, headers: cors });
    }

    if (env.RATE_LIMITER) {
      const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
      const { success } = await env.RATE_LIMITER.limit({ key: ip });
      if (!success) {
        return new Response('Too many requests', { status: 429, headers: cors });
      }
    }

    const res = await fetch(
      `https://rtc.live.cloudflare.com/v1/turn/keys/${env.TURN_KEY_ID}/credentials/generate-ice-servers`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.TURN_KEY_API_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ttl: TTL_SECONDS }),
      }
    );
    if (!res.ok) {
      return new Response('Upstream error', { status: 502, headers: cors });
    }
    const { iceServers } = await res.json();
    // Port 53 URLs are blocked by browsers and only cause timeouts.
    const cleaned = iceServers.map((s) => ({
      ...s,
      urls: [].concat(s.urls).filter((u) => !/:53\b/.test(u)),
    }));

    return Response.json(
      { iceServers: cleaned, ttl: TTL_SECONDS },
      { headers: { ...cors, 'Cache-Control': 'no-store' } }
    );
  },
};
