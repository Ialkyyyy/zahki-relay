# CLAUDE.md

## Project Overview

zahki-relay is a webhook relay and localhost tunnel tool. Expose local servers to the internet and inspect HTTP requests in real time. Uses path-based routing (`/t/:subdomain/...`) for simple deployment without wildcard DNS.

## Commands

```bash
npm run dev           # Run server + client concurrently (dev mode)
npm run dev:server    # Server only (tsx watch, port 3004)
npm run dev:client    # Client only (Vite, port 5173, proxies /api to :3004)
npm run build         # Build client (Vite) + server (tsc) + cli (tsc)
npm start             # Run production server (serves API + static client)
npm run cli -- start 3000  # Start CLI tunnel client
```

## Tech Stack

- **Frontend:** React 19, Tailwind CSS 3, React Router
- **Backend:** Express, ws (WebSocket), sql.js (pure JS SQLite), nanoid
- **CLI:** Commander.js, ws
- **Build:** Vite (client), tsc (server + cli), tsx (dev)
- **Language:** TypeScript (strict, ESM)

## Architecture

```
client/src/
  pages/Dashboard.tsx     — Tunnel management, create/delete/list
  pages/RequestLog.tsx    — Live request feed for a tunnel (polls every 2s)
  pages/RequestDetail.tsx — Full request/response detail, replay button
  components/RequestRow.tsx — Request row with method badge, status pill
  lib/api.ts              — API client
  App.tsx                 — Router with sidebar nav
  main.tsx                — Entry point

server/
  index.ts               — Express + WebSocket server on port 3004
  db.ts                  — sql.js SQLite setup, initDb/getDb/saveDb
  tunnel.ts              — TunnelManager class, manages connections + forwarding
  routes/tunnels.ts      — POST/GET/DELETE /api/tunnels
  routes/requests.ts     — GET /api/requests/:tunnelId, POST replay

cli/
  index.ts               — CLI entry point (Commander.js)
  tunnel-client.ts       — WebSocket client, forwards to localhost
```

## Key Design Decisions

- **Path-based routing:** `/t/:subdomain/*` instead of wildcard DNS subdomains
- **sql.js over better-sqlite3:** Pure JS, no native compilation needed
- **WebSocket protocol:** JSON messages for auth, request forwarding, responses
- **CLI auto-reconnect:** Reconnects on disconnect with 3-second delay
- **Request logging:** All tunneled requests are captured in SQLite for inspection/replay

## Conventions

- ESM throughout (`"type": "module"`)
- Tailwind config and PostCSS config at project root (not in client/)
- Vite dev server proxies `/api` to Express backend
- Server saves SQLite to `data/relay.db` (gitignored)
- Default port 3004
