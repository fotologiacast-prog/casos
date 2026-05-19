import React, { useEffect, useMemo, useState } from 'react';
import { AdminApiError } from '../../services/adminClientService';
import {
  AdminEditingRequest,
  AdminEditingRequestStage,
  listAdminEditingRequests,
  updateAdminEditingRequestMaterials,
} from '../../services/adminPortalService';

interface AdminEditingRequestsPanelProps {
  password: string;
}

const formatDate = (value?: string | null) => {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const getInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map(part => part[0] || '')
    .join('')
    .toUpperCase() || 'PX';

const getStatusTone = (status?: string | null) => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'edited' || value === 'editado') return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (value === 'review' || value === 'revisão' || value === 'revisao') return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-sky-50 text-sky-700 ring-sky-100';
};

const getStatusLabel = (status?: string | null) => {
  const value = String(status || '').trim().toLowerCase();
  if (value === 'edited' || value === 'editado') return 'Editado';
  if (value === 'review' || value === 'revisão' || value === 'revisao') return 'Em revisão';
  return 'Recebido';
};

const getStageSummary = (stage: AdminEditingRequestStage) => {
  const count = stage.files.length;
  return `${count} arquivo${count === 1 ? '' : 's'}`;
};

const getStageOpenUrl = (stage: AdminEditingRequestStage) =>
  stage.files.find(file => file.publicUrl && file.publicUrl !== '#')?.publicUrl || null;

const getFileKind = (type?: string | null) => {
  const value = String(type || '').toLowerCase();
  if (value.startsWith('video/')) return 'Video';
  if (value.startsWith('image/')) return 'Imagem';
  if (value.startsWith('audio/')) return 'Audio';
  return 'Arquivo';
};

const RequestCover = ({ request }: { request: AdminEditingRequest }) => {
  const [failed, setFailed] = useState(false);
  if (!request.coverUrl || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#eaf7ff] to-white text-3xl font-black text-[#20a8f5]">
        {getInitials(request.patientName)}
      </div>
    );
  }

  return (
    <img
      src={request.coverUrl}
      alt={request.patientName}
      width={360}
      height={260}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  );
};

