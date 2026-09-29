import React, { useEffect, useMemo, useState } from 'react';
import { AdminApiError } from '../../services/adminClientService';
import {
  AdminManagementClient,
  AdminManagementHistoryItem,
  AdminManagementPatient,
  AdminManagementStage,
  AdminManagementStageStatus,
  fetchAdminManagement,
  updateAdminManagementStageStatus,
} from '../../services/adminPortalService';

interface AdminManagementPanelProps {
  password: string;
}

type ManagementView = 'patients' | 'requests';
type PatientTab = 'summary' | 'stages' | 'requests' | 'drive' | 'history';

const statusConfig: Record<AdminManagementStageStatus, { label: string; className: string; helper: string }> = {
  utilizado: {
    label: 'Utilizado',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
    helper: 'Bloqueia novos uploads nesta categoria.',
  },
  fora_do_padrao: {
    label: 'Fora do padrão',
    className: 'bg-amber-50 text-amber-700 ring-amber-200',
    helper: 'Alerta interno. Não bloqueia upload.',
  },
  errado: {
    label: 'Errado',
    className: 'bg-rose-50 text-rose-700 ring-rose-200',
    helper: 'Alerta interno. Não bloqueia upload.',
  },
};

const formatDate = (value?: string | null) => {
  if (!value) return 'Sem data';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem data';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatRelative = (value?: string | null) => {
  if (!value) return 'Sem envio';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Sem envio';
  const diffDays = Math.max(0, Math.floor((Date.now() - date.getTime()) / 86_400_000));
  if (diffDays === 0) return 'hoje';
  if (diffDays === 1) return 'há 1 dia';
  return `há ${diffDays} dias`;
};

const getInitials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map(part => part[0] || '').join('').toUpperCase() || 'PX';

const isLocalPreviewHost = () =>
  typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

const isAdminImageFile = (file: { type?: string | null; name?: string | null }) => {
  if (file.type?.startsWith('image/')) return true;
  return /\.(png|jpe?g|jfif|webp|gif|bmp|avif|heic|heif)$/i.test(file.name || '');
};

const formatHistoryAction = (
  item: AdminManagementHistoryItem,
  stages: AdminManagementStage[]
): { title: string; detail: string | null } => {
  const stageName = item.stage_id
    ? stages.find(s => s.id === item.stage_id)?.name || null
    : null;
  const prevStatus = ((item.previous_value as any)?.status || null) as AdminManagementStageStatus | null;
  const nextStatus = ((item.next_value as any)?.status || null) as AdminManagementStageStatus | null;
  const nextNote = ((item.next_value as any)?.note || null) as string | null;
  const prevLabel = prevStatus ? (statusConfig[prevStatus]?.label || prevStatus) : 'Sem status';
  const nextLabel = nextStatus ? (statusConfig[nextStatus]?.label || nextStatus) : 'Sem status';

  let title = item.action;
  if (item.action === 'stage_admin_status_changed') {
    if (!prevStatus && nextStatus) title = `Marcado como "${nextLabel}"`;
    else if (prevStatus && !nextStatus) title = `Status removido (era "${prevLabel}")`;
    else title = `Status alterado: "${prevLabel}" → "${nextLabel}"`;
  }

  const detail = stageName
    ? `Etapa: ${stageName}${nextNote ? ` · Obs.: ${nextNote}` : ''}`
    : nextNote || null;

  return { title, detail };
};

const recalculatePatientCounters = (patient: AdminManagementPatient): AdminManagementPatient => ({
  ...patient,
  alertCount: patient.stages.filter(stage => stage.adminStatus === 'fora_do_padrao' || stage.adminStatus === 'errado').length,
  usedCount: patient.stages.filter(stage => stage.adminStatus === 'utilizado').length,
});

