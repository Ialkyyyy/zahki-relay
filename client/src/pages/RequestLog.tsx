import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { listRequests, type CapturedRequest } from '../lib/api';
import RequestRow from '../components/RequestRow';

export default function RequestLog() {
  const { tunnelId } = useParams<{ tunnelId: string }>();
  const [requests, setRequests] = useState<CapturedRequest[]>([]);
  const [loading, setLoading] = useState(true);
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
          {tunnelId?.substring(0, 12)}...
        </span>
        <div className="flex-1" />
        <div className="flex items-center gap-2 text-xs text-zinc-500">
          <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
          Live
        </div>
      </div>

      <div className="flex-1 overflow-auto">
        {loading ? (
          <div className="p-6 text-zinc-500 text-sm">Loading requests...</div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-zinc-600">
            <svg className="w-10 h-10 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1">
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm">No requests yet</p>
            <p className="text-xs mt-1">Waiting for incoming traffic...</p>
          </div>
        ) : (
          <div>
            {requests.map((req) => (
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
