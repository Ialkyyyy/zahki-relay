import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb, saveDb } from '../db.js';
import { tunnelManager } from '../tunnel.js';

export const requestsRouter = Router();

// List captured requests for a tunnel
requestsRouter.get('/:tunnelId', (req, res) => {
  const db = getDb();
  const { tunnelId } = req.params;

  // Verify tunnel exists
  const tunnel = db.exec(`SELECT id FROM tunnels WHERE id = ?`, [tunnelId]);
  if (tunnel.length === 0 || tunnel[0].values.length === 0) {
    res.status(404).json({ error: 'Tunnel not found' });
    return;
  }

  const result = db.exec(
    `SELECT id, method, path, headers, body, status_code, response_time, created_at FROM requests WHERE tunnel_id = ? ORDER BY created_at DESC LIMIT 200`,
    [tunnelId]
  );

  if (result.length === 0) {
    res.json([]);
    return;
  }

  const requests = result[0].values.map((row) => ({
    id: row[0],
    method: row[1],
    path: row[2],
    headers: JSON.parse((row[3] as string) || '{}'),
    body: row[4],
    statusCode: row[5],
    responseTime: row[6],
    createdAt: row[7],
  }));

  res.json(requests);
});

// Get a single request detail
requestsRouter.get('/detail/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const result = db.exec(
    `SELECT id, tunnel_id, method, path, headers, body, status_code, response_headers, response_body, response_time, created_at FROM requests WHERE id = ?`,
    [id]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  const row = result[0].values[0];
  res.json({
    id: row[0],
    tunnelId: row[1],
    method: row[2],
    path: row[3],
    headers: JSON.parse((row[4] as string) || '{}'),
    body: row[5],
    statusCode: row[6],
    responseHeaders: JSON.parse((row[7] as string) || '{}'),
    responseBody: row[8],
    responseTime: row[9],
    createdAt: row[10],
  });
});

// Clear all requests for a tunnel
requestsRouter.delete('/:tunnelId/clear', (req, res) => {
  const db = getDb();
  const { tunnelId } = req.params;

  const tunnel = db.exec(`SELECT id FROM tunnels WHERE id = ?`, [tunnelId]);
  if (tunnel.length === 0 || tunnel[0].values.length === 0) {
    res.status(404).json({ error: 'Tunnel not found' });
    return;
  }

  db.run(`DELETE FROM requests WHERE tunnel_id = ?`, [tunnelId]);
  saveDb();
  res.json({ ok: true });
});

// Replay a captured request
requestsRouter.post('/:id/replay', async (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const result = db.exec(
    `SELECT r.method, r.path, r.headers, r.body, t.subdomain FROM requests r JOIN tunnels t ON r.tunnel_id = t.id WHERE r.id = ?`,
    [id]
  );

  if (result.length === 0 || result[0].values.length === 0) {
    res.status(404).json({ error: 'Request not found' });
    return;
  }

  const row = result[0].values[0];
  const method = row[0] as string;
  const path = row[1] as string;
  const headers = JSON.parse((row[2] as string) || '{}');
  const body = row[3] as string;
  const subdomain = row[4] as string;

  if (!tunnelManager.isConnected(subdomain)) {
    res.status(502).json({ error: 'Tunnel not connected' });
    return;
  }

  try {
    const response = await tunnelManager.forwardRequest(subdomain, method, path, headers, body);
    res.json({
      statusCode: response.status,
      headers: response.headers,
      body: response.body,
    });
  } catch (err) {
    res.status(504).json({ error: err instanceof Error ? err.message : 'Request failed' });
  }
});
