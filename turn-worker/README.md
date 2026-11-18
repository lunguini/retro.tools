# retro-turn

Stateless Cloudflare Worker that hands out 24h Cloudflare Realtime TURN
credentials to the retro.tools frontend, so peers behind strict NATs or
corporate firewalls can still connect. It stores nothing and never sees
board data; the TURN relay only forwards already-encrypted WebRTC traffic.

- Deployed as Worker `retro-turn` at https://retro-turn.lunguini.com/
- Secrets: `TURN_KEY_ID`, `TURN_KEY_API_TOKEN` (Cloudflare Realtime TURN key)
- Var: `ALLOWED_ORIGINS` (comma-separated; currently retro.lunguini.com,
  lunguini.github.io, http://localhost:5173)
- Binding: `RATE_LIMITER` (20 requests / 60s per IP)

The frontend reads the endpoint from `VITE_TURN_ENDPOINT` (default above;
set to an empty string to disable TURN) and falls back to direct
connections if the endpoint is unreachable.
