import React, { useEffect, useMemo, useState } from 'react';
import { Client } from '../../types';
import {
  AdminNotification,
  AdminNotificationPayload,
  createAdminNotification,
  deleteAdminNotification,
  listAdminNotifications,
  resolveNotificationClientName,
  updateAdminNotification,
} from '../../services/adminPortalService';

interface AdminNotificationsPanelProps {
  password: string;
  clients: Client[];
}

const emptyNotification: AdminNotificationPayload = {
  title: '',
  body: '',
  media_url: '',
  cta_label: '',
  cta_url: '',
  client_id: null,
  active: true,
};

const isVideo = (url?: string | null) => /\.(mp4|m4v|mov|webm|mpeg|mpg|3gp|ogv)(\?|$)/i.test(url || '');
const isImage = (url?: string | null) => /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(url || '');

const AdminNotificationsPanel: React.FC<AdminNotificationsPanelProps> = ({ password, clients }) => {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [form, setForm] = useState<AdminNotificationPayload>(emptyNotification);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeNotifications = useMemo(
    () => notifications.filter(notification => notification.active).length,
    [notifications]
  );

  const loadNotifications = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setNotifications(await listAdminNotifications(password));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar notificações.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, [password]);

  const resetForm = () => {
    setForm(emptyNotification);
    setEditingId(null);
    setError(null);
  };

  const handleEdit = (notification: AdminNotification) => {
    setEditingId(notification.id);
    setForm({
      title: notification.title,
      body: notification.body || '',
      media_url: notification.media_url || '',
      cta_label: notification.cta_label || '',
      cta_url: notification.cta_url || '',
      client_id: notification.client_id,
      active: notification.active,
    });
    window.setTimeout(() => document.getElementById('notification-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  };

  const handleDelete = async (notification: AdminNotification) => {
    if (!window.confirm(`Excluir a notificação "${notification.title}"?`)) return;
    await deleteAdminNotification(password, notification.id);
    setNotifications(prev => prev.filter(item => item.id !== notification.id));
    if (editingId === notification.id) resetForm();
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSaving(true);
    setError(null);
    try {
      const saved = editingId
        ? await updateAdminNotification(password, editingId, form)
        : await createAdminNotification(password, form);
      setNotifications(prev => editingId ? prev.map(item => item.id === saved.id ? saved : item) : [saved, ...prev]);
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao salvar notificação.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[#20a8f5]">Notificações</p>
          <h2 className="mt-1 text-3xl font-black tracking-tight text-[#082653]">Avisos manuais</h2>
          <p className="mt-1 text-sm font-semibold text-[#6d8db1]">
            {activeNotifications} aviso{activeNotifications === 1 ? '' : 's'} ativo{activeNotifications === 1 ? '' : 's'} no portal.
          </p>
        </div>
        <button type="button" onClick={loadNotifications} className="impact-secondary">
          Atualizar
        </button>
      </div>

      <section id="notification-form" className="impact-glass rounded-[2rem] p-5 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-black text-[#082653]">{editingId ? 'Editar aviso' : 'Novo aviso'}</h3>
            <p className="text-xs font-semibold text-[#6d8db1]">Pode ser geral ou direcionado para um cliente específico.</p>
          </div>
          {editingId && (
            <button type="button" onClick={resetForm} className="impact-secondary min-h-9 px-4 text-xs">
              Cancelar edição
            </button>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-5 grid gap-4 lg:grid-cols-[1fr_0.7fr]">
          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#6d8db1]">Título</span>
              <input
                value={form.title}
                onChange={event => setForm(prev => ({ ...prev, title: event.target.value }))}
                className="mt-1.5 w-full rounded-2xl border border-[#cfe7fb] bg-white/80 px-4 py-3 text-sm font-bold text-[#082653] outline-none focus:border-[#20a8f5] focus:ring-2 focus:ring-[#20a8f5]/15"
                placeholder="Ex: Nova atualização na plataforma"
                required
              />
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#6d8db1]">Mensagem</span>
              <textarea
                value={form.body || ''}
                onChange={event => setForm(prev => ({ ...prev, body: event.target.value }))}
                className="mt-1.5 min-h-[130px] w-full resize-y rounded-2xl border border-[#cfe7fb] bg-white/80 px-4 py-3 text-sm font-semibold text-[#244f7f] outline-none focus:border-[#20a8f5] focus:ring-2 focus:ring-[#20a8f5]/15"
                placeholder="Escreva o aviso que aparecerá no sino de notificações..."
              />
            </label>
          </div>

          <div className="space-y-4">
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#6d8db1]">Cliente</span>
              <select
                value={form.client_id || ''}
                onChange={event => setForm(prev => ({ ...prev, client_id: event.target.value ? Number(event.target.value) : null }))}
                className="mt-1.5 w-full rounded-2xl border border-[#cfe7fb] bg-white/80 px-4 py-3 text-sm font-bold text-[#082653] outline-none focus:border-[#20a8f5] focus:ring-2 focus:ring-[#20a8f5]/15"
              >
                <option value="">Todos os clientes</option>
                {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="text-[10px] font-black uppercase tracking-widest text-[#6d8db1]">URL de mídia opcional</span>
              <input
                value={form.media_url || ''}
                onChange={event => setForm(prev => ({ ...prev, media_url: event.target.value }))}
                className="mt-1.5 w-full rounded-2xl border border-[#cfe7fb] bg-white/80 px-4 py-3 text-sm font-semibold text-[#244f7f] outline-none focus:border-[#20a8f5] focus:ring-2 focus:ring-[#20a8f5]/15"
                placeholder="https://..."
              />
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#6d8db1]">Botão</span>
                <input
                  value={form.cta_label || ''}
                  onChange={event => setForm(prev => ({ ...prev, cta_label: event.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-[#cfe7fb] bg-white/80 px-4 py-3 text-sm font-semibold text-[#244f7f] outline-none focus:border-[#20a8f5] focus:ring-2 focus:ring-[#20a8f5]/15"
                  placeholder="Ver agora"
                />
              </label>
              <label className="block">
                <span className="text-[10px] font-black uppercase tracking-widest text-[#6d8db1]">Link</span>
                <input
                  value={form.cta_url || ''}
                  onChange={event => setForm(prev => ({ ...prev, cta_url: event.target.value }))}
                  className="mt-1.5 w-full rounded-2xl border border-[#cfe7fb] bg-white/80 px-4 py-3 text-sm font-semibold text-[#244f7f] outline-none focus:border-[#20a8f5] focus:ring-2 focus:ring-[#20a8f5]/15"
                  placeholder="https://..."
                />
              </label>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border border-[#cfe7fb] bg-white/70 px-4 py-3">
              <input
                type="checkbox"
                checked={form.active !== false}
                onChange={event => setForm(prev => ({ ...prev, active: event.target.checked }))}
                className="rounded border-[#9ecff4] text-[#20a8f5] focus:ring-[#20a8f5]"
              />
              <span className="text-sm font-black text-[#174579]">Aviso ativo</span>
            </label>
            <button type="submit" disabled={isSaving} className="impact-primary w-full">
              {isSaving ? 'Salvando...' : editingId ? 'Salvar edição' : 'Publicar aviso'}
            </button>
          </div>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-10">
            <div className="h-9 w-9 rounded-full border-[3px] border-[#d7ecfb] border-t-[#20a8f5] animate-spin" />
          </div>
        ) : notifications.length === 0 ? (
          <div className="impact-soft-card col-span-full rounded-[2rem] p-8 text-center text-sm font-bold text-[#6d8db1]">
            Nenhum aviso cadastrado ainda.
          </div>
        ) : (
          notifications.map(notification => (
            <article key={notification.id} className="impact-soft-card overflow-hidden rounded-[2rem]">
              {notification.media_url && (
                <div className="h-44 bg-[#e8f6ff]">
                  {isVideo(notification.media_url) ? (
                    <video src={notification.media_url} controls className="h-full w-full bg-black object-contain" />
                  ) : isImage(notification.media_url) ? (
                    <img src={notification.media_url} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <div className="flex h-full items-center justify-center px-6 text-center text-xs font-bold text-[#6d8db1]">Mídia vinculada</div>
                  )}
                </div>
              )}
              <div className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#20a8f5]">
                      {resolveNotificationClientName(notification, clients)}
                    </p>
                    <h3 className="mt-1 text-lg font-black text-[#082653]">{notification.title}</h3>
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                    notification.active ? 'bg-emerald-50 text-emerald-700' : 'bg-zinc-100 text-zinc-500'
                  }`}>
                    {notification.active ? 'Ativo' : 'Inativo'}
                  </span>
                </div>
                {notification.body && <p className="mt-3 line-clamp-3 text-sm font-semibold leading-relaxed text-[#5f82aa]">{notification.body}</p>}
                <div className="mt-5 flex flex-wrap gap-2">
                  <button type="button" onClick={() => handleEdit(notification)} className="impact-secondary min-h-9 px-4 text-xs">
                    Editar
                  </button>
                  <button type="button" onClick={() => handleDelete(notification)} className="min-h-9 rounded-2xl border border-red-100 bg-white/80 px-4 text-xs font-black text-red-600 transition-colors hover:bg-red-50">
                    Excluir
                  </button>
                </div>
              </div>
            </article>
          ))
        )}
      </section>
    </div>
  );
};

export default AdminNotificationsPanel;