const createDemoManagementData = (): { clients: AdminManagementClient[]; patients: AdminManagementPatient[] } => {
  const now = new Date();
  const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
  const makeStage = (
    id: string,
    name: string,
    moment: string,
    sortOrder: number,
    fileCount: number,
    adminStatus?: AdminManagementStageStatus | null,
    adminNote?: string | null
  ): AdminManagementStage => ({
    id,
    name,
    key: id,
    moment,
    sortOrder,
    status: fileCount > 0 ? 'capturado' : 'fazer',
    folderUrl: '#',
    fileCount,
    adminStatus,
    adminNote,
    adminUpdatedAt: adminStatus ? daysAgo(1) : null,
    usageLock: adminStatus === 'utilizado' ? {
      id: `${id}-lock`,
      editingRequestId: null,
      lockedAt: daysAgo(1),
      lockedBy: 'Demo',
    } : null,
    files: Array.from({ length: fileCount }).map((_, index) => ({
      id: `${id}-file-${index + 1}`,
      name: `${name.toLowerCase().replace(/\s+/g, '-')}-${index + 1}.jpg`,
      type: 'image/jpeg',
      publicUrl: '#',
      previewUrl: null,
      createdAt: daysAgo(Math.max(1, sortOrder - index)),
    })),
  });

  const demoStagesA = [
    makeStage('demo-a-01', 'Fotos Intraorais do Antes', 'Planejamento', 1, 4, 'utilizado'),
    makeStage('demo-a-02', 'Vídeo Panorâmico do Antes', 'Planejamento', 2, 1),
    makeStage('demo-a-03', 'Retrato Extraoral do Antes', 'Planejamento', 3, 2),
    makeStage('demo-a-09', 'Fotos Intraorais do Depois', 'Entrega', 9, 4, 'fora_do_padrao', 'Pouca nitidez nas imagens.'),
    makeStage('demo-a-10', 'Vídeo da Entrega', 'Entrega', 10, 1),
  ];
  const demoStagesB = [
    makeStage('demo-b-01', 'Fotos Intraorais do Antes', 'Planejamento', 1, 0),
    makeStage('demo-b-02', 'Vídeo Panorâmico do Antes', 'Planejamento', 2, 0),
    makeStage('demo-b-03', 'Retrato Extraoral do Antes', 'Planejamento', 3, 1, 'errado', 'Arquivo parece ser de outro paciente.'),
    makeStage('demo-b-06', 'Vídeos do Procedimento', 'Procedimento', 6, 2),
  ];

  const patients = [
    recalculatePatientCounters({
      id: 'demo-patient-a',
      clientId: 9001,
      patientName: 'Vânia Maria Trevisan',
      birthDate: '1967-05-12',
      age: 59,
      gender: 'Feminino',
      procedure: 'Facetas / Porcelana, Harmonização Facial',
      notes: 'Paciente autorizou uso dos materiais para antes/depois.',
      status: 'em_andamento',
      driveFolderUrl: '#',
      createdAt: daysAgo(8),
      updatedAt: daysAgo(1),
      coverUrl: null,
      lastUploadAt: daysAgo(1),
      totalStages: demoStagesA.length,
      stagesWithFiles: demoStagesA.filter(stage => stage.fileCount > 0).length,
      alertCount: 0,
      usedCount: 0,
      pendingEditingCount: 1,
      readyCount: 1,
      currentMoment: 'Entrega',
      stages: demoStagesA,
      requests: [
        { id: 'demo-request-a1', stageName: 'Pedido #001', status: 'Recebido', creativeType: 'Reels', sentAt: daysAgo(3), materialUrl: '#', mondaySubitemId: 'demo-sub-a1' },
        { id: 'demo-request-a2', stageName: 'Pedido #002', status: 'Editado', creativeType: 'Fotografia', sentAt: daysAgo(6), editedAt: daysAgo(2), materialUrl: '#', mondaySubitemId: 'demo-sub-a2' },
      ],
      history: [
        { id: 'demo-history-a1', action: 'stage_admin_status_changed', actor: 'Demo', stage_id: 'demo-a-01', previous_value: { status: null }, next_value: { status: 'utilizado' }, created_at: daysAgo(1) },
      ],
    }),
    recalculatePatientCounters({
      id: 'demo-patient-b',
      clientId: 9001,
      patientName: 'Carlos Alberto Silva',
      birthDate: '1961-09-03',
      age: 64,
      gender: 'Masculino',
      procedure: 'Implantes',
      notes: null,
      status: 'em_andamento',
      driveFolderUrl: '#',
      createdAt: daysAgo(15),
      updatedAt: daysAgo(4),
      coverUrl: null,
      lastUploadAt: daysAgo(4),
      totalStages: demoStagesB.length,
      stagesWithFiles: demoStagesB.filter(stage => stage.fileCount > 0).length,
      alertCount: 0,
      usedCount: 0,
      pendingEditingCount: 0,
      readyCount: 0,
      currentMoment: 'Procedimento',
      stages: demoStagesB,
      requests: [],
      history: [],
    }),
  ];

  return {
    clients: [
      {
        id: 9001,
        name: 'Essence Bento Gonçalves',
        active: true,
        casePublicToken: 'demo',
        driveFolderUrl: '#',
        patientsCount: patients.length,
        editingPendingCount: 1,
        readyMaterialsCount: 1,
        materialAlertsCount: patients.reduce((sum, patient) => sum + patient.alertCount, 0),
        usedStagesCount: patients.reduce((sum, patient) => sum + patient.usedCount, 0),
      },
      {
        id: 9002,
        name: 'Clínica Demo Norte',
        active: true,
        casePublicToken: 'demo-norte',
        driveFolderUrl: '#',
        patientsCount: 0,
        editingPendingCount: 0,
        readyMaterialsCount: 0,
        materialAlertsCount: 0,
        usedStagesCount: 0,
      },
    ],
    patients,
  };
};

const getStageStatusLabel = (stage: AdminManagementStage) => {
  if (stage.adminStatus) return statusConfig[stage.adminStatus]?.label || stage.adminStatus;
  if (stage.fileCount > 0) return 'Recebido';
  return 'Ausente';
};

const getPatientStatus = (patient: AdminManagementPatient) => {
  if (patient.alertCount > 0) return { label: 'Atenção', tone: 'bg-amber-50 text-amber-700 ring-amber-100' };
  if (patient.readyCount > 0) return { label: 'Material pronto', tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100' };
  if (patient.pendingEditingCount > 0) return { label: 'Em edição', tone: 'bg-violet-50 text-violet-700 ring-violet-100' };
  if (patient.stagesWithFiles > 0) return { label: 'Com material', tone: 'bg-sky-50 text-sky-700 ring-sky-100' };
  return { label: 'Sem material', tone: 'bg-slate-50 text-slate-600 ring-slate-100' };
};

const PatientCover = ({ patient }: { patient: AdminManagementPatient }) => {
  const [failed, setFailed] = useState(false);
  if (!patient.coverUrl || failed) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-[#eaf7ff] to-white text-lg font-black text-[#20a8f5]">
        {getInitials(patient.patientName)}
      </div>
    );
  }

  return (
    <img
      src={patient.coverUrl}
      alt={patient.patientName}
      width={240}
      height={180}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="h-full w-full object-cover"
    />
  );
};

