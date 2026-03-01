import { useState } from 'react';
import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import RequestLog from './pages/RequestLog';
import RequestDetail from './pages/RequestDetail';

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <>
      {open && (
        <div className="fixed inset-0 bg-black/60 z-40 md:hidden" onClick={onClose} />
      )}
      <aside className={`
        fixed md:static inset-y-0 left-0 z-50 w-56 border-r border-zinc-800 flex flex-col shrink-0 bg-black
        transform transition-transform md:translate-x-0
        ${open ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="px-4 py-4 border-b border-zinc-800">
          <Link to="/" className="flex items-center gap-2 group" onClick={onClose}>
            <svg className="w-6 h-6 text-cyan-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="6" opacity="0.4" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <polyline points="18,8 22,12 18,16" />
            </svg>
            <span className="font-semibold text-lg tracking-tight">
              zahki<span className="text-cyan-400">relay</span>
            </span>
          </Link>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-1">
          <Link
            to="/"
            onClick={onClose}
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
              isActive('/') && !location.pathname.startsWith('/tunnel') && !location.pathname.startsWith('/request')
                ? 'bg-zinc-800 text-white'
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
            Tunnels
          </Link>
        </nav>
        <div className="px-4 py-3 border-t border-zinc-800">
          <p className="text-xs text-zinc-600">zahki-relay v1.0.0</p>
        </div>
      </aside>
    </>
  );
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-black text-white flex">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="flex-1 overflow-auto">
        {/* Mobile header */}
        <div className="md:hidden flex items-center gap-3 p-4 border-b border-zinc-800">
          <button onClick={() => setSidebarOpen(true)} className="text-zinc-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
          <span className="font-semibold text-lg tracking-tight">
            zahki<span className="text-cyan-400">relay</span>
          </span>
        </div>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/tunnel/:tunnelId" element={<RequestLog />} />
          <Route path="/request/:requestId" element={<RequestDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="*" element={<AppLayout />} />
      </Routes>
    </BrowserRouter>
  );
}
