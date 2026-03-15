import { nanoid } from 'nanoid';
import { getDb, saveDb } from './db.js';
export class TunnelManager {
    connections = new Map();
    pendingRequests = new Map();
    REQUEST_TIMEOUT = 30000;
    registerConnection(subdomain, ws) {
        const existing = this.connections.get(subdomain);
        if (existing) {
            existing.close(1000, 'Replaced by new connection');
        }
        this.connections.set(subdomain, ws);
        console.log(`Tunnel connected: ${subdomain}`);
        ws.on('close', () => {
            if (this.connections.get(subdomain) === ws) {
                this.connections.delete(subdomain);
                console.log(`Tunnel disconnected: ${subdomain}`);
            }
        });
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                if (msg.type === 'response' && msg.id) {
                    this.handleResponse(msg);
                }
            }
            catch {
                // Ignore malformed messages
            }
        });
    }
    handleResponse(msg) {
        const pending = this.pendingRequests.get(msg.id);
        if (pending) {
            clearTimeout(pending.timer);
            this.pendingRequests.delete(msg.id);
            pending.resolve({
                status: msg.status,
                headers: msg.headers || {},
                body: msg.body || '',
            });
        }
    }
    isConnected(subdomain) {
        const ws = this.connections.get(subdomain);
        return !!ws && ws.readyState === ws.OPEN;
    }
    getActiveSubdomains() {
        const active = [];
        for (const [subdomain, ws] of this.connections) {
            if (ws.readyState === ws.OPEN) {
                active.push(subdomain);
            }
        }
        return active;
    }
    async forwardRequest(subdomain, method, reqPath, headers, body) {
        const ws = this.connections.get(subdomain);
        if (!ws || ws.readyState !== ws.OPEN) {
            throw new Error('Tunnel not connected');
        }
        const id = nanoid();
        const startTime = Date.now();
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error('Request timed out'));
            }, this.REQUEST_TIMEOUT);
            this.pendingRequests.set(id, { resolve, reject, timer });
            ws.send(JSON.stringify({
                type: 'request',
                id,
                method,
                path: reqPath,
                headers,
                body,
            }));
        }).then((response) => {
            const responseTime = Date.now() - startTime;
            // Log request to database
            const db = getDb();
            const tunnel = db.exec(`SELECT id FROM tunnels WHERE subdomain = ?`, [subdomain]);
            if (tunnel.length > 0 && tunnel[0].values.length > 0) {
                const tunnelId = tunnel[0].values[0][0];
                const reqId = nanoid();
                db.run(`INSERT INTO requests (id, tunnel_id, method, path, headers, body, status_code, response_time) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [reqId, tunnelId, method, reqPath, JSON.stringify(headers), body || null, response.status, responseTime]);
                saveDb();
            }
            return response;
        });
    }
}
export const tunnelManager = new TunnelManager();
