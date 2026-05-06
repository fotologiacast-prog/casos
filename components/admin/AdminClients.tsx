import React, { useEffect, useMemo, useState } from 'react';
import { Client } from '../../types';
import {
  ClientPayload,
  createAdminClient,
  deleteAdminClient,
  listAdminClients,
  updateAdminClient,
} from '../../services/adminClientService';

const emptyForm: ClientPayload = {
  name: '',
  boardId: '',
  avatar_url: '',
  case_public_token: '',
  case_board_id: '',
  case_client_label: '',
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
      setError(err instanceof Error ? err.message : 'Nao foi possivel carregar clientes.');
      localStorage.removeItem('cases_admin_password');
      setPassword('');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (password) loadClients(password);
  }, [password]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
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
      case_board_id: client.case_board_id || '',
      case_client_label: client.case_client_label || '',
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
      setError(err instanceof Error ? err.message : 'Nao foi possivel salvar cliente.');
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
      setError(err instanceof Error ? err.message : 'Nao foi possivel excluir cliente.');
    }
  };

  const handleCopy = async (token: string) => {
    await navigator.clipboard.writeText(getClientLink(token));
    setCopiedToken(token);
    window.setTimeout(() => setCopiedToken(null), 1500);
  };

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-6">
        <form onSubmit={handleLogin} className="w-full max-w-md rounded-xl border border-white/10 bg-white/10 p-8 shadow-2xl backdrop-blur">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-sky-300">Admin</p>
          <h1 className="mt-3 text-3xl font-semibold">Cadastro de clientes</h1>
          <p className="mt-3 text-sm text-slate-300">Entre com a senha configurada em `ADMIN_PASSWORD`.</p>
          <input
            type="password"
            value={passwordInput}
            onChange={event => setPasswordInput(event.target.value)}
            className="mt-6 w-full rounded-lg border border-white/10 bg-white px-4 py-3 text-slate-950 outline-none focus:border-sky-300"
            placeholder="Senha admin"
          />
          <button type="submit" className="mt-4 w-full rounded-lg bg-sky-500 px-4 py-3 text-sm font-bold text-white hover:bg-sky-400">
            Entrar
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-sky-600">Admin</p>
            <h1 className="text-2xl font-semibold text-slate-950">Clientes do portal</h1>
          </div>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('cases_admin_password');
              setPassword('');
            }}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_430px] lg:px-8">
        <section>
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-500">
              {clients.length} cliente{clients.length === 1 ? '' : 's'}
            </p>
            <button onClick={handleNew} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white hover:bg-sky-700">
              Novo cliente
            </button>
          </div>

          {error && <p className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p>}

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {isLoading ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-500">Carregando clientes...</div>
            ) : sortedClients.length === 0 ? (
              <div className="p-8 text-center text-sm font-semibold text-slate-500">Nenhum cliente cadastrado.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {sortedClients.map(client => (
                  <div key={client.id} className="grid grid-cols-1 gap-4 p-4 md:grid-cols-[1fr_auto] md:items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="font-semibold text-slate-950">{client.name}</h2>
                        {client.active === false && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">Inativo</span>}
                      </div>
                      <p className="mt-1 text-sm text-slate-500">Token: <span className="font-mono">{client.case_public_token}</span></p>
                      <p className="mt-1 text-xs text-slate-400">Drive: {client.drive_folder_id || 'sem pasta cadastrada'}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => handleCopy(client.case_public_token || '')} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                        {copiedToken === client.case_public_token ? 'Copiado' : 'Copiar link'}
                      </button>
                      <button onClick={() => handleEdit(client)} className="rounded-md border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                        Editar
                      </button>
                      <button onClick={() => handleDelete(client)} className="rounded-md border border-red-200 px-3 py-2 text-xs font-bold text-red-600 hover:bg-red-50">
                        Excluir
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <aside className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">{editingClient ? 'Editar cliente' : 'Novo cliente'}</h2>
          <form onSubmit={handleSave} className="mt-5 space-y-4">
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Nome</span>
              <input value={form.name} onChange={event => handleNameChange(event.target.value)} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-sky-400" required />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Board ID Monday</span>
              <input value={form.boardId} onChange={event => setForm(prev => ({ ...prev, boardId: event.target.value, case_board_id: prev.case_board_id || event.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono outline-none focus:border-sky-400" required />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Token do link</span>
              <input value={form.case_public_token} onChange={event => setForm(prev => ({ ...prev, case_public_token: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono outline-none focus:border-sky-400" required />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Label no Monday</span>
              <input value={form.case_client_label || ''} onChange={event => setForm(prev => ({ ...prev, case_client_label: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-sky-400" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Pasta Drive ID</span>
              <input value={form.drive_folder_id || ''} onChange={event => setForm(prev => ({ ...prev, drive_folder_id: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono outline-none focus:border-sky-400" />
            </label>
            <label className="block">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Avatar URL</span>
              <input value={form.avatar_url || ''} onChange={event => setForm(prev => ({ ...prev, avatar_url: event.target.value }))} className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 outline-none focus:border-sky-400" />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
              <input type="checkbox" checked={form.active !== false} onChange={event => setForm(prev => ({ ...prev, active: event.target.checked }))} />
              Cliente ativo
            </label>
            {form.case_public_token && (
              <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500">
                <p className="font-bold text-slate-700">Link</p>
                <p className="mt-1 break-all font-mono">{getClientLink(form.case_public_token)}</p>
              </div>
            )}
            <button type="submit" disabled={isSaving} className="w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-sky-700 disabled:opacity-60">
              {isSaving ? 'Salvando...' : 'Salvar cliente'}
            </button>
          </form>
        </aside>
      </div>
    </main>
  );
};

export default AdminClients;
