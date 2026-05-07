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

const defaultPrimaryColor = '#18181b';
const defaultAccentColor = '#22c55e';

const emptyForm: ClientPayload = {
  name: '',
  boardId: DEFAULT_MONDAY_CASE_BOARD_ID,
  avatar_url: '',
  logo_url: '',
  brand_primary_color: defaultPrimaryColor,
  brand_accent_color: defaultAccentColor,
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

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] || '')
    .join('')
    .toUpperCase() || 'CL';

const inputClass = 'mt-1.5 w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none transition-all placeholder:text-zinc-400 focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10';
const labelSpanClass = 'text-[10px] font-bold uppercase tracking-widest text-zinc-500';

const ColorField: React.FC<{
  label: string;
  value?: string;
  onChange: (value: string) => void;
}> = ({ label, value, onChange }) => {
  const color = value || defaultPrimaryColor;
  const swatchColor = /^#[0-9a-f]{6}$/i.test(color) ? color : defaultPrimaryColor;
  return (
    <label className="block">
      <span className={labelSpanClass}>{label}</span>
      <div className="mt-1.5 flex overflow-hidden rounded-xl border border-zinc-200 bg-white focus-within:border-zinc-900 focus-within:ring-2 focus-within:ring-zinc-900/10">
        <input
          type="color"
          value={swatchColor}
          onChange={event => onChange(event.target.value)}
          className="h-12 w-14 cursor-pointer border-0 bg-transparent p-1"
        />
        <input
          value={color}
          onChange={event => onChange(event.target.value)}
          className="min-w-0 flex-1 px-3 text-sm font-mono text-zinc-900 outline-none"
          placeholder="#18181b"
        />
      </div>
    </label>
  );
};

