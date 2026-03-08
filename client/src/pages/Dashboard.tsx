import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { listTunnels, createTunnel, deleteTunnel, type Tunnel } from '../lib/api';

export default function Dashboard() {
  const [tunnels, setTunnels] = useState<Tunnel[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [subdomain, setSubdomain] = useState('');
  const [error, setError] = useState('');
  const [newTunnelKey, setNewTunnelKey] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchTunnels = async () => {
    try {
      const data = await listTunnels();
      setTunnels(data);
    } catch {
      setError('Failed to load tunnels');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTunnels();
    const interval = setInterval(fetchTunnels, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleCreate = async () => {
    setError('');
    setCreating(true);
    try {
      const tunnel = await createTunnel(subdomain || undefined);
      setNewTunnelKey(tunnel.apiKey);
      setSubdomain('');
      await fetchTunnels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create tunnel');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTunnel(id);
      await fetchTunnels();
    } catch {
      setError('Failed to delete tunnel');
    }
  };

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tunnels</h1>
      </div>

      {/* Create tunnel form */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5 mb-6">
        <h2 className="text-sm font-medium text-zinc-400 mb-3">Create New Tunnel</h2>
        <div className="flex gap-3">
          <input
            type="text"
            value={subdomain}
            onChange={(e) => setSubdomain(e.target.value.toLowerCase())}
            placeholder="custom-subdomain (optional)"
            className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 focus:ring-1 focus:ring-cyan-500/20 font-mono"
          />
          <button
            onClick={handleCreate}
            disabled={creating}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg text-sm font-medium transition-colors"
          >
            {creating ? 'Creating...' : 'Create Tunnel'}
          </button>
        </div>
        {error && (
          <p className="mt-2 text-sm text-red-400">{error}</p>
        )}
      </div>

      {/* Show API key for newly created tunnel */}
      {newTunnelKey && (
        <div className="bg-cyan-950/30 border border-cyan-800/50 rounded-xl p-5 mb-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-medium text-cyan-400 mb-1">Tunnel Created</h3>
              <p className="text-xs text-zinc-400 mb-3">
                Save this API key -- it won't be shown again. Use it to connect the CLI client.
              </p>
              <code className="block bg-black/50 rounded-lg px-3 py-2 text-sm text-cyan-300 font-mono break-all">
                {newTunnelKey}
              </code>
              <p className="text-xs text-zinc-500 mt-3 font-mono">
                npx zahki-relay start 3000 --server {window.location.origin}
              </p>
            </div>
            <button
              onClick={() => setNewTunnelKey(null)}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Tunnels list */}
      {loading ? (
        <div className="text-zinc-500 text-sm">Loading tunnels...</div>
      ) : tunnels.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-zinc-600 mb-2">
            <svg className="w-12 h-12 mx-auto" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </div>
          <p className="text-zinc-500 text-sm">No tunnels yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tunnels.map((tunnel) => (
            <div
              key={tunnel.id}
              className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4 flex items-center gap-4 hover:border-zinc-700 transition-colors"
            >
              <div
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  tunnel.connected ? 'bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]' : 'bg-zinc-600'
                }`}
              />
              <div className="flex-1 min-w-0">
                <button
                  onClick={() => navigate(`/tunnel/${tunnel.id}`)}
                  className="text-sm font-mono text-white hover:text-cyan-400 transition-colors"
                >
                  {tunnel.subdomain}
                </button>
                <p className="text-xs text-zinc-500 mt-0.5">
                  {tunnel.connected ? 'Connected' : 'Disconnected'} -- Created {new Date(tunnel.createdAt + 'Z').toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => navigate(`/tunnel/${tunnel.id}`)}
                className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 transition-colors"
              >
                View Requests
              </button>
              <button
                onClick={() => handleDelete(tunnel.id)}
                className="px-3 py-1.5 text-xs bg-zinc-800 hover:bg-red-900/50 hover:text-red-400 rounded-lg text-zinc-500 transition-colors"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