const AdminEditingRequestsPanel: React.FC<AdminEditingRequestsPanelProps> = ({ password }) => {
  const [requests, setRequests] = useState<AdminEditingRequest[]>([]);
  const [selectedByRequestId, setSelectedByRequestId] = useState<Record<string, string[]>>({});
  const [activeRequestId, setActiveRequestId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'empty' | 'marked'>('all');
  const [isLoading, setIsLoading] = useState(false);
  const [savingRequestId, setSavingRequestId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedRequestId, setSavedRequestId] = useState<string | null>(null);

  const loadRequests = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const loaded = await listAdminEditingRequests(password);
      setRequests(loaded);
      setSelectedByRequestId(Object.fromEntries(loaded.map(request => [request.id, request.usedStageIds || []])));
    } catch (err) {
      setError(err instanceof AdminApiError || err instanceof Error ? err.message : 'Falha ao carregar pedidos.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, [password]);

  const filteredRequests = useMemo(() => {
    const query = search.trim().toLowerCase();
    return requests.filter(request => {
      const selectedCount = selectedByRequestId[request.id]?.length || 0;
      if (statusFilter === 'empty' && selectedCount > 0) return false;
      if (statusFilter === 'marked' && selectedCount === 0) return false;
      if (!query) return true;
      return [
        request.patientName,
        request.clientName,
        request.patientProcedure,
        request.requestedStageName,
        request.creativeType,
      ].filter(Boolean).some(value => String(value).toLowerCase().includes(query));
    });
  }, [requests, search, selectedByRequestId, statusFilter]);

  const totals = useMemo(() => {
    const marked = requests.filter(request => (selectedByRequestId[request.id]?.length || 0) > 0).length;
    return {
      total: requests.length,
      empty: requests.length - marked,
      marked,
    };
  }, [requests, selectedByRequestId]);

  const activeRequest = useMemo(
    () => filteredRequests.find(request => request.id === activeRequestId) || null,
    [activeRequestId, filteredRequests]
  );

  const toggleStage = (requestId: string, stageId: string) => {
    setSavedRequestId(null);
    setSelectedByRequestId(prev => {
      const selected = new Set(prev[requestId] || []);
      if (selected.has(stageId)) selected.delete(stageId);
      else selected.add(stageId);
      return { ...prev, [requestId]: [...selected] };
    });
  };

  const handleSave = async (request: AdminEditingRequest) => {
    setSavingRequestId(request.id);
    setError(null);
    setSavedRequestId(null);
    try {
      const selected = selectedByRequestId[request.id] || [];
      const usedStageIds = await updateAdminEditingRequestMaterials(password, request.id, selected);
      setSelectedByRequestId(prev => ({ ...prev, [request.id]: usedStageIds }));
      setRequests(prev => prev.map(item => item.id === request.id ? { ...item, usedStageIds, usedCount: usedStageIds.length } : item));
      setSavedRequestId(request.id);
      window.setTimeout(() => setSavedRequestId(null), 2200);
    } catch (err) {
      setError(err instanceof AdminApiError || err instanceof Error ? err.message : 'Falha ao salvar materiais usados.');
    } finally {
      setSavingRequestId(null);
    }
  };

  return (
    <section className="space-y-6">
      <div className="impact-glass overflow-hidden rounded-[2.2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#20a8f5]">Fila da edição</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight text-[#082653] sm:text-5xl">Pedidos de edição</h2>
            <p className="mt-3 max-w-2xl text-sm font-semibold leading-relaxed text-[#6d8db1]">
              Marque quais materiais o editor usou em cada pedido. O portal bloqueia novos uploads nessas etapas para preservar o material já usado.
            </p>
          </div>
          <button
            type="button"
            onClick={loadRequests}
            disabled={isLoading}
            className="impact-secondary min-h-12 px-5 text-xs"
          >
            {isLoading ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {[
          { label: 'Pedidos recebidos', value: totals.total, tone: 'bg-[#eaf7ff] text-[#20a8f5]' },
          { label: 'Aguardando marcação', value: totals.empty, tone: 'bg-amber-50 text-amber-600' },
          { label: 'Materiais bloqueados', value: totals.marked, tone: 'bg-emerald-50 text-emerald-600' },
        ].map(item => (
          <div key={item.label} className="impact-soft-card rounded-[1.5rem] p-5">
            <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-2xl ${item.tone}`}>
              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                <path fillRule="evenodd" d="M4.25 3A2.25 2.25 0 0 0 2 5.25v9.5A2.25 2.25 0 0 0 4.25 17h11.5A2.25 2.25 0 0 0 18 14.75v-9.5A2.25 2.25 0 0 0 15.75 3H4.25Zm5.28 10.03 4.5-4.5a.75.75 0 0 0-1.06-1.06L9 11.44 7.03 9.47a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0Z" clipRule="evenodd" />
              </svg>
            </div>
            <p className="text-3xl font-black text-[#082653]">{item.value}</p>
            <p className="mt-1 text-xs font-black uppercase tracking-widest text-[#6d8db1]">{item.label}</p>
          </div>
        ))}
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      <div className="impact-glass rounded-[2rem] p-4 sm:p-5">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <label className="relative block">
            <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d9bbd]" aria-hidden="true">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar por paciente, cliente, procedimento ou material..."
              className="min-h-12 w-full rounded-[1.25rem] border border-[#cde8fb] bg-white/85 py-3 pl-11 pr-4 text-sm font-semibold text-[#174579] outline-none transition-colors placeholder:text-[#8aa8c6] focus:border-[#20a8f5] focus:ring-2 focus:ring-[#20a8f5]/15"
            />
          </label>
          <div className="grid grid-cols-3 gap-2 rounded-[1.25rem] bg-white/70 p-1 ring-1 ring-[#d7ebfb]">
            {[
              { id: 'all', label: 'Todos' },
              { id: 'empty', label: 'Vazios' },
              { id: 'marked', label: 'Marcados' },
            ].map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => setStatusFilter(item.id as typeof statusFilter)}
                className={`rounded-2xl px-4 py-2 text-xs font-black transition-all ${
                  statusFilter === item.id ? 'bg-white text-[#159de9] shadow-sm' : 'text-[#6d8db1] hover:text-[#174579]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16">
          <div className="h-9 w-9 rounded-full border-2 border-[#d7ecfb] border-t-[#20a8f5] animate-spin" />
        </div>
      ) : filteredRequests.length === 0 ? (
        <div className="impact-soft-card rounded-[2rem] p-10 text-center">
          <p className="text-sm font-black text-[#082653]">Nenhum pedido encontrado.</p>
          <p className="mt-1 text-sm font-semibold text-[#6d8db1]">Quando um cliente mandar material para edição, ele aparece aqui.</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            {filteredRequests.map(request => {
              const selectedCount = selectedByRequestId[request.id]?.length || 0;
              const isActive = activeRequestId === request.id;
              return (
                <button
                  key={request.id}
                  type="button"
                  onClick={() => setActiveRequestId(request.id)}
                  className={`group overflow-hidden rounded-[2rem] bg-white/82 p-3 text-left shadow-[0_16px_44px_rgba(8,38,83,0.08)] ring-1 transition-all hover:-translate-y-0.5 hover:shadow-[0_22px_60px_rgba(8,38,83,0.12)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#20a8f5] ${
                    isActive ? 'ring-[#20a8f5]' : 'ring-[#d7ebfb]'
                  }`}
                >
                  <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[1.45rem] bg-[#eaf7ff]">
                    <RequestCover request={request} />
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#06234f]/82 via-[#06234f]/34 to-transparent p-3">
                      <p className="truncate text-sm font-black text-white">{request.patientName}</p>
                      <p className="mt-0.5 truncate text-[11px] font-bold text-white/78">
                        {[request.patientProcedure, request.patientAge ? `${request.patientAge}a` : null].filter(Boolean).join(' · ') || request.clientName}
                      </p>
                    </div>
                    <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-[10px] font-black ring-1 ${getStatusTone(request.status)}`}>
                      {getStatusLabel(request.status)}
                    </span>
                  </div>
                  <div className="p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-[#eaf7ff] px-3 py-1 text-[10px] font-black uppercase tracking-wider text-[#159de9]">
                        {request.clientName}
                      </span>
                      {request.creativeType && (
                        <span className="rounded-full bg-white px-3 py-1 text-[10px] font-black text-[#6d8db1] ring-1 ring-[#d7ebfb]">
                          {request.creativeType}
                        </span>
                      )}
                    </div>
                    <h3 className="mt-3 truncate text-xl font-black tracking-tight text-[#082653]">{request.patientName}</h3>
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-bold text-[#42668f]">
                      <span>{request.availableStages.length} materiais</span>
                      <span>{selectedCount} selecionados</span>
                      <span>{formatDate(request.sentAt)}</span>
                      <span>{request.requestedStageName || 'Pedido geral'}</span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {activeRequest ? (() => {
            const selected = new Set(selectedByRequestId[activeRequest.id] || []);
            const files = activeRequest.availableStages.flatMap(stage =>
              stage.files.map(file => ({
                ...file,
                stageId: stage.id,
                stageName: stage.name,
                stageMoment: stage.moment,
                selected: selected.has(stage.id),
              }))
            );

            return (
              <article className="impact-glass rounded-[2.35rem] p-4 sm:p-6">
                <div className="flex flex-col gap-4 border-b border-[#d7ebfb] pb-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="flex min-w-0 items-center gap-4">
                    <div className="h-20 w-20 shrink-0 overflow-hidden rounded-[1.45rem] bg-[#eaf7ff]">
                      <RequestCover request={activeRequest} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[#20a8f5]">Pedido aberto</p>
                      <h3 className="mt-1 truncate text-2xl font-black tracking-tight text-[#082653]">{activeRequest.patientName}</h3>
                      <p className="mt-1 text-sm font-bold text-[#6d8db1]">
                        {[activeRequest.clientName, activeRequest.patientProcedure, activeRequest.patientAge ? `${activeRequest.patientAge}a` : null, activeRequest.patientGender].filter(Boolean).join(' · ')}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSave(activeRequest)}
                    disabled={savingRequestId === activeRequest.id}
                    className="impact-primary min-h-12 px-5 text-xs"
                  >
                    {savingRequestId === activeRequest.id ? 'Salvando...' : savedRequestId === activeRequest.id ? 'Salvo' : 'Salvar marcação'}
                  </button>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
                  <div className="rounded-[1.8rem] bg-white/78 p-4 ring-1 ring-[#d7ebfb]">
                    <div className="mb-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#20a8f5]">Conteúdos do pedido</p>
                      <h4 className="mt-1 text-lg font-black text-[#082653]">Marque o que entrou na edição</h4>
                    </div>
                    <div className="max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                      {activeRequest.availableStages.map(stage => {
                        const checked = selected.has(stage.id);
                        const disabled = stage.lockedByOtherRequest;
                        const openUrl = getStageOpenUrl(stage);
                        return (
                          <div
                            key={stage.id}
                            className={`rounded-[1.35rem] border p-4 transition-colors ${
                              checked
                                ? 'border-emerald-200 bg-emerald-50/85'
                                : disabled
                                  ? 'border-slate-200 bg-slate-50 opacity-70'
                                  : 'border-[#d7ebfb] bg-white hover:border-[#9cddfb]'
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <label className="mt-0.5 flex shrink-0 cursor-pointer items-center">
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  disabled={disabled}
                                  onChange={() => toggleStage(activeRequest.id, stage.id)}
                                  className="mt-1 h-5 w-5 rounded border-[#b8d8ef] text-[#20a8f5] focus:ring-[#20a8f5]"
                                />
                                <span className="sr-only">Marcar {stage.name} como usado</span>
                              </label>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <p className="font-black text-[#082653]">{stage.name}</p>
                                  {stage.moment && (
                                    <span className="rounded-full bg-[#eaf7ff] px-2 py-0.5 text-[10px] font-black text-[#159de9]">{stage.moment}</span>
                                  )}
                                  {disabled && (
                                    <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-black text-slate-600">Bloqueado em outro pedido</span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs font-bold text-[#6d8db1]">{getStageSummary(stage)}</p>
                              </div>
                              {openUrl ? (
                                <a
                                  href={openUrl}
                                  target="_blank"
                                  rel="noreferrer"
                                  onClick={event => event.stopPropagation()}
                                  className="inline-flex min-h-10 shrink-0 items-center rounded-2xl bg-white px-4 text-xs font-black text-[#159de9] ring-1 ring-[#cde8fb] transition-colors hover:bg-[#eaf7ff]"
                                >
                                  Abrir
                                </a>
                              ) : null}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[1.8rem] bg-white/78 p-4 ring-1 ring-[#d7ebfb]">
                    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#20a8f5]">Mini drive</p>
                        <h4 className="mt-1 text-lg font-black text-[#082653]">Arquivos do pedido</h4>
                      </div>
                      <span className="rounded-full bg-[#eaf7ff] px-3 py-1 text-[10px] font-black text-[#159de9]">
                        {files.filter(file => file.selected).length}/{files.length} selecionados
                      </span>
                    </div>
                    <div className="grid max-h-[28rem] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
                      {files.map(file => (
                        <a
                          key={`${file.stageId}-${file.id}`}
                          href={file.publicUrl && file.publicUrl !== '#' ? file.publicUrl : undefined}
                          target="_blank"
                          rel="noreferrer"
                          aria-disabled={!file.publicUrl || file.publicUrl === '#'}
                          className={`group flex min-h-28 flex-col justify-between rounded-[1.35rem] border p-3 transition-all ${
                            file.selected
                              ? 'border-emerald-200 bg-emerald-50 shadow-[0_14px_36px_rgba(16,185,129,0.12)]'
                              : 'border-[#d7ebfb] bg-white hover:border-[#9cddfb] hover:bg-[#f4fbff]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                              file.selected ? 'bg-emerald-100 text-emerald-700' : 'bg-[#eaf7ff] text-[#159de9]'
                            }`}>
                              <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                                <path fillRule="evenodd" d="M4.25 3A2.25 2.25 0 0 0 2 5.25v9.5A2.25 2.25 0 0 0 4.25 17h11.5A2.25 2.25 0 0 0 18 14.75v-9.5A2.25 2.25 0 0 0 15.75 3H4.25Zm5.28 10.03 4.5-4.5a.75.75 0 0 0-1.06-1.06L9 11.44 7.03 9.47a.75.75 0 0 0-1.06 1.06l2.5 2.5a.75.75 0 0 0 1.06 0Z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                              file.selected ? 'bg-white text-emerald-700' : 'bg-[#eaf7ff] text-[#42668f]'
                            }`}>
                              {file.selected ? 'Selecionado' : getFileKind(file.type)}
                            </span>
                          </div>
                          <div className="mt-4 min-w-0">
                            <p className="truncate text-sm font-black text-[#082653]">{file.name}</p>
                            <p className="mt-1 line-clamp-2 text-[11px] font-bold leading-snug text-[#6d8db1]">
                              {file.stageName}{file.stageMoment ? ` · ${file.stageMoment}` : ''}
                            </p>
                          </div>
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              </article>
            );
          })() : (
            <div className="impact-soft-card rounded-[2rem] p-10 text-center">
              <p className="text-sm font-black text-[#082653]">Selecione um pedido para revisar.</p>
              <p className="mt-1 text-sm font-semibold text-[#6d8db1]">Os checks e o mini drive aparecem somente depois de abrir um card.</p>
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default AdminEditingRequestsPanel;
