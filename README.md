# zahki-relay

Expose localhost to the internet. Inspect, replay, and debug HTTP requests in real time.

## Install

```
npm install -g zahki-relay
```

Or run directly:

```
npx zahki-relay start 3000
```

## Quick Start

**1. Start the relay server:**

```bash
zahki-relay server
# Server running on http://localhost:3004
```

**2. Connect a tunnel:**

```bash
zahki-relay start 3000
# ● Tunnel active
# Public URL:  http://localhost:3004/t/a8xk2m1p
# Forwarding:  http://localhost:3000
```

**3. Send requests to the public URL** — they get forwarded to your local server and logged in the web dashboard.

## Features

- **Localhost tunneling** — expose any local port through a public URL via WebSockets
- **Request inspector** — view method, headers, body, status, and response time for every request
- **One-click replay** — re-send any captured request to your local server
- **cURL export** — copy any request as a cURL command
- **Filter and search** — filter by HTTP method, search by path
- **Web dashboard** — full React UI for managing tunnels and inspecting traffic
- **Self-hosted** — run your own relay server, no third-party dependencies

## CLI

```
Usage: zahki-relay [command]

Commands:
  start <port>   Connect a tunnel to forward traffic to localhost
  server         Start the relay server with web dashboard

Options:
  -V, --version  Show version number

Start options:
  -s, --server <url>      Relay server URL (default: http://localhost:3004)
  -d, --subdomain <name>  Request a specific subdomain

Server options:
  -p, --port <port>       Port to listen on (default: 3004)
```

### Examples

```bash
# Expose port 8080
zahki-relay start 8080

# Use a custom subdomain
zahki-relay start 3000 --subdomain my-app

# Connect to a remote relay server
zahki-relay start 3000 --server https://relay.example.com

# Start server on a custom port
zahki-relay server --port 8000
```

## Self-Hosting

### Docker

```bash
docker compose up -d
```

### Manual

```bash
git clone https://github.com/Ialkyyyy/zahki-relay.git
cd zahki-relay
npm install
npm run build
npm start
```

The server starts on port 3004 by default. Set `PORT` env var to change it.

## How It Works

1. The relay server runs Express + WebSocket on a single port
2. CLI creates a tunnel and authenticates via WebSocket
3. Incoming HTTP requests to `/t/:subdomain/*` are forwarded through the WebSocket to the CLI
4. CLI forwards them to your local server and sends the response back
5. Every request is logged to SQLite and visible in the web dashboard

## Stack

Express, WebSocket, SQLite (sql.js), React, Tailwind CSS, TypeScript

## License

MIT
