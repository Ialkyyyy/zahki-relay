# zahki-relay

[![License: MIT](https://img.shields.io/badge/License-MIT-violet.svg)](LICENSE)
[![npm](https://img.shields.io/npm/v/zahki-relay.svg)](https://www.npmjs.com/package/zahki-relay)

Expose localhost to the internet. Inspect, replay, and debug HTTP requests in real time. Self-hosted alternative to ngrok with a web dashboard for managing tunnels and viewing traffic.

## Quick start

```bash
# Install globally
npm install -g zahki-relay

# Start the relay server
zahki-relay server

# In another terminal, tunnel your local port
zahki-relay start 3000
```

Or skip the install:

```bash
npx zahki-relay start 3000
```

The CLI prints your public URL and logs every request in the terminal with colored status codes and timing.

## How it works

The relay server runs Express and WebSocket on a single port. When you start a tunnel, the CLI connects via WebSocket and authenticates with an API key. Incoming HTTP requests to `/t/:subdomain/*` get forwarded through the WebSocket to the CLI, which sends them to your local server and returns the response. Every request is logged to SQLite and shows up in the web dashboard.

## Features

**Request inspector** — view method, headers, body, status code, and response time for every request that passes through the tunnel. Full request and response details with JSON formatting.

**One-click replay** — re-send any captured request to your local server. See the original and replayed responses side by side.

**cURL export** — copy any request as a ready-to-use cURL command.

**Filter and search** — filter by HTTP method (GET, POST, PUT, etc.), search by path. Live-updating request log with 2-second polling.

**Web dashboard** — full React UI for managing tunnels and inspecting traffic. See connection status, request counts, and tunnel details at a glance.

**Custom subdomains** — request a specific subdomain or let it auto-generate one.

## CLI

```
Usage: zahki-relay [command]

Commands:
  start <port>   Connect a tunnel to forward traffic to localhost
  server         Start the relay server with web dashboard

Start options:
  -s, --server <url>      Relay server URL (default: http://localhost:3004)
  -d, --subdomain <name>  Request a specific subdomain

Server options:
  -p, --port <port>       Port to listen on (default: 3004)
```

```bash
# Expose port 8080
zahki-relay start 8080

# Use a custom subdomain
zahki-relay start 3000 --subdomain my-app

# Connect to a remote relay server
zahki-relay start 3000 --server https://relay.example.com
```

## Self-hosting

```bash
git clone https://github.com/Ialkyyyy/zahki-relay.git
cd zahki-relay
npm install
npm run build
npm start
```

Or use Docker:

```bash
docker compose up -d
```

Runs on port 3004 by default. Set `PORT` to change it.

## Tech stack

Express, WebSocket (ws), sql.js, React, Tailwind CSS, TypeScript. CLI built with Commander. Dockerized with a multi-stage Alpine build.

## Part of the zahki lineup

zahki-relay is one of four security and infrastructure tools in the zahki series — alongside [zahki-ghost](https://github.com/Ialkyyyy/zahki-ghost), [zahki-vault](https://github.com/Ialkyyyy/zahki-vault), and [zahki-radar](https://github.com/Ialkyyyy/zahki-radar).

Check out more at [alkhabaz.dev](https://alkhabaz.dev).

## Contributing

PRs and issues are welcome. Fork it, make your changes, open a pull request.

## License

MIT
