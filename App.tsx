import React, { useEffect, useState } from 'react';
import AdminClients from './components/admin/AdminClients';
import MondayPlayground from './components/admin/MondayPlayground';
import CasePortal from './components/cases/CasePortal';

const getCurrentHash = () => window.location.hash || '#/';

const App: React.FC = () => {
  const [hash, setHash] = useState(getCurrentHash);

  useEffect(() => {
    const handleHashChange = () => setHash(getCurrentHash());
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const route = hash.split('?')[0];
  const caseRouteMatch = route.match(/^#\/casos\/([^/?]+)/);

  if (route === '#/admin/clientes') {
    return <AdminClients />;
  }

  if (route === '#/admin/monday') {
    return <MondayPlayground />;
  }

  if (caseRouteMatch) {
    return <CasePortal token={decodeURIComponent(caseRouteMatch[1])} />;
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
      <div className="max-w-xl text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-sky-300">Portal de Casos</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">Use o link exclusivo do cliente</h1>
        <p className="mt-4 text-slate-300">
          Cada dentista acessa o portal por um link proprio no formato
          {' '}<span className="font-mono text-sky-200">#/casos/token-do-cliente</span>.
        </p>
      </div>
    </main>
  );
};

export default App;
