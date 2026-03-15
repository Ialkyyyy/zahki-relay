import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
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
// API routes
app.use('/api/tunnels', tunnelsRouter);
app.use('/api/requests', requestsRouter);
// Path-based tunnel routing: /t/:subdomain/*
app.all('/t/:subdomain/*', async (req, res) => {
    const { subdomain } = req.params;
    // Extract the path after /t/subdomain
    const tunnelPath = '/' + (req.params[0] || '');
    if (!tunnelManager.isConnected(subdomain)) {
        res.status(502).json({ error: 'Tunnel not connected', subdomain });
        return;
    }
    // Collect headers (exclude host and some hop-by-hop headers)
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string' && !['host', 'connection', 'upgrade'].includes(key)) {
            forwardHeaders[key] = value;
        }
    }
    // Get request body as string
    let body = '';
    if (typeof req.body === 'string') {
        body = req.body;
    }
    else if (req.body && typeof req.body === 'object') {
        body = JSON.stringify(req.body);
    }
    try {
        const response = await tunnelManager.forwardRequest(subdomain, req.method, tunnelPath, forwardHeaders, body);
        // Set response headers
        for (const [key, value] of Object.entries(response.headers)) {
            if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        }
        res.status(response.status).send(response.body);
    }
    catch (err) {
        res.status(504).json({ error: err instanceof Error ? err.message : 'Tunnel request failed' });
    }
});
// Also handle /t/:subdomain without trailing path
app.all('/t/:subdomain', async (req, res) => {
    const { subdomain } = req.params;
    if (!tunnelManager.isConnected(subdomain)) {
        res.status(502).json({ error: 'Tunnel not connected', subdomain });
        return;
    }
    const forwardHeaders = {};
    for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === 'string' && !['host', 'connection', 'upgrade'].includes(key)) {
            forwardHeaders[key] = value;
        }
    }
    let body = '';
    if (typeof req.body === 'string') {
        body = req.body;
    }
    else if (req.body && typeof req.body === 'object') {
        body = JSON.stringify(req.body);
    }
    try {
        const response = await tunnelManager.forwardRequest(subdomain, req.method, '/', forwardHeaders, body);
        for (const [key, value] of Object.entries(response.headers)) {
            if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
                res.setHeader(key, value);
            }
        }
        res.status(response.status).send(response.body);
    }
    catch (err) {
        res.status(504).json({ error: err instanceof Error ? err.message : 'Tunnel request failed' });
    }
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
    wss.on('connection', (ws) => {
        let authenticated = false;
        let subdomain = null;
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
                        subdomain = result[0].values[0][0];
                        clearTimeout(authTimeout);
                        tunnelManager.registerConnection(subdomain, ws);
                        ws.send(JSON.stringify({ type: 'auth_ok', subdomain }));
                    }
                    else {
                        ws.send(JSON.stringify({ type: 'auth_error', error: 'Invalid API key' }));
                        ws.close(4003, 'Invalid API key');
                    }
                }
            }
            catch {
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
