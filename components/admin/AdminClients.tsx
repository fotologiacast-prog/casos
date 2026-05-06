import React, { useEffect, useMemo, useState } from 'react';
import { Client } from '../../types';
import { DEFAULT_MONDAY_CASE_BOARD_ID } from '../../config';
import {
  AdminApiError,
  ClientPayload,
  createAdminClient,
  deleteAdminClient,
  listAdminClients,
  updateAdminClient,
} from '../../services/adminClientService';

const emptyForm: ClientPayload = {
  name: '',
  boardId: DEFAULT_MONDAY_CASE_BOARD_ID,
  avatar_url: '',
  case_public_token: '',
  case_board_id: DEFAULT_MONDAY_CASE_BOARD_ID,
  case_client_label: '',
  monday_board_id: DEFAULT_MONDAY_CASE_BOARD_ID,
  monday_client_label: '',
  drive_folder_id: '',
  active: true,
};

const slugify = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);

const makeToken = (name: string) => {
  const suffix = Math.random().toString(36).slice(2, 7);
  return `${slugify(name) || 'cliente'}-${suffix}`;
};

const getClientLink = (token: string) =>
  `${window.location.origin}${window.location.pathname}#/casos/${token}`;

const inputClass = 'mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10 transition-all placeholder:text-zinc-400 font-normal';
const labelSpanClass = 'text-[10px] font-bold uppercase tracking-widest text-zinc-500';