const BrandPreview: React.FC<{ form: ClientPayload }> = ({ form }) => {
  const primary = form.brand_primary_color || defaultPrimaryColor;
  const accent = form.brand_accent_color || defaultAccentColor;
  const logoUrl = form.logo_url || form.avatar_url || '';
  const name = form.name || 'Nome do cliente';

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-3">
          {logoUrl ? (
            <img src={logoUrl} alt="" className="h-10 max-w-36 rounded-xl object-contain" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-xl text-xs font-bold text-white" style={{ backgroundColor: primary }}>
              {getInitials(name)}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-sm font-bold text-zinc-900">{name}</p>
            <p className="text-xs text-zinc-500">Portal de casos</p>
          </div>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-zinc-100 p-1">
          <span className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold shadow-sm" style={{ color: primary }}>
            Casos
          </span>
        </div>
      </div>
      <div className="grid grid-cols-[1fr_72px] gap-3 p-4">
        <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Preview</p>
          <h3 className="mt-2 text-xl font-bold text-zinc-900">Casos de pacientes</h3>
          <div className="mt-4 h-2 rounded-full bg-zinc-200">
            <div className="h-2 w-2/3 rounded-full" style={{ backgroundColor: accent }} />
          </div>
          <button type="button" className="mt-4 rounded-xl px-4 py-2 text-sm font-bold text-white" style={{ backgroundColor: primary }}>
            Novo paciente
          </button>
        </div>
        <div className="rounded-xl" style={{ background: `linear-gradient(180deg, ${primary}, ${accent})` }} />
      </div>
    </div>
  );
};

const AdminClients: React.FC = () => {
  const [password, setPassword] = useState(() => localStorage.getItem('cases_admin_password') || '');
  const [passwordInput, setPasswordInput] = useState(password);
  const [clients, setClients] = useState<Client[]>([]);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [form, setForm] = useState<ClientPayload>(emptyForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const isAuthenticated = Boolean(password);

  const filteredClients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return [...clients]
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
      .filter(client => {
        if (!query) return true;
        return (
          client.name.toLowerCase().includes(query) ||
          (client.case_public_token || '').toLowerCase().includes(query) ||
          (client.case_client_label || '').toLowerCase().includes(query)
        );
      });
  }, [clients, search]);

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
    setIsFormOpen(true);
    setForm({
      name: client.name,
      boardId: client.boardId,
      avatar_url: client.avatar_url || '',
      logo_url: client.logo_url || client.avatar_url || '',
      brand_primary_color: client.brand_primary_color || defaultPrimaryColor,
      brand_accent_color: client.brand_accent_color || defaultAccentColor,
      case_public_token: client.case_public_token || '',
      case_board_id: client.case_board_id || client.monday_board_id || client.boardId || DEFAULT_MONDAY_CASE_BOARD_ID,
      case_client_label: client.case_client_label || '',
      monday_board_id: client.monday_board_id || client.case_board_id || client.boardId || DEFAULT_MONDAY_CASE_BOARD_ID,
      monday_client_label: client.monday_client_label || client.case_client_label || client.name,
      drive_folder_id: client.drive_folder_id || '',
      active: client.active !== false,
    });
    window.setTimeout(() => document.getElementById('client-form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const handleNew = () => {
    setEditingClient(null);
    setForm({ ...emptyForm });
    setIsFormOpen(true);
    window.setTimeout(() => document.getElementById('client-form-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingClient(null);
    setForm({ ...emptyForm });
  };

  const handleNameChange = (name: string) => {
    setForm(prev => ({
      ...prev,
      name,
      case_client_label: prev.case_client_label || name,
      monday_client_label: prev.monday_client_label || name,
      case_public_token: prev.case_public_token || makeToken(name),
    }));
  };

  const handleBoardChange = (boardId: string) => {
    setForm(prev => ({
      ...prev,
      boardId,
      case_board_id: boardId,
      monday_board_id: boardId,
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
      if (editingClient?.id === client.id) handleCloseForm();
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
      <main className="flex min-h-screen items-center justify-center bg-black p-6">
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-white/5 p-8 backdrop-blur-sm"
        >
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-white">
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-black">
              <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
            </svg>
          </div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Admin</p>
          <h1 className="mt-2 text-3xl font-bold text-white">Portal de clientes</h1>
          <p className="mt-2 text-sm text-zinc-400">Acesso restrito. Entre com a senha admin.</p>

          {error && (
            <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm font-medium text-red-300">
              {error}
            </div>
          )}

          <input
            type="password"
            value={passwordInput}
            onChange={event => setPasswordInput(event.target.value)}
            className="mt-6 w-full rounded-xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-zinc-500 focus:border-white/30 focus:ring-2 focus:ring-white/10"
            placeholder="Senha admin"
          />
          <button
            type="submit"
            className="mt-4 w-full rounded-xl bg-white px-4 py-3 text-sm font-bold text-black transition-all hover:bg-zinc-100 active:scale-95"
          >
            Entrar
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-50">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
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
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-all hover:border-zinc-400 hover:bg-zinc-50"
          >
            Sair
          </button>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-zinc-500">
              {clients.length} cliente{clients.length === 1 ? '' : 's'} cadastrado{clients.length === 1 ? '' : 's'}
            </p>
            <h2 className="mt-1 text-3xl font-bold tracking-tight text-zinc-900">Cadastro de clientes</h2>
          </div>
          <button
            type="button"
            onClick={handleNew}
            className="rounded-xl bg-black px-5 py-2.5 text-sm font-bold text-white transition-all hover:bg-zinc-800 active:scale-95"
          >
            + Novo cliente
          </button>
        </div>

        {error && (
          <div className="mt-5 flex items-center gap-2 rounded-xl border border-red-100 bg-red-50 px-4 py-3">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4 shrink-0 text-red-500">
              <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-8-5a.75.75 0 0 1 .75.75v4.5a.75.75 0 0 1-1.5 0v-4.5A.75.75 0 0 1 10 5Zm0 10a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium text-red-700">{error}</p>
          </div>
        )}

        {isFormOpen && (
          <section id="client-form-panel" className="mt-6 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex flex-col gap-3 border-b border-zinc-100 pb-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">{editingClient ? 'Editando' : 'Novo cadastro'}</p>
                <h2 className="mt-1 text-2xl font-bold text-zinc-900">{editingClient ? editingClient.name : 'Novo cliente'}</h2>
              </div>
              <button
                type="button"
                onClick={handleCloseForm}
                className="rounded-xl border border-zinc-200 px-3 py-2 text-sm font-bold text-zinc-600 transition-all hover:border-zinc-400 hover:bg-zinc-50"
              >
                Fechar
              </button>
            </div>

            <form onSubmit={handleSave} className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Dados principais</h3>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className={labelSpanClass}>Nome</span>
                      <input
                        value={form.name}
                        onChange={event => handleNameChange(event.target.value)}
                        className={inputClass}
                        placeholder="Nome do cliente"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className={labelSpanClass}>Board ID Monday</span>
                      <input
                        value={form.boardId}
                        onChange={event => handleBoardChange(event.target.value)}
                        className={`${inputClass} font-mono`}
                        placeholder="Ex: 18411843992"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className={labelSpanClass}>Label no Monday</span>
                      <input
                        value={form.case_client_label || ''}
                        onChange={event => setForm(prev => ({ ...prev, case_client_label: event.target.value, monday_client_label: event.target.value }))}
                        className={inputClass}
                        placeholder="Nome da clínica no board"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Identidade visual</h3>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block md:col-span-2">
                      <span className={labelSpanClass}>Logotipo URL</span>
                      <input
                        value={form.logo_url || ''}
                        onChange={event => setForm(prev => ({ ...prev, logo_url: event.target.value, avatar_url: prev.avatar_url || event.target.value }))}
                        className={inputClass}
                        placeholder="https://..."
                      />
                    </label>
                    <ColorField
                      label="Cor principal"
                      value={form.brand_primary_color}
                      onChange={value => setForm(prev => ({ ...prev, brand_primary_color: value }))}
                    />
                    <ColorField
                      label="Cor de destaque"
                      value={form.brand_accent_color}
                      onChange={value => setForm(prev => ({ ...prev, brand_accent_color: value }))}
                    />
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-zinc-900">Link e integrações</h3>
                  <div className="mt-3 grid grid-cols-1 gap-4 md:grid-cols-2">
                    <label className="block">
                      <span className={labelSpanClass}>Token do link</span>
                      <input
                        value={form.case_public_token}
                        onChange={event => setForm(prev => ({ ...prev, case_public_token: event.target.value }))}
                        className={`${inputClass} font-mono`}
                        placeholder="Ex: clinica-silva-a1b2c"
                        required
                      />
                    </label>
                    <label className="block">
                      <span className={labelSpanClass}>Pasta Drive ID</span>
                      <input
                        value={form.drive_folder_id || ''}
                        onChange={event => setForm(prev => ({ ...prev, drive_folder_id: event.target.value }))}
                        className={`${inputClass} font-mono`}
                        placeholder="ID da pasta raiz no Drive"
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <BrandPreview form={form} />
                <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={form.active !== false}
                      onChange={event => setForm(prev => ({ ...prev, active: event.target.checked }))}
                      className="sr-only"
                    />
                    <div className={`h-6 w-10 rounded-full transition-colors ${form.active !== false ? 'bg-zinc-900' : 'bg-zinc-200'}`}>
                      <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${form.active !== false ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-zinc-700">Cliente ativo</span>
                </label>

                {form.case_public_token && (
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-zinc-500">Link do portal</p>
                    <p className="break-all font-mono text-xs leading-relaxed text-zinc-700">{getClientLink(form.case_public_token)}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSaving}
                  className="w-full rounded-xl bg-black px-4 py-3 text-sm font-bold text-white transition-all hover:bg-zinc-800 disabled:opacity-50 active:scale-95"
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
              </div>
            </form>
          </section>
        )}

        <section className="mt-6">
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400">
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
              </svg>
              <input
                value={search}
                onChange={event => setSearch(event.target.value)}
                placeholder="Buscar cliente, token ou label..."
                className="w-full rounded-xl border border-zinc-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900"
              />
            </div>
            <button
              type="button"
              onClick={() => loadClients()}
              disabled={isLoading}
              className="rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-sm font-semibold text-zinc-700 transition-all hover:border-zinc-400 hover:bg-zinc-50 disabled:opacity-50"
            >
              {isLoading ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            {isLoading ? (
              <div className="flex items-center justify-center p-12">
                <div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" />
              </div>
            ) : filteredClients.length === 0 ? (
              <div className="p-12 text-center">
                <p className="text-sm font-semibold text-zinc-500">
                  {search ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.'}
                </p>
                {!search && (
                  <button
                    type="button"
                    onClick={handleNew}
                    className="mt-4 rounded-xl bg-black px-4 py-2 text-sm font-bold text-white transition-all hover:bg-zinc-800"
                  >
                    + Novo cliente
                  </button>
                )}
              </div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {filteredClients.map(client => {
                  const primary = client.brand_primary_color || defaultPrimaryColor;
                  const accent = client.brand_accent_color || defaultAccentColor;
                  const logoUrl = client.logo_url || client.avatar_url || '';
                  return (
                    <div key={client.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-zinc-50/70 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          {logoUrl ? (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white p-1">
                              <img src={logoUrl} alt="" className="max-h-full max-w-full object-contain" />
                            </div>
                          ) : (
                            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[11px] font-bold text-white" style={{ backgroundColor: primary }}>
                              {getInitials(client.name)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-bold text-zinc-900">{client.name}</h2>
                              {client.active === false && (
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">Inativo</span>
                              )}
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: accent }} />
                            </div>
                            <p className="mt-0.5 truncate text-xs text-zinc-500">
                              <span className="font-mono">{client.case_public_token}</span>
                            </p>
                            <p className="mt-0.5 text-[10px] text-zinc-400">
                              Drive: {client.drive_folder_id ? <span className="font-mono text-zinc-600">{client.drive_folder_id.slice(0, 20)}...</span> : 'sem pasta'}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="ml-14 flex flex-wrap gap-2 sm:ml-0">
                        <button
                          type="button"
                          onClick={() => handleCopy(client.case_public_token || '')}
                          className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-700 transition-all hover:border-zinc-400 hover:bg-zinc-50"
                        >
                          {copiedToken === client.case_public_token ? 'Copiado' : 'Copiar link'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(client)}
                          className="rounded-xl border border-zinc-200 px-3 py-1.5 text-xs font-bold text-zinc-700 transition-all hover:border-zinc-400 hover:bg-zinc-50"
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(client)}
                          className="rounded-xl border border-red-100 px-3 py-1.5 text-xs font-bold text-red-600 transition-all hover:border-red-300 hover:bg-red-50"
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default AdminClients;
