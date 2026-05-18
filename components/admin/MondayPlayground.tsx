import React, { useEffect, useMemo, useState } from 'react';
import { MondayUser, runMondayPlaygroundQuery, searchMondayUsers } from '../../services/mondayPlaygroundService';

const defaultQuery = `query {
  users(limit: 100) {
    id
    name
    email
    title
    enabled
  }
}`;

const emptyResult = '{\n  "data": null\n}';

const MondayPlayground: React.FC = () => {
  const [password, setPassword] = useState(() => localStorage.getItem('cases_admin_password') || '');
  const [passwordInput, setPasswordInput] = useState(password);
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState<MondayUser[]>([]);
  const [isLoadingUsers, setIsLoadingUsers] = useState(false);
  const [query, setQuery] = useState(defaultQuery);
  const [variablesText, setVariablesText] = useState('{}');
  const [resultText, setResultText] = useState(emptyResult);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const isAuthenticated = Boolean(password);

  const enabledUsersCount = useMemo(
    () => users.filter(user => user.enabled !== false).length,
    [users]
  );

  const copyUserId = async (id: string) => {
    await navigator.clipboard.writeText(id);
    setCopiedId(id);
    window.setTimeout(() => setCopiedId(null), 1400);
  };

  const loadUsers = async () => {
    if (!password) return;
    setIsLoadingUsers(true);
    setError(null);
    try {
      const loadedUsers = await searchMondayUsers(password, search);
      setUsers(loadedUsers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao buscar usuários.');
    } finally {
      setIsLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (password) void loadUsers();
  }, [password]);

  const handleLogin = (event: React.FormEvent) => {
    event.preventDefault();
    localStorage.setItem('cases_admin_password', passwordInput);
    setPassword(passwordInput);
  };

  const handleRunQuery = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const variables = variablesText.trim() ? JSON.parse(variablesText) : {};
      const result = await runMondayPlaygroundQuery(password, query, variables);
      setResultText(JSON.stringify(result, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao executar query.');
    } finally {
      setIsRunning(false);
    }
  };

  if (!isAuthenticated) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-black p-6">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-black" aria-hidden="true">
              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Monday playground</h1>
          <p className="mt-2 text-sm text-zinc-400">Acesso restrito. Entre com a senha admin.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={event => setPasswordInput(event.target.value)}
            autoComplete="current-password"
            className="mt-6 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-zinc-500 focus:border-white/30 focus:ring-2 focus:ring-white/10"
            placeholder="Senha admin"
          />
          <button type="submit" className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition-all hover:bg-zinc-100 active:scale-95">
            Entrar
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f4f9ff] text-[#082653]">
      <header className="sticky top-0 z-20 border-b border-white/80 bg-white/75 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#20a8f5]">Admin</p>
            <h1 className="text-xl font-black tracking-tight">Monday playground</h1>
          </div>
          <div className="flex items-center gap-2">
            <a href="#/admin/clientes" className="rounded-full border border-[#cfe7fb] bg-white px-4 py-2 text-xs font-black text-[#0b3768] shadow-sm transition-colors hover:bg-[#f5fbff]">
              Clientes
            </a>
            <button
              type="button"
              onClick={() => { localStorage.removeItem('cases_admin_password'); setPassword(''); }}
              className="rounded-full border border-[#cfe7fb] bg-white px-4 py-2 text-xs font-black text-[#0b3768] shadow-sm transition-colors hover:bg-[#f5fbff]"
            >
              Sair
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl gap-5 px-4 py-6 sm:px-6 lg:grid-cols-[0.88fr_1.12fr]">
        <section className="rounded-[1.6rem] border border-white/80 bg-white/80 p-5 shadow-[0_18px_50px_rgba(22,78,129,0.1)]">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#20a8f5]">Usuários Monday</p>
              <h2 className="mt-1 text-2xl font-black">Encontrar ID do responsável</h2>
              <p className="mt-1 text-sm font-semibold text-[#6b89ad]">
                Pesquise pelo nome ou e-mail e copie o ID para usar na coluna de pessoa responsável.
              </p>
            </div>
            <span className="rounded-full bg-[#eaf7ff] px-3 py-1.5 text-xs font-black text-[#0b3768]">
              {enabledUsersCount}/{users.length} ativos
            </span>
          </div>

          <form
            onSubmit={event => { event.preventDefault(); void loadUsers(); }}
            className="mt-5 flex gap-2"
          >
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              className="min-w-0 flex-1 rounded-2xl border border-[#cfe7fb] bg-white px-4 py-3 text-sm font-semibold outline-none transition-all placeholder:text-[#91aaca] focus:border-[#20a8f5] focus:ring-4 focus:ring-[#20a8f5]/10"
              placeholder="Buscar nome ou e-mail..."
            />
            <button
              type="submit"
              disabled={isLoadingUsers}
              className="rounded-2xl bg-[#20a8f5] px-5 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(32,168,245,0.22)] transition-all hover:bg-[#1294df] active:scale-95 disabled:opacity-60"
            >
              {isLoadingUsers ? 'Buscando...' : 'Buscar'}
            </button>
          </form>

          <div className="mt-5 max-h-[35rem] space-y-2 overflow-y-auto pr-1">
            {users.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[#cfe7fb] bg-[#f8fcff] p-8 text-center">
                <p className="text-sm font-black text-[#5f82aa]">Nenhum usuário carregado ainda.</p>
              </div>
            ) : (
              users.map(user => (
                <article key={user.id} className="rounded-2xl border border-[#d9ecfb] bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-base font-black">{user.name}</h3>
                      <p className="mt-0.5 truncate text-xs font-bold text-[#6b89ad]">{user.email || 'Sem e-mail'}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <span className="rounded-full bg-[#edf6ff] px-2 py-1 text-[10px] font-black text-[#5277a2]">ID {user.id}</span>
                        {user.title && <span className="rounded-full bg-[#edf6ff] px-2 py-1 text-[10px] font-black text-[#5277a2]">{user.title}</span>}
                        <span className={`rounded-full px-2 py-1 text-[10px] font-black ${user.enabled === false ? 'bg-red-50 text-red-600' : 'bg-emerald-50 text-emerald-700'}`}>
                          {user.enabled === false ? 'Inativo' : 'Ativo'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => copyUserId(user.id)}
                      className="shrink-0 rounded-full bg-[#082653] px-3 py-2 text-xs font-black text-white transition-all hover:bg-[#123c73] active:scale-95"
                    >
                      {copiedId === user.id ? 'Copiado' : 'Copiar ID'}
                    </button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="rounded-[1.6rem] border border-white/80 bg-white/80 p-5 shadow-[0_18px_50px_rgba(22,78,129,0.1)]">
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#20a8f5]">GraphQL</p>
          <h2 className="mt-1 text-2xl font-black">Playground protegido</h2>
          <p className="mt-1 text-sm font-semibold text-[#6b89ad]">Execute consultas pontuais usando o token salvo na Vercel, sem expor o token no navegador.</p>

          {error && (
            <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {error}
            </div>
          )}

          <label className="mt-5 block">
            <span className="text-xs font-black uppercase tracking-wider text-[#5277a2]">Query</span>
            <textarea
              value={query}
              onChange={event => setQuery(event.target.value)}
              spellCheck={false}
              className="mt-2 min-h-64 w-full rounded-2xl border border-[#cfe7fb] bg-[#07172b] px-4 py-3 font-mono text-xs leading-6 text-[#d9f0ff] outline-none focus:border-[#20a8f5] focus:ring-4 focus:ring-[#20a8f5]/10"
            />
          </label>

          <label className="mt-4 block">
            <span className="text-xs font-black uppercase tracking-wider text-[#5277a2]">Variables JSON</span>
            <textarea
              value={variablesText}
              onChange={event => setVariablesText(event.target.value)}
              spellCheck={false}
              className="mt-2 min-h-24 w-full rounded-2xl border border-[#cfe7fb] bg-[#f8fcff] px-4 py-3 font-mono text-xs leading-6 text-[#082653] outline-none focus:border-[#20a8f5] focus:ring-4 focus:ring-[#20a8f5]/10"
            />
          </label>

          <button
            type="button"
            onClick={handleRunQuery}
            disabled={isRunning}
            className="mt-4 rounded-2xl bg-[#20a8f5] px-5 py-3 text-sm font-black text-white shadow-[0_12px_30px_rgba(32,168,245,0.22)] transition-all hover:bg-[#1294df] active:scale-95 disabled:opacity-60"
          >
            {isRunning ? 'Executando...' : 'Executar query'}
          </button>

          <pre className="mt-5 max-h-96 overflow-auto rounded-2xl border border-[#d9ecfb] bg-[#f8fcff] p-4 text-xs leading-6 text-[#123c73]">
            {resultText}
          </pre>
        </section>
      </div>
    </main>
  );
};

export default MondayPlayground;
