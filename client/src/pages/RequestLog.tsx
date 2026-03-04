import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listRequests, clearRequests, type CapturedRequest } from '../lib/api';
import RequestRow from '../components/RequestRow';

const METHODS = ['ALL', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;

export default function RequestLog() {
  const { tunnelId } = useParams<{ tunnelId: string }>();
  const [requests, setRequests] = useState<CapturedRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!tunnelId) return;

    const fetchRequests = async () => {
      try {
        const data = await listRequests(tunnelId);
        setRequests(data);
      } catch {
        // Silently fail on polling errors
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
    const interval = setInterval(fetchRequests, 2000);
    return () => clearInterval(interval);
  }, [tunnelId]);

  const filtered = useMemo(() => {
    return requests.filter((req) => {
      if (methodFilter !== 'ALL' && req.method !== methodFilter) return false;
      if (search && !req.path.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [requests, methodFilter, search]);

  const handleClear = async () => {
    if (!tunnelId) return;
    try {
      await clearRequests(tunnelId);
      setRequests([]);
    } catch {
      // ignore
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
        <button
          onClick={() => navigate('/')}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Request Log</h1>
        <span className="text-xs text-zinc-500 font-mono bg-zinc-800 px-2 py-1 rounded">
          {requests.length} request{requests.length !== 1 ? 's' : ''}
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Live
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 border-b border-zinc-800/50 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1">
          {METHODS.map((m) => (
            <button
              key={m}
              onClick={() => setMethodFilter(m)}
              className={`px-2 py-1 rounded text-xs font-mono transition-colors ${
                methodFilter === m
                  ? 'bg-cyan-500/20 text-cyan-400'
                  : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Filter by path..."
          className="flex-1 min-w-[160px] max-w-xs bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500/50 font-mono"
        />
        {requests.length > 0 && (
          <button
            onClick={handleClear}
            className="px-2 py-1 text-xs text-zinc-500 hover:text-red-400 hover:bg-red-900/20 rounded transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 text-zinc-500 text-sm">Loading requests...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
            <svg className="w-10 h-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm">{requests.length > 0 ? 'No matching requests' : 'No requests yet'}</p>
            <p className="text-xs mt-1">{requests.length > 0 ? 'Try adjusting your filters' : 'Waiting for incoming traffic...'}</p>
          </div>
        ) : (
          <div>
            {filtered.map((req) => (
              <RequestRow
                key={req.id}
                request={req}
                onClick={() => navigate(`/request/${req.id}`)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
