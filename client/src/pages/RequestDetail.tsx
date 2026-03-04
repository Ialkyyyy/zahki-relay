import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getRequestDetail, replayRequest, type CapturedRequest, type ReplayResponse } from '../lib/api';

function formatBody(body: string | null): string {
  if (!body) return '';
  try {
    return JSON.stringify(JSON.parse(body), null, 2);
  } catch {
    return body;
  }
}

function toCurl(req: CapturedRequest): string {
  const parts = [`curl -X ${req.method}`];
  for (const [key, value] of Object.entries(req.headers)) {
    if (!['host', 'connection', 'content-length'].includes(key.toLowerCase())) {
      parts.push(`  -H '${key}: ${value}'`);
    }
  }
  if (req.body && !['GET', 'HEAD'].includes(req.method)) {
    parts.push(`  -d '${req.body.replace(/'/g, "'\\''")}'`);
  }
  parts.push(`  'http://localhost${req.path}'`);
  return parts.join(' \\\n');
}

function HeaderTable({ headers }: { headers: Record<string, string> }) {
  const entries = Object.entries(headers);
  if (entries.length === 0) {
    return <p className="text-zinc-600 text-sm">No headers</p>;
  }
  return (
    <div className="space-y-1">
      {entries.map(([key, value]) => (
        <div key={key} className="flex gap-2 text-sm font-mono">
          <span className="text-cyan-400/70 shrink-0">{key}:</span>
          <span className="text-zinc-400 break-all">{value}</span>
        </div>
      ))}
    </div>
  );
}

export default function RequestDetail() {
  const { requestId } = useParams<{ requestId: string }>();
  const [request, setRequest] = useState<CapturedRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [replaying, setReplaying] = useState(false);
  const [replayResult, setReplayResult] = useState<ReplayResponse | null>(null);
  const [replayError, setReplayError] = useState('');
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!requestId) return;
    getRequestDetail(requestId)
      .then(setRequest)
      .catch(() => setRequest(null))
      .finally(() => setLoading(false));
  }, [requestId]);

  const handleReplay = async () => {
    if (!requestId) return;
    setReplaying(true);
    setReplayError('');
    setReplayResult(null);
    try {
      const result = await replayRequest(requestId);
      setReplayResult(result);
    } catch (err) {
      setReplayError(err instanceof Error ? err.message : 'Replay failed');
    } finally {
      setReplaying(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-zinc-500 text-sm">Loading...</div>;
  }

  if (!request) {
    return <div className="p-6 text-zinc-500 text-sm">Request not found</div>;
  }

  const statusColor = !request.statusCode
    ? 'text-zinc-400'
    : request.statusCode < 300
      ? 'text-green-400'
      : request.statusCode < 400
        ? 'text-yellow-400'
        : 'text-red-400';

  return (
    <div className="h-full overflow-auto">
      {/* Header */}
      <div className="px-6 py-4 border-b border-zinc-800 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-semibold">Request Detail</h1>
        <div className="flex-1" />
        <button
          onClick={() => {
            if (!request) return;
            navigator.clipboard.writeText(toCurl(request));
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          }}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 rounded-lg text-zinc-300 font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
          </svg>
          {copied ? 'Copied!' : 'cURL'}
        </button>
        <button
          onClick={handleReplay}
          disabled={replaying}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-cyan-600 hover:bg-cyan-500 disabled:bg-zinc-700 disabled:text-zinc-500 rounded-lg font-medium transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
          {replaying ? 'Replaying...' : 'Replay'}
        </button>
      </div>

      <div className="p-6 space-y-6 max-w-4xl">
        {/* Summary */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-2 py-1 rounded text-sm font-mono font-bold bg-cyan-500/20 text-cyan-400">
              {request.method}
            </span>
            <span className="text-sm font-mono text-zinc-300">{request.path}</span>
            <div className="flex-1" />
            <span className={`font-mono font-bold text-lg ${statusColor}`}>
              {request.statusCode ?? '---'}
            </span>
            {request.responseTime !== null && (
              <span className="text-sm text-zinc-500 font-mono">{request.responseTime}ms</span>
            )}
          </div>
          <p className="text-xs text-zinc-600 font-mono">
            {new Date(request.createdAt + 'Z').toLocaleString()}
          </p>
        </div>

        {/* Request Headers */}
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
          <h3 className="text-sm font-medium text-zinc-400 mb-3">Request Headers</h3>
          <HeaderTable headers={request.headers} />
        </div>

        {/* Request Body */}
        {request.body && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
            <h3 className="text-sm font-medium text-zinc-400 mb-3">Request Body</h3>
            <pre className="bg-black/50 rounded-lg p-4 text-sm text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
              {formatBody(request.body)}
            </pre>
          </div>
        )}

        {/* Replay Result */}
        {replayError && (
          <div className="bg-red-950/30 border border-red-800/50 rounded-xl p-5">
            <p className="text-sm text-red-400">{replayError}</p>
          </div>
        )}

        {replayResult && (
          <div className="bg-cyan-950/20 border border-cyan-800/30 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium text-cyan-400">Replay Response</h3>
              <span className={`font-mono text-sm font-bold ${
                replayResult.statusCode < 300 ? 'text-green-400' : replayResult.statusCode < 400 ? 'text-yellow-400' : 'text-red-400'
              }`}>
                {replayResult.statusCode}
              </span>
            </div>
            <div>
              <h4 className="text-xs font-medium text-zinc-500 mb-2">Response Headers</h4>
              <HeaderTable headers={replayResult.headers} />
            </div>
            {replayResult.body && (
              <div>
                <h4 className="text-xs font-medium text-zinc-500 mb-2">Response Body</h4>
                <pre className="bg-black/50 rounded-lg p-4 text-sm text-zinc-300 font-mono overflow-x-auto whitespace-pre-wrap break-all">
                  {formatBody(replayResult.body)}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