const AdminClients: React.FC = () => {
  const [password, setPassword] = useState(() => localStorage.getItem('cases_admin_password') || '');
  const [passwordInput, setPasswordInput] = useState(password);
  const [clients, setClients] = useState<Client[]>([]);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientPayload>(emptyForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const isAuthenticated = Boolean(password);

  const sortedClients = useMemo(
    () => [...clients].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [clients]
  );

  const loadClients = async (adminPassword = password) => {
    if (!adminPassword) return;
    setIsLoading(true);
    setError(null);
    try {
      const loadedClients = await listAdminClients(adminPassword);
      setClients(loadedClients);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível carregar clientes.');
      if (err instanceof AdminApiError && err.status === 401) {
        localStorage.removeItem('cases_admin_password');
        setPassword('');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (password) loadClients(password);
  }, [password]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    localStorage.setItem('cases_admin_password', passwordInput);
    setPassword(passwordInput);
  };

  const handleEdit = (client: Client) => {
    setEditingClient(client);
    setForm({
      name: client.name,
      boardId: client.boardId,
      avatar_url: client.avatar_url || '',
      case_public_token: client.case_public_token || '',
      case_board_id: client.case_board_id || client.monday_board_id || client.boardId || DEFAULT_MONDAY_CASE_BOARD_ID,
      case_client_label: client.case_client_label || '',
      monday_board_id: client.monday_board_id || client.case_board_id || client.boardId || DEFAULT_MONDAY_CASE_BOARD_ID,
      monday_client_label: client.monday_client_label || client.case_client_label || client.name,
      drive_folder_id: client.drive_folder_id || '',
      active: client.active !== false,
    });
  };

  const handleNew = () => {
    setEditingClient(null);
    setForm(emptyForm);
  };

  const handleNameChange = (name: string) => {
    setForm(prev => ({
      ...prev,
      name,
      case_client_label: prev.case_client_label || name,
      case_public_token: prev.case_public_token || makeToken(name),
    }));
  };

  const handleSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      if (editingClient) {
        const updated = await updateAdminClient(password, editingClient.id, form);
        setClients(prev => prev.map(client => client.id === updated.id ? updated : client));
        setEditingClient(updated);
      } else {
        const created = await createAdminClient(password, form);
        setClients(prev => [created, ...prev]);
        setEditingClient(created);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível salvar cliente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (client: Client) => {
    if (!window.confirm(`Excluir ${client.name}?`)) return;
    setError(null);
    try {
      await deleteAdminClient(password, client.id);
      setClients(prev => prev.filter(item => item.id !== client.id));
      if (editingClient?.id === client.id) handleNew();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível excluir cliente.');
    }
  };

  const handleCopy = async (token: string) => {
    await navigator.clipboard.writeText(getClientLink(token));
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken(null), 1500);
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-black flex items-center justify-center p-6">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white mb-6">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-black">
              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Portal de clientes</h1>
          <p className="mt-2 text-sm text-zinc-400">Acesso restrito. Entre com a senha admin.</p>

          {error && (
            <div className="mt-4 rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-sm font-medium text-red-300">
              {error}
            </div>
          )}

          <input
            type="password"
            value={passwordInput}
            onChange={e => setPasswordInput(e.target.value)}
            className="mt-6 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white placeholder:text-zinc-500 outline-none focus:border-white/30 focus:ring-2 focus:ring-white/10 transition-all"
            placeholder="Senha admin"
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black hover:bg-zinc-100 transition-all active:scale-95"
          >
            Entrar
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Admin</p>
            <h1 className="text-lg font-bold text-zinc-900">Clientes do portal</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('cases_admin_password');
              setPassword('');
            }}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 transition-all"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-6 sm:px-6 lg:grid-cols-[1fr_420px]">
        {/* Clients list */}
        <section>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-zinc-500">
              {clients.length} cliente{clients.length === 1 ? '' : 's'}
            </p>
            <button
              onClick={handleNew}
              className="rounded-xl bg-black px-4 py-2 text-sm font-bold text-white hover:bg-zinc-800 transition-all active:scale-95"
            >
              + Novo cliente
            </button>
          </div>

          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-red-500">
                <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
              </svg>
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />
              </div>
            ) : sortedClients.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-semibold text-zinc-500">Nenhum cliente cadastrado.</p>
                <button
                  onClick={handleNew}
                  className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-bold text-white hover:bg-zinc-800 transition-all"
                >
                  + Novo cliente
                </button>
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {sortedClients.map(client => (
                  <div key={client.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between hover:bg-zinc-50/50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-[11px] font-bold text-white">
                          {client.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="font-bold text-zinc-900">{client.name}</h2>
                            {client.active === false && (
                              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">Inativo</span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5 truncate">
                            <span className="font-mono">{client.case_public_token}</span>
                          </p>
                          <p className="text-[10px] text-zinc-400 mt-0.5">
                            Drive: {client.drive_folder_id ? <span className="text-zinc-600 font-mono">{client.drive_folder_id.slice(0, 20)}…</span> : 'sem pasta'}
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2 ml-11 sm:ml-0">
                      <button
                        onClick={() => handleCopy(client.case_public_token || '')}
                        className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 transition-all"
                      >
                        {copiedToken === client.case_public_token ? '✓ Copiado' : 'Copiar link'}
                      </button>
                      <button
                        onClick={() => handleEdit(client)}
                        className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 transition-all"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(client)}
                        className="rounded-xl border border-red-100 px-3 py-1.5 text-xs font-bold text-red-600 hover:border-red-300 hover:bg-red-50 transition-all"
                      >
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* Form sidebar */}
        <aside className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm lg:sticky lg:top-20 lg:self-start">
          <h2 className="text-lg font-bold text-zinc-900 mb-5">
            {editingClient ? 'Editar cliente' : 'Novo cliente'}
          </h2>
          <form onSubmit={handleSave} className="space-y-4">
            <label className="block">
              <span className={labelSpanClass}>Nome</span>
              <input
                value={form.name}
                onChange={e => handleNameChange(e.target.value)}
                className={inputClass}
                placeholder="Nome do cliente"
                required
              />
            </label>
            <label className="block">
              <span className={labelSpanClass}>Board ID Monday</span>
              <input
                value={form.boardId}
                onChange={e => setForm(prev => ({ ...prev, boardId: e.target.value, case_board_id: prev.case_board_id || e.target.value }))}
                className={`${inputClass} font-mono`}
                placeholder="Ex: 18411843992"
                required
              />
            </label>
            <label className="block">
              <span className={labelSpanClass}>Token do link</span>
              <input
                value={form.case_public_token}
                onChange={e => setForm(prev => ({ ...prev, case_public_token: e.target.value }))}
                className={`${inputClass} font-mono`}
                placeholder="Ex: clinica-silva-a1b2c"
                required
              />
            </label>
            <label className="block">
              <span className={labelSpanClass}>Label no Monday</span>
              <input
                value={form.case_client_label || ''}
                onChange={e => setForm(prev => ({ ...prev, case_client_label: e.target.value }))}
                className={inputClass}
                placeholder="Nome da clínica no board"
              />
            </label>
            <label className="block">
              <span className={labelSpanClass}>Pasta Drive ID</span>
              <input
                value={form.drive_folder_id || ''}
                onChange={e => setForm(prev => ({ ...prev, drive_folder_id: e.target.value }))}
                className={`${inputClass} font-mono`}
                placeholder="ID da pasta raiz no Drive"
              />
              <span className="mt-1 block text-xs text-zinc-400">Se vazio, o sistema cria/localiza pelo nome.</span>
            </label>
            <label className="block">
              <span className={labelSpanClass}>Avatar URL</span>
              <input
                value={form.avatar_url || ''}
                onChange={e => setForm(prev => ({ ...prev, avatar_url: e.target.value }))}
                className={inputClass}
                placeholder="https://..."
              />
            </label>
            <label className="flex items-center gap-3 cursor-pointer">
              <div className="relative">
                <input
                  type="checkbox"
                  checked={form.active !== false}
                  onChange={e => setForm(prev => ({ ...prev, active: e.target.checked }))}
                  className="sr-only"
                />
                <div className={`h-6 w-10 rounded-full transition-colors ${form.active !== false ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
                  <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${form.active !== false ? 'translate-x-4' : 'translate-x-0.5'}`} />
                </div>
              </div>
              <span className="text-sm font-semibold text-zinc-700">Cliente ativo</span>
            </label>

            {form.case_public_token && (
              <div className="rounded-xl bg-zinc-50 border border-zinc-200 p-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Link do portal</p>
                <p className="text-xs font-mono text-zinc-700 break-all leading-relaxed">{getClientLink(form.case_public_token)}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isSaving}
              className="w-full rounded-xl bg-black px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-all active:scale-95"
            >
              {isSaving ? (
                <span className="flex items-center justify-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                  Salvando...
                </span>
              ) : (
                'Salvar cliente'
              )}
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
};

export default AdminClients;
