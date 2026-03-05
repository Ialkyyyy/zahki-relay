import { Router } from 'express';
import { nanoid } from 'nanoid';
import { getDb, saveDb } from '../db.js';
import { tunnelManager } from '../tunnel.js';

export const tunnelsRouter = Router();

// Create a new tunnel
tunnelsRouter.post('/', (req, res) => {
  const db = getDb();
  const requestedSubdomain = req.body.subdomain;

  let subdomain: string;
  if (requestedSubdomain) {
    // Validate subdomain format
    if (!/^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/.test(requestedSubdomain)) {
      res.status(400).json({ error: 'Subdomain must be 3-32 lowercase alphanumeric characters or hyphens, cannot start or end with a hyphen' });
      return;
    }
    // Check availability
    const existing = db.exec(`SELECT id FROM tunnels WHERE subdomain = ?`, [requestedSubdomain]);
    if (existing.length > 0 && existing[0].values.length > 0) {
      res.status(409).json({ error: 'Subdomain already taken' });
      return;
    }
    subdomain = requestedSubdomain;
  } else {
    subdomain = nanoid(8).toLowerCase().replace(/[^a-z0-9]/g, 'x');
  }

  const id = nanoid();
  const apiKey = nanoid(32);

  db.run(
    `INSERT INTO tunnels (id, subdomain, api_key) VALUES (?, ?, ?)`,
    [id, subdomain, apiKey]
  );
  saveDb();

  res.status(201).json({ id, subdomain, apiKey });
});

// List all tunnels
tunnelsRouter.get('/', (_req, res) => {
  const db = getDb();
  const result = db.exec(`
    SELECT t.id, t.subdomain, t.created_at,
      (SELECT COUNT(*) FROM requests r WHERE r.tunnel_id = t.id) as request_count
    FROM tunnels t ORDER BY t.created_at DESC
  `);

  if (result.length === 0) {
    res.json([]);
    return;
  }

  const tunnels = result[0].values.map((row) => ({
    id: row[0],
    subdomain: row[1],
    createdAt: row[2],
    connected: tunnelManager.isConnected(row[1] as string),
    requestCount: row[3],
  }));

  res.json(tunnels);
});

// Delete a tunnel
tunnelsRouter.delete('/:id', (req, res) => {
  const db = getDb();
  const { id } = req.params;

  const existing = db.exec(`SELECT subdomain FROM tunnels WHERE id = ?`, [id]);
  if (existing.length === 0 || existing[0].values.length === 0) {
    res.status(404).json({ error: 'Tunnel not found' });
    return;
  }

  db.run(`DELETE FROM requests WHERE tunnel_id = ?`, [id]);
  db.run(`DELETE FROM tunnels WHERE id = ?`, [id]);
  saveDb();

  res.json({ ok: true });
});
