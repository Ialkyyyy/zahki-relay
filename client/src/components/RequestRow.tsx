import type { CapturedRequest } from '../lib/api';

const methodColors: Record<string, string> = {
  GET: 'bg-cyan-500/20 text-cyan-400',
  POST: 'bg-green-500/20 text-green-400',
  PUT: 'bg-yellow-500/20 text-yellow-400',
  PATCH: 'bg-orange-500/20 text-orange-400',
  DELETE: 'bg-red-500/20 text-red-400',
  HEAD: 'bg-purple-500/20 text-purple-400',
  OPTIONS: 'bg-zinc-500/20 text-zinc-400',
};

function statusColor(code: number | null): string {
  if (!code) return 'bg-zinc-700 text-zinc-400';
  if (code < 300) return 'bg-green-500/20 text-green-400';
  if (code < 400) return 'bg-yellow-500/20 text-yellow-400';
  return 'bg-red-500/20 text-red-400';
}

interface Props {
  request: CapturedRequest;
  onClick: () => void;
}

export default function RequestRow({ request, onClick }: Props) {
  const methodClass = methodColors[request.method] || 'bg-zinc-500/20 text-zinc-400';
  const time = new Date(request.createdAt + 'Z').toLocaleTimeString();

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-zinc-900/50 transition-colors text-left border-b border-zinc-800/50"
    >
      <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold shrink-0 ${methodClass}`}>
        {request.method}
      </span>
      <span className="text-sm text-zinc-300 truncate flex-1 font-mono">
        {request.path}
      </span>
      {request.statusCode !== null && (
        <span className={`px-2 py-0.5 rounded text-xs font-mono shrink-0 ${statusColor(request.statusCode)}`}>
          {request.statusCode}
        </span>
      )}
      {request.responseTime !== null && (
        <span className="text-xs text-zinc-500 shrink-0 font-mono w-16 text-right">
          {request.responseTime}ms
        </span>
      )}
      <span className="text-xs text-zinc-600 shrink-0 w-20 text-right">
        {time}
      </span>
    </button>
  );
}
