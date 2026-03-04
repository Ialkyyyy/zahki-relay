const BASE = '/api';

export interface Tunnel {
  id: string;
  subdomain: string;
  apiKey?: string;
  createdAt: string;
  connected: boolean;
}

export interface CapturedRequest {
  id: string;
  tunnelId?: string;
  method: string;
  path: string;
  headers: Record<string, string>;
  body: string | null;
  statusCode: number | null;
  responseTime: number | null;
  createdAt: string;
}

export interface ReplayResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export async function createTunnel(subdomain?: string): Promise<Tunnel & { apiKey: string }> {
  const res = await fetch(`${BASE}/tunnels`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(subdomain ? { subdomain } : {}),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create tunnel');
  }
  return res.json();
}

export async function listTunnels(): Promise<Tunnel[]> {
  const res = await fetch(`${BASE}/tunnels`);
  if (!res.ok) throw new Error('Failed to list tunnels');
  return res.json();
}

export async function deleteTunnel(id: string): Promise<void> {
  const res = await fetch(`${BASE}/tunnels/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to delete tunnel');
}

export async function listRequests(tunnelId: string): Promise<CapturedRequest[]> {
  const res = await fetch(`${BASE}/requests/${tunnelId}`);
  if (!res.ok) throw new Error('Failed to list requests');
  return res.json();
}

export async function clearRequests(tunnelId: string): Promise<void> {
  const res = await fetch(`${BASE}/requests/${tunnelId}/clear`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Failed to clear requests');
}

export async function getRequestDetail(id: string): Promise<CapturedRequest> {
  const res = await fetch(`${BASE}/requests/detail/${id}`);
  if (!res.ok) throw new Error('Failed to get request');
  return res.json();
}

export async function replayRequest(id: string): Promise<ReplayResponse> {
  const res = await fetch(`${BASE}/requests/${id}/replay`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to replay request');
  }
  return res.json();
}
