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
  case_public_token: '',
  case_board_id: DEFAULT_MONDAY_CASE_BOARD_ID,
  case_client_label: '',
  monday_board_id: DEFAULT_MONDAY_CASE_BOARD_ID,
  monday_client_label: '',
  drive_folder_id: '',
  portal_password: '',
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
  const [showPortalPassword, setShowPortalPassword] = useState(false);
  const [adminTab, setAdminTab] = useState<'clients' | 'faqs'>('clients');

  // FAQ state
  const [faqs, setFaqs] = useState<Array<{id: string; stage_type: string; title: string; content: string; image_url?: string; order: number}>>([]);
  const [faqsLoading, setFaqsLoading] = useState(false);
  const [faqForm, setFaqForm] = useState({ stage_type: '', title: '', content: '', image_url: '', order: 0 });
  const [faqSaving, setFaqSaving] = useState(false);
  const [faqError, setFaqError] = useState<string | null>(null);

  const CASE_STAGE_TYPES = [
    '01. (CADEIRA) Fotos intraorais do antes (4 fotos)',
    '02. (ESTUDIO) Video panoramico do antes',
    '03. (ESTUDIO) Fotos EXTRAORAIS do antes (2 fotos)',
    '04. (ESTUDIO) Video expectativa (paciente)',
    '05. Imagens 3D - Planejamento do laboratorio (escaneamento)',
    '06. Videos do procedimento',
    '07. Fotos DETALHES em macro das proteses fora da boca',
    '08. Imagens 3D - Tomografia e RX',
    '09. (NA CADEIRA) - Fotos intraorais do depois (4 fotos)',
    '10. (CONSULTORIO) Video da entrega (reacao da paciente no espelho)',
    '11. (ESTUDIO) Retratos do depois (posados)',
    '12. (ESTUDIO) - Fotos em close do sorriso',
    '13. (ESTUDIO) Fotos em close artisticas do sorriso',
    '14. (ESTUDIO) Video RESULTADO risada gostosa',
    '15. (ESTUDIO) Video DEPOIMENTO paciente',
    '16. (ESTUDIO) Video FEEDBACK EMOCIONAL da dra. pos entrega',
    '17. Video DEPOIMENTO produzido - videomaker',
    '18. (ESTUDIO) Retratos atualizados do paciente com sorriso novo',
    '19. Foto com o Doutor (O Brinde da Vitoria)',
  ];

  const loadFaqs = async () => {
    setFaqsLoading(true);
    try {
      const res = await fetch('/api/faq', { headers: { 'X-Admin-Password': password } });
      const data = await res.json();
      setFaqs(data.faqs || []);
    } catch { /* silent */ } finally { setFaqsLoading(false); }
  };

  const handleFaqSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFaqSaving(true); setFaqError(null);
    try {
      const res = await fetch('/api/faq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Admin-Password': password },
        body: JSON.stringify({ ...faqForm, order: Number(faqForm.order) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar FAQ.');
      setFaqs(prev => [...prev, data.faq]);
      setFaqForm({ stage_type: faqForm.stage_type, title: '', content: '', image_url: '', order: 0 });
    } catch (err) { setFaqError(err instanceof Error ? err.message : 'Erro'); } finally { setFaqSaving(false); }
  };

  const handleFaqDelete = async (id: string) => {
    if (!window.confirm('Excluir este FAQ?')) return;
    const res = await fetch(`/api/faq?id=${id}`, { method: 'DELETE', headers: { 'X-Admin-Password': password } });
    if (res.ok) setFaqs(prev => prev.filter(f => f.id !== id));
  };

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
    setShowPortalPassword(false);
    setForm({
      name: client.name,
      boardId: client.boardId,
      case_public_token: client.case_public_token || '',
      case_board_id: client.case_board_id || client.monday_board_id || client.boardId || DEFAULT_MONDAY_CASE_BOARD_ID,
      case_client_label: client.case_client_label || '',
      monday_board_id: client.monday_board_id || client.case_board_id || client.boardId || DEFAULT_MONDAY_CASE_BOARD_ID,
      monday_client_label: client.monday_client_label || client.case_client_label || client.name,
      drive_folder_id: client.drive_folder_id || '',
      portal_password: client.portal_password || '',
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
          <div className="flex items-center gap-4">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Admin</p>
              <h1 className="text-lg font-bold text-zinc-900">Portal Impact Doctor</h1>
            </div>
            <div className="flex items-center rounded-xl border border-zinc-200 bg-zinc-100 p-1">
              <button
                type="button"
                onClick={() => setAdminTab('clients')}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  adminTab === 'clients' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                Clientes
              </button>
              <button
                type="button"
                onClick={() => { setAdminTab('faqs'); loadFaqs(); }}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-all ${
                  adminTab === 'faqs' ? 'bg-white text-zinc-950 shadow-sm' : 'text-zinc-500 hover:text-zinc-900'
                }`}
              >
                FAQs das etapas
              </button>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { localStorage.removeItem('cases_admin_password'); setPassword(''); }}
            className="rounded-xl border border-zinc-200 bg-white px-4 py-2 text-sm font-semibold text-zinc-700 transition-all hover:border-zinc-400 hover:bg-zinc-50"
          >
            Sair
          </button>
        </div>
      </header>

      {adminTab === 'faqs' ? (
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <h2 className="text-3xl font-bold tracking-tight text-zinc-900">FAQs das etapas</h2>
          <p className="mt-1 text-sm text-zinc-500">Cadastre até 3 FAQs por etapa. Eles aparecem para os clientes ao clicar no ⓘ em cada card.</p>

          {/* Create FAQ form */}
          <section className="mt-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
            <h3 className="text-base font-bold text-zinc-900">Novo FAQ</h3>
            {faqError && <p className="mt-3 text-sm font-medium text-red-600">{faqError}</p>}
            <form onSubmit={handleFaqSave} className="mt-4 space-y-4">
              <label className="block">
                <span className={labelSpanClass}>Etapa</span>
                <select
                  value={faqForm.stage_type}
                  onChange={e => setFaqForm(p => ({...p, stage_type: e.target.value}))}
                  required
                  className={inputClass}
                >
                  <option value="">Selecione a etapa...</option>
                  {CASE_STAGE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={labelSpanClass}>Título</span>
                <input value={faqForm.title} onChange={e => setFaqForm(p => ({...p, title: e.target.value}))} required className={inputClass} placeholder="Ex: Quantas fotos enviar?" />
              </label>
              <label className="block">
                <span className={labelSpanClass}>URL da imagem (opcional)</span>
                <input value={faqForm.image_url} onChange={e => setFaqForm(p => ({...p, image_url: e.target.value}))} className={inputClass} placeholder="https://..." />
              </label>
              <label className="block">
                <span className={labelSpanClass}>Conteúdo / Instruções</span>
                <textarea value={faqForm.content} onChange={e => setFaqForm(p => ({...p, content: e.target.value}))} className={`${inputClass} min-h-[100px] resize-y`} placeholder="Descreva o que deve ser enviado nesta etapa..." />
              </label>
              <button type="submit" disabled={faqSaving} className="rounded-xl bg-black px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-800 disabled:opacity-50 active:scale-95 transition-all">
                {faqSaving ? 'Salvando...' : 'Salvar FAQ'}
              </button>
            </form>
          </section>

          {/* FAQ list */}
          <section className="mt-6">
            <h3 className="mb-4 text-base font-bold text-zinc-900">{faqs.length} FAQ{faqs.length !== 1 ? 's' : ''} cadastrado{faqs.length !== 1 ? 's' : ''}</h3>
            {faqsLoading ? (
              <div className="flex justify-center py-12"><div className="h-8 w-8 rounded-full border-2 border-zinc-200 border-t-zinc-900 animate-spin" /></div>
            ) : faqs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-zinc-300 bg-white p-10 text-center">
                <p className="text-sm font-semibold text-zinc-500">Nenhum FAQ cadastrado ainda.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {faqs.map(faq => (
                  <div key={faq.id} className="flex items-start gap-4 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm">
                    <div className="min-w-0 flex-1">
                      <span className="inline-block rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500 mb-1">{faq.stage_type}</span>
                      <p className="font-bold text-zinc-900">{faq.title}</p>
                      {faq.image_url && <img src={faq.image_url} alt={faq.title} className="mt-2 h-20 w-auto rounded-lg object-cover" />}
                      {faq.content && <p className="mt-1 text-sm text-zinc-600 line-clamp-2">{faq.content}</p>}
                    </div>
                    <button type="button" onClick={() => handleFaqDelete(faq.id)} className="shrink-0 rounded-xl border border-red-100 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50 transition-colors">
                      Excluir
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      ) : (
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
                    <label className="block md:col-span-2">
                      <span className={labelSpanClass}>Senha do portal da clínica</span>
                      <div className="relative">
                        <input
                          type={showPortalPassword ? 'text' : 'password'}
                          value={form.portal_password || ''}
                          onChange={event => setForm(prev => ({ ...prev, portal_password: event.target.value }))}
                          className={`${inputClass} pr-10`}
                          placeholder="Deixe em branco para acesso livre"
                          autoComplete="new-password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPortalPassword(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-zinc-700 transition-colors"
                          tabIndex={-1}
                        >
                          {showPortalPassword ? (
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                              <path d="M10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />
                              <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 0 1 0-1.186A10.004 10.004 0 0 1 10 3c4.257 0 7.893 2.66 9.336 6.41.147.381.146.804 0 1.186A10.004 10.004 0 0 1 10 17c-4.257 0-7.893-2.66-9.336-6.41ZM14 10a4 4 0 1 1-8 0 4 4 0 0 1 8 0Z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5">
                              <path fillRule="evenodd" d="M3.28 2.22a.75.75 0 0 0-1.06 1.06l14.5 14.5a.75.75 0 1 0 1.06-1.06l-1.745-1.745a10.029 10.029 0 0 0 3.3-4.38 1.651 1.651 0 0 0 0-1.185A10.004 10.004 0 0 0 9.999 3a9.956 9.956 0 0 0-4.744 1.194L3.28 2.22ZM7.752 6.69l1.092 1.092a2.5 2.5 0 0 1 3.374 3.373l1.091 1.092a4 4 0 0 0-5.557-5.557Z" clipRule="evenodd" />
                              <path d="M10.748 13.93l2.523 2.523a10.003 10.003 0 0 1-3.27.547c-4.258 0-7.894-2.66-9.337-6.41a1.651 1.651 0 0 1 0-1.186A10.007 10.007 0 0 1 2.839 6.02L6.07 9.252a4 4 0 0 0 4.678 4.678Z" />
                            </svg>
                          )}
                        </button>
                      </div>
                      <p className="mt-1 text-[10px] text-zinc-400">Se definida, o dentista precisará digitar esta senha ao acessar o portal pela primeira vez na sessão.</p>
                    </label>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
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
                {filteredClients.map(client => (
                    <div key={client.id} className="flex flex-col gap-3 p-4 transition-colors hover:bg-zinc-50/70 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-zinc-900 text-[11px] font-bold text-white">
                            {getInitials(client.name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h2 className="font-bold text-zinc-900">{client.name}</h2>
                              {client.active === false && (
                                <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold text-zinc-500">Inativo</span>
                              )}
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
                ))}
              </div>
            )}
          </div>
        </section>
        </div>
      )}
    </main>
  );
};

export default AdminClients;
