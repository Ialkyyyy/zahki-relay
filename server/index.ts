import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { initDb, getDb } from './db.js';
import { tunnelsRouter } from './routes/tunnels.js';
import { requestsRouter } from './routes/requests.js';
import { tunnelManager } from './tunnel.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3004;

app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(express.text({ limit: '5mb', type: '*/*' }));

// Detect tunnel subdomain from Host header (e.g. t-myapp.alkhabaz.dev → myapp)
const BASE_DOMAIN = process.env.BASE_DOMAIN || 'alkhabaz.dev';
const TUNNEL_PREFIX = 't-';

function getTunnelSubdomain(host: string | undefined): string | null {
  if (!host) return null;
  const hostname = host.split(':')[0];
  // Check for t-<subdomain>.alkhabaz.dev pattern
  if (hostname.endsWith(`.${BASE_DOMAIN}`)) {
    const sub = hostname.slice(0, -(BASE_DOMAIN.length + 1));
    if (sub.startsWith(TUNNEL_PREFIX) && !sub.includes('.')) {
      return sub.slice(TUNNEL_PREFIX.length);
    }
  }
  return null;
}

// Subdomain-based tunnel routing — runs before everything else
app.use((req, res, next) => {
  const tunnelSub = getTunnelSubdomain(req.headers.host);
  if (!tunnelSub) return next();

  // This request is for a tunnel subdomain — forward it entirely
  if (!tunnelManager.isConnected(tunnelSub)) {
    res.status(502).json({ error: 'Tunnel not connected', subdomain: tunnelSub });
    return;
  }

  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string' && !['host', 'connection', 'upgrade'].includes(key.toLowerCase())) {
      forwardHeaders[key] = value;
    }
  }

  let body = '';
  if (typeof req.body === 'string') {
    body = req.body;
  } else if (req.body && typeof req.body === 'object') {
    body = JSON.stringify(req.body);
  }

  tunnelManager.forwardRequest(tunnelSub, req.method, req.originalUrl, forwardHeaders, body)
    .then((response) => {
      for (const [key, value] of Object.entries(response.headers)) {
        if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }
      res.status(response.status).send(response.body);
    })
    .catch((err) => {
      res.status(504).json({ error: err instanceof Error ? err.message : 'Tunnel request failed' });
    });
});

// API routes (only reached for relay.alkhabaz.dev, not tunnel subdomains)
app.use('/api/tunnels', tunnelsRouter);
app.use('/api/requests', requestsRouter);

// Path-based tunnel routing (legacy fallback)
function handlePathTunnel(req: import('express').Request, res: import('express').Response, tunnelPath: string) {
  const subdomain = req.params.subdomain as string;

  if (!tunnelManager.isConnected(subdomain)) {
    res.status(502).json({ error: 'Tunnel not connected', subdomain });
    return;
  }

  const forwardHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string' && !['host', 'connection', 'upgrade'].includes(key.toLowerCase())) {
      forwardHeaders[key] = value;
    }
  }

  let body = '';
  if (typeof req.body === 'string') {
    body = req.body;
  } else if (req.body && typeof req.body === 'object') {
    body = JSON.stringify(req.body);
  }

  tunnelManager.forwardRequest(subdomain, req.method, tunnelPath, forwardHeaders, body)
    .then((response) => {
      for (const [key, value] of Object.entries(response.headers)) {
        if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
          res.setHeader(key, value);
        }
      }
      res.status(response.status).send(response.body);
    })
    .catch((err) => {
      res.status(504).json({ error: err instanceof Error ? err.message : 'Tunnel request failed' });
    });
}

app.all('/t/:subdomain/*', (req, res) => {
  const tunnelPath = '/' + ((req.params as any)[0] || '');
  handlePathTunnel(req, res, tunnelPath);
});

app.all('/t/:subdomain', (req, res) => {
  handlePathTunnel(req, res, '/');
});

// Serve static client in production
import fs from 'fs';
const clientDist = path.join(__dirname, '..', 'client', 'dist');
const clientDistAlt = path.join(__dirname, '..', '..', 'client', 'dist');
const staticDir = fs.existsSync(clientDist) ? clientDist : clientDistAlt;
app.use(express.static(staticDir));
app.get('*', (_req, res) => {
  res.sendFile(path.join(staticDir, 'index.html'));
});

// Initialize and start
async function start() {
  await initDb();

  const server = createServer(app);

  // WebSocket server for tunnel connections
  const wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws: WebSocket) => {
    let authenticated = false;
    let subdomain: string | null = null;

    // Set a timeout for authentication
    const authTimeout = setTimeout(() => {
      if (!authenticated) {
        ws.close(4001, 'Authentication timeout');
      }
    }, 10000);

    ws.on('message', (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'auth' && msg.apiKey) {
          const db = getDb();
          const result = db.exec(`SELECT subdomain FROM tunnels WHERE api_key = ?`, [msg.apiKey]);

          if (result.length > 0 && result[0].values.length > 0) {
            authenticated = true;
            subdomain = result[0].values[0][0] as string;
            clearTimeout(authTimeout);

            tunnelManager.registerConnection(subdomain, ws);

            ws.send(JSON.stringify({ type: 'auth_ok', subdomain }));
          } else {
            ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid API key' }));
            ws.close(4003, 'Invalid API key');
          }
        }
      } catch {
        // Ignore malformed messages
      }
    });

    ws.on('close', () => {
      clearTimeout(authTimeout);
    });
  });

  server.listen(PORT, () => {
    console.log(`zahki-relay running on http://localhost:${PORT}`);
  });
}

start();