const AdminManagementPanel: React.FC<AdminManagementPanelProps> = ({ password }) => {
  const [clients, setClients] = useState<AdminManagementClient[]>([]);
  const [patients, setPatients] = useState<AdminManagementPatient[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<number | null>(null);
  const [view, setView] = useState<ManagementView>('patients');
  const [patientTab, setPatientTab] = useState<PatientTab>('summary');
  const [activePatientId, setActivePatientId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [quickFilter, setQuickFilter] = useState<'all' | 'no-material' | 'partial' | 'alerts' | 'editing' | 'ready'>('all');
  const [isLoading, setIsLoading] = useState(true);
  const [savingStageId, setSavingStageId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [editingNoteStage, setEditingNoteStage] = useState<{ id: string; status: AdminManagementStageStatus; note: string } | null>(null);

  const loadManagement = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchAdminManagement(password);
      if (isLocalPreviewHost() && data.clients.length === 0) {
        const demo = createDemoManagementData();
        setClients(demo.clients);
        setPatients(demo.patients);
        setIsDemoMode(true);
        setSelectedClientId(prev => prev && demo.clients.some(client => client.id === prev) ? prev : null);
      } else {
        setClients(data.clients);
        setPatients(data.patients);
        setIsDemoMode(false);
        setSelectedClientId(prev => prev && data.clients.some(client => client.id === prev) ? prev : null);
      }
    } catch (err) {
      if (isLocalPreviewHost()) {
        const demo = createDemoManagementData();
        setClients(demo.clients);
        setPatients(demo.patients);
        setIsDemoMode(true);
        setSelectedClientId(prev => prev && demo.clients.some(client => client.id === prev) ? prev : null);
      } else {
        setError(err instanceof AdminApiError || err instanceof Error ? err.message : 'Falha ao carregar gerência.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadManagement();
  }, [password]);

  const selectedClient = useMemo(
    () => clients.find(client => client.id === selectedClientId) || null,
    [clients, selectedClientId]
  );

  const clientPatients = useMemo(
    () => patients.filter(patient => Number(patient.clientId) === Number(selectedClientId)),
    [patients, selectedClientId]
  );

  const filteredPatients = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clientPatients.filter(patient => {
      if (quickFilter === 'no-material' && patient.stagesWithFiles !== 0) return false;
      if (quickFilter === 'partial' && (patient.stagesWithFiles === 0 || patient.stagesWithFiles >= patient.totalStages)) return false;
      if (quickFilter === 'alerts' && patient.alertCount === 0) return false;
      if (quickFilter === 'editing' && patient.pendingEditingCount === 0) return false;
      if (quickFilter === 'ready' && patient.readyCount === 0) return false;
      if (!query) return true;
      return [patient.patientName, patient.procedure, patient.gender, patient.currentMoment]
        .filter(Boolean)
        .some(value => String(value).toLowerCase().includes(query));
    });
  }, [clientPatients, quickFilter, search]);

  const activePatient = useMemo(
    () => clientPatients.find(patient => patient.id === activePatientId) || null,
    [activePatientId, clientPatients]
  );

  const clientRequests = useMemo(
    () => clientPatients.flatMap(patient => patient.requests.map(request => ({ ...request, patient }))),
    [clientPatients]
  );

  const groupedStages = useMemo(() => {
    if (!activePatient) return [];
    const groups = new Map<string, AdminManagementStage[]>();
    activePatient.stages.forEach(stage => {
      const moment = stage.moment || 'Sem fase';
      groups.set(moment, [...(groups.get(moment) || []), stage]);
    });
    return [...groups.entries()];
  }, [activePatient]);

  const handleSelectClient = (clientId: number) => {
    setSelectedClientId(clientId);
    setActivePatientId(null);
    setView('patients');
    setPatientTab('summary');
    setSearch('');
    setQuickFilter('all');
  };

  const handleStageStatusChange = async (stage: AdminManagementStage, status: AdminManagementStageStatus | null, note?: string | null) => {
    setSavingStageId(stage.id);
    setEditingNoteStage(null);
    setError(null);
    try {
      if (isDemoMode) {
        setPatients(prev => prev.map(patient => {
          const hasStage = patient.stages.some(item => item.id === stage.id);
          if (!hasStage) return patient;
          const nextStages = patient.stages.map(item => item.id === stage.id ? {
            ...item,
            adminStatus: status,
            adminNote: status ? (note || null) : null,
            adminUpdatedAt: new Date().toISOString(),
            usageLock: status === 'utilizado' ? {
              id: `${item.id}-demo-lock`,
              editingRequestId: null,
              lockedAt: new Date().toISOString(),
              lockedBy: 'Demo',
            } : null,
          } : item);
          return recalculatePatientCounters({
            ...patient,
            stages: nextStages,
            history: [{
              id: `demo-history-${Date.now()}`,
              action: 'stage_admin_status_changed',
              actor: 'Demo',
              stage_id: stage.id,
              previous_value: { status: stage.adminStatus || null },
              next_value: { status, note: note || null },
              created_at: new Date().toISOString(),
            }, ...patient.history],
          });
        }));
      } else {
        await updateAdminManagementStageStatus(password, stage.id, status, note || null);
        await loadManagement();
      }
    } catch (err) {
      setError(err instanceof AdminApiError || err instanceof Error ? err.message : 'Falha ao salvar status do material.');
    } finally {
      setSavingStageId(null);
    }
  };

  const handleStartNoteEdit = (stage: AdminManagementStage, status: AdminManagementStageStatus) => {
    setEditingNoteStage({ id: stage.id, status, note: stage.adminNote || '' });
  };

  if (isLoading && clients.length === 0) {
    return (
      <div className="flex min-h-[360px] items-center justify-center">
        <div className="h-10 w-10 rounded-full border-[3px] border-[#d7ecfb] border-t-[#20a8f5] animate-spin" />
      </div>
    );
  }

  return (
    <section className="space-y-6">
      <div className="impact-glass rounded-[2.2rem] p-6 sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#20a8f5]">Gerência interna</p>
            <h2 className="mt-2 text-4xl font-black tracking-tight text-[#082653] sm:text-5xl">
              {selectedClient ? selectedClient.name : 'Selecione uma clínica'}
            </h2>
            <p className="mt-3 max-w-3xl text-sm font-semibold leading-relaxed text-[#6d8db1]">
              Central por clínica para revisar pacientes, pedidos e status interno dos materiais sem alterar o portal do cliente.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {selectedClient && (
              <label className="min-w-[16rem]">
                <span className="sr-only">Clínica atual</span>
                <select
                  value={selectedClient.id}
                  onChange={event => handleSelectClient(Number(event.target.value))}
                  className="min-h-12 w-full rounded-2xl border border-[#cde8fb] bg-white/85 px-4 text-sm font-black text-[#082653] outline-none focus:border-[#20a8f5] focus:ring-2 focus:ring-[#20a8f5]/15"
                >
                  {clients.map(client => <option key={client.id} value={client.id}>{client.name}</option>)}
                </select>
              </label>
            )}
            <button type="button" onClick={loadManagement} disabled={isLoading} className="impact-secondary min-h-12 px-5 text-xs">
              {isLoading ? 'Atualizando...' : 'Atualizar'}
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          {error}
        </div>
      )}

      {isDemoMode && (
        <div className="rounded-2xl border border-[#cde8fb] bg-[#eaf7ff]/80 px-4 py-3 text-sm font-bold text-[#174579]">
          Modo demonstração local ativo. Os dados abaixo são fictícios porque a API/Supabase não está rodando neste preview.
        </div>
      )}

      {!selectedClient ? (
        <div className="space-y-4">
          <label className="relative block">
            <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d9bbd]" aria-hidden="true">
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
            </svg>
            <input
              value={search}
              onChange={event => setSearch(event.target.value)}
              placeholder="Buscar clínica..."
              className="min-h-14 w-full rounded-[1.4rem] border border-[#cde8fb] bg-white/85 py-3 pl-11 pr-4 text-sm font-semibold text-[#174579] outline-none transition-colors placeholder:text-[#8aa8c6] focus:border-[#20a8f5] focus:ring-2 focus:ring-[#20a8f5]/15"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {clients
              .filter(client => !search.trim() || client.name.toLowerCase().includes(search.trim().toLowerCase()))
              .map(client => (
                <button
                  key={client.id}
                  type="button"
                  onClick={() => handleSelectClient(client.id)}
                  className="impact-soft-card group rounded-[1.7rem] p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_24px_65px_rgba(22,78,129,0.15)]"
                >
                  <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#eaf7ff] text-sm font-black text-[#20a8f5]">
                    {getInitials(client.name)}
                  </div>
                  <h3 className="text-xl font-black text-[#082653]">{client.name}</h3>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl bg-white/70 px-2 py-3">
                      <p className="text-lg font-black text-[#082653]">{client.patientsCount}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#6d8db1]">pacientes</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 px-2 py-3">
                      <p className="text-lg font-black text-violet-600">{client.editingPendingCount}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#6d8db1]">em edição</p>
                    </div>
                    <div className="rounded-2xl bg-white/70 px-2 py-3">
                      <p className="text-lg font-black text-amber-600">{client.materialAlertsCount}</p>
                      <p className="text-[9px] font-black uppercase tracking-widest text-[#6d8db1]">alertas</p>
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="impact-soft-card rounded-[1.6rem] p-2">
            <div className="grid grid-cols-2 gap-2">
              {[
                { id: 'patients', label: 'Pacientes' },
                { id: 'requests', label: 'Pedidos' },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => { setView(item.id as ManagementView); setActivePatientId(null); }}
                  className={`min-h-12 rounded-[1.25rem] text-sm font-black transition-all ${
                    view === item.id ? 'bg-white text-[#159de9] shadow-sm ring-1 ring-[#d7ebfb]' : 'text-[#6d8db1] hover:text-[#082653]'
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {view === 'patients' && !activePatient && (
            <>
              <div className="impact-glass rounded-[1.8rem] p-4">
                <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
                  <label className="relative block">
                    <svg viewBox="0 0 20 20" fill="currentColor" className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7d9bbd]" aria-hidden="true">
                      <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11ZM2 9a7 7 0 1 1 12.452 4.391l3.328 3.329a.75.75 0 1 1-1.06 1.06l-3.329-3.328A7 7 0 0 1 2 9Z" clipRule="evenodd" />
                    </svg>
                    <input
                      value={search}
                      onChange={event => setSearch(event.target.value)}
                      placeholder="Buscar paciente, procedimento ou fase..."
                      className="min-h-12 w-full rounded-[1.25rem] border border-[#cde8fb] bg-white/85 py-3 pl-11 pr-4 text-sm font-semibold text-[#174579] outline-none placeholder:text-[#8aa8c6] focus:border-[#20a8f5] focus:ring-2 focus:ring-[#20a8f5]/15"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'all', label: 'Todos' },
                      { id: 'no-material', label: 'Sem material' },
                      { id: 'partial', label: 'Material parcial' },
                      { id: 'alerts', label: 'Com alerta' },
                      { id: 'editing', label: 'Em edição' },
                      { id: 'ready', label: 'Prontos' },
                    ].map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setQuickFilter(item.id as typeof quickFilter)}
                        className={`min-h-11 rounded-2xl px-4 text-xs font-black transition-all ${
                          quickFilter === item.id ? 'bg-[#eaf7ff] text-[#159de9] ring-1 ring-[#9cddfb]' : 'bg-white/75 text-[#6d8db1] ring-1 ring-[#d7ebfb] hover:text-[#082653]'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="overflow-hidden rounded-[1.8rem] border border-[#d7ebfb] bg-white/74 shadow-[0_18px_55px_rgba(22,78,129,0.1)]">
                <div className="hidden grid-cols-[1.6fr_1fr_1fr_1fr_1fr_1fr_auto] gap-3 border-b border-[#e5f2fb] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-[#6d8db1] lg:grid">
                  <span>Paciente</span>
                  <span>Procedimento</span>
                  <span>Etapa atual</span>
                  <span>Materiais</span>
                  <span>Pendências</span>
                  <span>Último envio</span>
                  <span>Ações</span>
                </div>
                <div className="divide-y divide-[#e5f2fb]">
                  {filteredPatients.map(patient => {
                    const status = getPatientStatus(patient);
                    return (
                      <article key={patient.id} className="grid gap-4 px-5 py-4 lg:grid-cols-[1.6fr_1fr_1fr_1fr_1fr_1fr_auto] lg:items-center">
                        <div className="flex min-w-0 items-center gap-3">
                          <div className={`h-14 w-16 shrink-0 overflow-hidden rounded-2xl bg-[#eaf7ff] transition-all ${patient.alertCount > 0 ? 'ring-2 ring-amber-300' : ''}`}>
                            <PatientCover patient={patient} />
                          </div>
                          <div className="min-w-0">
                            <h3 className="truncate text-sm font-black text-[#082653]">{patient.patientName}</h3>
                            <p className="mt-1 text-xs font-bold text-[#6d8db1]">
                              {[patient.gender, patient.age ? `${patient.age}a` : null].filter(Boolean).join(' · ') || 'Sem perfil'}
                            </p>
                          </div>
                        </div>
                        <p className="text-sm font-bold text-[#174579]">{patient.procedure || 'Sem procedimento'}</p>
                        <p className="text-sm font-bold text-[#174579]">{patient.currentMoment || 'Sem fase'}</p>
                        <p className="text-sm font-black text-[#082653]">{patient.stagesWithFiles}/{patient.totalStages} enviados</p>
                        <p className={`text-sm font-black ${patient.alertCount > 0 ? 'text-amber-700' : 'text-[#6d8db1]'}`}>
                          {patient.alertCount > 0 ? `${patient.alertCount} alerta${patient.alertCount === 1 ? '' : 's'}` : 'Sem alerta'}
                        </p>
                        <p className="text-sm font-bold text-[#6d8db1]">{formatRelative(patient.lastUploadAt)}</p>
                        <div className="flex items-center justify-between gap-3 lg:justify-end">
                          <span className={`inline-flex rounded-full px-3 py-1 text-[10px] font-black ring-1 ${status.tone}`}>{status.label}</span>
                          <div className="flex items-center gap-2">
                            {selectedClient?.casePublicToken && (
                              <a
                                href={`${typeof window !== 'undefined' ? window.location.origin : ''}${typeof window !== 'undefined' ? window.location.pathname : ''}#/casos/${selectedClient.casePublicToken}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white text-[#6d8db1] ring-1 ring-[#d7ebfb] hover:text-[#159de9] transition-colors"
                                title="Ver portal do cliente"
                              >
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                                  <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
                                  <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
                                </svg>
                              </a>
                            )}
                            <button type="button" onClick={() => { setActivePatientId(patient.id); setPatientTab('summary'); }} className="impact-secondary min-h-10 px-4 text-xs">
                              Abrir
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          {view === 'patients' && activePatient && (
            <div className="space-y-5 animate-fade-in">
              <button type="button" onClick={() => setActivePatientId(null)} className="impact-secondary min-h-11 px-4 text-xs">
                ← Voltar para pacientes
              </button>
              <article className="impact-glass overflow-hidden rounded-[2.2rem]">
                <div className="relative p-6 sm:p-8">
                  <div className="absolute right-0 top-0 hidden h-full w-72 opacity-20 sm:block">
                    <PatientCover patient={activePatient} />
                    <div className="absolute inset-0 bg-gradient-to-l from-transparent to-white" />
                  </div>
                  <div className="relative max-w-3xl">
                    <div className="flex items-center gap-3">
                      <p className="text-[10px] font-black uppercase tracking-[0.24em] text-[#20a8f5]">Paciente</p>
                      {selectedClient?.casePublicToken && (
                        <a
                          href={`${typeof window !== 'undefined' ? window.location.origin : ''}${typeof window !== 'undefined' ? window.location.pathname : ''}#/casos/${selectedClient.casePublicToken}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 rounded-full bg-white/70 px-2.5 py-1 text-[10px] font-black text-[#159de9] ring-1 ring-[#d7ebfb] hover:ring-[#20a8f5]/40 transition-colors"
                          title="Ver portal do cliente"
                        >
                          <svg viewBox="0 0 20 20" fill="currentColor" className="h-3 w-3" aria-hidden="true">
                            <path fillRule="evenodd" d="M4.25 5.5a.75.75 0 0 0-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 0 0 .75-.75v-4a.75.75 0 0 1 1.5 0v4A2.25 2.25 0 0 1 12.75 17h-8.5A2.25 2.25 0 0 1 2 14.75v-8.5A2.25 2.25 0 0 1 4.25 4h5a.75.75 0 0 1 0 1.5h-5Z" clipRule="evenodd" />
                            <path fillRule="evenodd" d="M6.194 12.753a.75.75 0 0 0 1.06.053L16.5 4.44v2.81a.75.75 0 0 0 1.5 0v-4.5a.75.75 0 0 0-.75-.75h-4.5a.75.75 0 0 0 0 1.5h2.553l-9.056 8.194a.75.75 0 0 0-.053 1.06Z" clipRule="evenodd" />
                          </svg>
                          Ver portal
                        </a>
                      )}
                    </div>
                    <h3 className="mt-2 text-4xl font-black tracking-tight text-[#082653]">{activePatient.patientName}</h3>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-black text-[#174579] ring-1 ring-[#d7ebfb]">Nascimento: {formatDate(activePatient.birthDate)}</span>
                      <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-black text-[#174579] ring-1 ring-[#d7ebfb]">Procedimento: {activePatient.procedure || 'Sem procedimento'}</span>
                      <span className="rounded-full bg-white/80 px-3 py-1.5 text-xs font-black text-[#174579] ring-1 ring-[#d7ebfb]">Materiais: {activePatient.stagesWithFiles}/{activePatient.totalStages}</span>
                    </div>
                    {activePatient.notes && (
                      <p className="mt-4 rounded-2xl bg-white/70 px-4 py-3 text-sm font-semibold leading-relaxed text-[#486f9d] ring-1 ring-[#d7ebfb]">
                        {activePatient.notes}
                      </p>
                    )}
                  </div>
                </div>
              </article>

              <div className="impact-soft-card rounded-[1.6rem] p-2">
                <div className="grid gap-2 sm:grid-cols-5">
                  {[
                    { id: 'summary', label: 'Resumo' },
                    { id: 'stages', label: 'Etapas e materiais' },
                    { id: 'requests', label: 'Pedidos' },
                    { id: 'drive', label: 'Mini Drive' },
                    { id: 'history', label: 'Histórico' },
                  ].map(item => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setPatientTab(item.id as PatientTab)}
                      className={`min-h-11 rounded-[1.15rem] text-xs font-black transition-all ${
                        patientTab === item.id ? 'bg-white text-[#159de9] shadow-sm ring-1 ring-[#d7ebfb]' : 'text-[#6d8db1] hover:text-[#082653]'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {patientTab === 'summary' && (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    { label: 'Progresso', value: `${activePatient.stagesWithFiles}/${activePatient.totalStages}`, detail: 'categorias com material' },
                    { label: 'Alertas internos', value: String(activePatient.alertCount), detail: 'fora do padrão ou errado' },
                    { label: 'Pedidos em edição', value: String(activePatient.pendingEditingCount), detail: 'ainda sem retorno' },
                    { label: 'Materiais prontos', value: String(activePatient.readyCount), detail: 'retornaram do Monday' },
                  ].map(item => (
                    <div key={item.label} className="impact-soft-card rounded-[1.5rem] p-5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-[#6d8db1]">{item.label}</p>
                      <p className="mt-2 text-3xl font-black text-[#082653]">{item.value}</p>
                      <p className="mt-1 text-xs font-bold text-[#6d8db1]">{item.detail}</p>
                    </div>
                  ))}
                </div>
              )}

              {patientTab === 'stages' && (
                <div className="space-y-5">
                  {groupedStages.map(([moment, stageGroup]) => (
                    <section key={moment} className="impact-soft-card rounded-[1.8rem] p-5">
                      <h4 className="mb-1 text-[10px] font-black uppercase tracking-widest text-[#20a8f5]">{moment}</h4>
                      <div className="space-y-3">
                        {stageGroup.map(stage => (
                          <div key={stage.id} className={`rounded-[1.35rem] border bg-white/76 p-4 transition-all ${
                            stage.adminStatus === 'errado' ? 'border-rose-200' :
                            stage.adminStatus === 'fora_do_padrao' ? 'border-amber-200' :
                            stage.adminStatus === 'utilizado' ? 'border-emerald-200' :
                            'border-[#d7ebfb]'
                          }`}>
                            {/* Stage header */}
                            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2">
                                  <p className="font-black text-[#082653]">{stage.sortOrder ? `${stage.sortOrder}. ` : ''}{stage.name}</p>
                                  {stage.adminStatus && (
                                    <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-black ring-1 ${statusConfig[stage.adminStatus].className}`}>
                                      {statusConfig[stage.adminStatus].label}
                                    </span>
                                  )}
                                </div>
                                <p className="mt-1 text-xs font-bold text-[#6d8db1]">{stage.fileCount} arquivo{stage.fileCount === 1 ? '' : 's'}</p>
                                {stage.adminNote && (
                                  <p className="mt-2 rounded-xl bg-amber-50/60 px-3 py-1.5 text-xs font-semibold text-amber-800">📝 {stage.adminNote}</p>
                                )}
                              </div>

                              {/* Action buttons */}
                              <div className="flex flex-wrap gap-2">
                                {savingStageId === stage.id ? (
                                  <span className="inline-flex h-10 items-center gap-2 rounded-2xl bg-white px-3 text-[11px] font-black text-[#6d8db1] ring-1 ring-[#d7ebfb]">
                                    <span className="h-3.5 w-3.5 rounded-full border-2 border-[#d7ebfb] border-t-[#20a8f5] animate-spin" />
                                    Salvando...
                                  </span>
                                ) : (
                                  <>
                                    {/* Utilizado — prominent primary button */}
                                    <button
                                      type="button"
                                      disabled={savingStageId === stage.id}
                                      onClick={() => handleStageStatusChange(stage, stage.adminStatus === 'utilizado' ? null : 'utilizado')}
                                      title={statusConfig.utilizado.helper}
                                      className={`min-h-10 rounded-2xl px-4 text-[11px] font-black ring-1 transition-all disabled:opacity-60 ${
                                        stage.adminStatus === 'utilizado'
                                          ? 'bg-emerald-500 text-white ring-emerald-400 shadow-[0_6px_18px_rgba(16,185,129,0.3)]'
                                          : stage.fileCount > 0
                                          ? 'bg-emerald-50 text-emerald-700 ring-emerald-200 hover:bg-emerald-100'
                                          : 'bg-white text-[#6d8db1] ring-[#d7ebfb] opacity-50'
                                      }`}
                                    >
                                      {stage.adminStatus === 'utilizado' ? '✓ Utilizado' : 'Marcar utilizado'}
                                    </button>

                                    {/* Fora do padrão */}
                                    <button
                                      type="button"
                                      disabled={savingStageId === stage.id}
                                      onClick={() => {
                                        if (stage.adminStatus === 'fora_do_padrao') {
                                          handleStageStatusChange(stage, null);
                                        } else {
                                          handleStartNoteEdit(stage, 'fora_do_padrao');
                                        }
                                      }}
                                      title={statusConfig.fora_do_padrao.helper}
                                      className={`min-h-10 rounded-2xl px-3 text-[11px] font-black ring-1 transition-all disabled:opacity-60 ${
                                        stage.adminStatus === 'fora_do_padrao' ? statusConfig.fora_do_padrao.className : 'bg-white text-[#6d8db1] ring-[#d7ebfb] hover:text-amber-700'
                                      }`}
                                    >
                                      Fora do padrão
                                    </button>

                                    {/* Errado */}
                                    <button
                                      type="button"
                                      disabled={savingStageId === stage.id}
                                      onClick={() => {
                                        if (stage.adminStatus === 'errado') {
                                          handleStageStatusChange(stage, null);
                                        } else {
                                          handleStartNoteEdit(stage, 'errado');
                                        }
                                      }}
                                      title={statusConfig.errado.helper}
                                      className={`min-h-10 rounded-2xl px-3 text-[11px] font-black ring-1 transition-all disabled:opacity-60 ${
                                        stage.adminStatus === 'errado' ? statusConfig.errado.className : 'bg-white text-[#6d8db1] ring-[#d7ebfb] hover:text-rose-700'
                                      }`}
                                    >
                                      Errado
                                    </button>

                                    {stage.folderUrl && (
                                      <a href={stage.folderUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center rounded-2xl bg-[#eaf7ff] px-3 text-[11px] font-black text-[#159de9] ring-1 ring-[#cde8fb] hover:bg-[#d7f0ff] transition-colors">
                                        Pasta ↗
                                      </a>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Inline note editor */}
                            {editingNoteStage?.id === stage.id && (
                              <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4 animate-fade-in">
                                <p className="mb-2 text-xs font-black text-amber-700">Observação interna — {statusConfig[editingNoteStage.status].label}</p>
                                <textarea
                                  rows={3}
                                  value={editingNoteStage.note}
                                  onChange={e => setEditingNoteStage(prev => prev ? { ...prev, note: e.target.value } : null)}
                                  placeholder="Descreva o problema (ex: imagem fora de foco, paciente errado...)"
                                  className="w-full resize-y rounded-xl border border-amber-200 bg-white px-3 py-2 text-sm font-semibold text-[#486f9d] outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200/50 placeholder:text-[#8aa8c6]"
                                  autoFocus
                                />
                                <div className="mt-3 flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleStageStatusChange(stage, editingNoteStage.status, editingNoteStage.note || null)}
                                    className="min-h-10 rounded-2xl bg-amber-500 px-5 text-xs font-black text-white shadow-[0_6px_18px_rgba(245,158,11,0.3)] hover:bg-amber-600 transition-colors"
                                  >
                                    Salvar
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingNoteStage(null)}
                                    className="min-h-10 rounded-2xl bg-white px-4 text-xs font-black text-[#6d8db1] ring-1 ring-[#d7ebfb] hover:text-[#082653] transition-colors"
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* File thumbnails */}
                            {stage.files.length > 0 && (
                              <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
                                {stage.files.slice(0, 8).map(file => (
                                  <a
                                    key={file.id}
                                    href={(file as any).publicUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title={file.name}
                                    className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-[#eaf7ff] ring-1 ring-[#d7ebfb] hover:ring-[#20a8f5]/50 transition-all"
                                  >
                                    {isAdminImageFile(file) && (file as any).previewUrl ? (
                                      <img
                                        src={(file as any).previewUrl}
                                        alt={file.name}
                                        loading="lazy"
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <div className="flex h-full w-full items-center justify-center">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-[#7d9bbd]">
                                          <path strokeLinecap="round" strokeLinejoin="round" d="m18.375 12.739-7.693 7.693a4.5 4.5 0 0 1-6.364-6.364l10.94-10.94A3 3 0 1 1 19.5 7.372L8.552 18.32m.009-.01-.01.01m5.699-9.941-7.81 7.81a1.5 1.5 0 0 0 2.112 2.13" />
                                        </svg>
                                      </div>
                                    )}
                                    <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1.5 py-1 text-[8px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity truncate">
                                      {file.name}
                                    </div>
                                  </a>
                                ))}
                                {stage.files.length > 8 && (
                                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl bg-[#eaf7ff] ring-1 ring-[#d7ebfb]">
                                    <span className="text-xs font-black text-[#6d8db1]">+{stage.files.length - 8}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}

              {patientTab === 'requests' && (
                <div className="space-y-3">
                  {activePatient.requests.length === 0 ? (
                    <div className="impact-soft-card rounded-[1.6rem] p-8 text-center text-sm font-black text-[#6d8db1]">Nenhum pedido de edição para este paciente.</div>
                  ) : activePatient.requests.map(request => (
                    <article key={request.id} className="impact-soft-card rounded-[1.5rem] p-5">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-[#20a8f5]">Pedido</p>
                          <h4 className="mt-1 text-lg font-black text-[#082653]">{request.stageName || request.creativeType || 'Pedido de edição'}</h4>
                          <p className="mt-1 text-xs font-bold text-[#6d8db1]">Enviado em {formatDate(request.sentAt)} · Status: {request.status || 'Recebido'}</p>
                        </div>
                        {request.materialUrl && <a href={request.materialUrl} target="_blank" rel="noreferrer" className="impact-secondary min-h-10 px-4 text-xs">Material</a>}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {patientTab === 'drive' && (
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                  {activePatient.stages.filter(stage => stage.fileCount > 0).length === 0 ? (
                    <div className="impact-soft-card rounded-[1.6rem] p-8 text-center text-sm font-black text-[#6d8db1] sm:col-span-2 xl:col-span-3">
                      Nenhum arquivo enviado ainda.
                    </div>
                  ) : activePatient.stages.filter(stage => stage.fileCount > 0).map(stage => (
                    <article key={stage.id} className="impact-soft-card rounded-[1.5rem] overflow-hidden">
                      <div className="flex items-start justify-between gap-3 p-4 pb-3">
                        <div className="min-w-0">
                          <p className="truncate font-black text-[#082653]">{stage.name}</p>
                          <p className="mt-0.5 text-xs font-bold text-[#6d8db1]">{stage.fileCount} arquivo{stage.fileCount === 1 ? '' : 's'}</p>
                        </div>
                        {stage.folderUrl && (
                          <a href={stage.folderUrl} target="_blank" rel="noreferrer" className="shrink-0 text-xs font-black text-[#159de9] hover:underline">
                            Abrir pasta ↗
                          </a>
                        )}
                      </div>
                      {/* Thumbnail grid */}
                      <div className="grid grid-cols-3 gap-1 px-4 pb-4">
                        {stage.files.slice(0, 6).map(file => (
                          <a
                            key={file.id}
                            href={(file as any).publicUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={file.name}
                            className="group relative aspect-square overflow-hidden rounded-xl bg-[#eaf7ff] ring-1 ring-[#d7ebfb] hover:ring-[#20a8f5]/50 transition-all"
                          >
                            {isAdminImageFile(file) && (file as any).previewUrl ? (
                              <img
                                src={(file as any).previewUrl}
                                alt={file.name}
                                loading="lazy"
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full flex-col items-center justify-center gap-1 p-2">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-6 w-6 text-[#7d9bbd]">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                                </svg>
                                <span className="text-center text-[8px] font-bold text-[#6d8db1] leading-tight line-clamp-2">{file.name}</span>
                              </div>
                            )}
                            <div className="absolute inset-x-0 bottom-0 bg-black/50 px-1 py-0.5 text-[7px] font-bold text-white opacity-0 group-hover:opacity-100 transition-opacity truncate">
                              {file.name}
                            </div>
                          </a>
                        ))}
                        {stage.files.length > 6 && (
                          <div className="flex aspect-square items-center justify-center rounded-xl bg-[#eaf7ff] ring-1 ring-[#d7ebfb]">
                            <span className="text-xs font-black text-[#6d8db1]">+{stage.files.length - 6}</span>
                          </div>
                        )}
                      </div>
                    </article>
                  ))}
                </div>
              )}

              {patientTab === 'history' && (
                <div className="space-y-3">
                  {activePatient.history.length === 0 ? (
                    <div className="impact-soft-card rounded-[1.6rem] p-8 text-center text-sm font-black text-[#6d8db1]">Nenhum histórico interno ainda.</div>
                  ) : activePatient.history.map(item => {
                    const formatted = formatHistoryAction(item, activePatient.stages);
                    return (
                      <article key={item.id} className="impact-soft-card rounded-[1.35rem] p-4">
                        <p className="text-sm font-black text-[#082653]">{formatted.title}</p>
                        {formatted.detail && (
                          <p className="mt-1 text-xs font-semibold text-[#486f9d]">{formatted.detail}</p>
                        )}
                        <p className="mt-2 text-[10px] font-bold text-[#8aa8c6] uppercase tracking-wider">
                          {item.actor || 'Admin'} · {formatDate(item.created_at)}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {view === 'requests' && (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {clientRequests.length === 0 ? (
                <div className="impact-soft-card rounded-[1.6rem] p-8 text-center text-sm font-black text-[#6d8db1] sm:col-span-2 xl:col-span-3">Nenhum pedido nesta clínica.</div>
              ) : clientRequests.map(request => (
                <article key={request.id} className="impact-soft-card rounded-[1.55rem] p-5">
                  <p className="text-[10px] font-black uppercase tracking-widest text-[#20a8f5]">Pedido</p>
                  <h3 className="mt-1 text-lg font-black text-[#082653]">{request.patient.patientName}</h3>
                  <p className="mt-1 text-xs font-bold text-[#6d8db1]">{request.stageName || request.creativeType || 'Pedido de edição'} · {formatDate(request.sentAt)}</p>
                  <div className="mt-4 flex items-center justify-between gap-3">
                    <span className="rounded-full bg-white/80 px-3 py-1 text-[10px] font-black text-[#174579] ring-1 ring-[#d7ebfb]">{request.status || 'Recebido'}</span>
                    <button type="button" onClick={() => { setView('patients'); setActivePatientId(request.patient.id); setPatientTab('requests'); }} className="text-xs font-black text-[#159de9]">
                      Ver paciente
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}
    </section>
  );
};

export default AdminManagementPanel;
