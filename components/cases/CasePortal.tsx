import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CasePatient, CaseStage, Client } from '../../types';
import { createSupabaseCasePatient, deleteSupabaseCasePatient, fetchSupabaseCasePatients, requestCaseStageEditing } from '../../services/caseSupabaseService';
import { getClientByBoardId, getClientByCaseToken } from '../../services/supabaseService';
import { CASE_STAGE_DEFINITIONS } from '../../utils/caseConstants';
import { MOCK_CASE_PATIENTS } from '../../utils/mockCaseData';
import CasePatientDetail from './CasePatientDetail';
import CasePatientList from './CasePatientList';
import NewCasePatientForm, { NewCasePatientPayload } from './NewCasePatientForm';
import ReadyTestimonials from './ReadyTestimonials';
import { prefetchReadyTestimonials, useReadyTestimonials } from './useReadyTestimonials';
import { fetchPortalNotifications, PortalNotification } from '../../services/portalNotificationService';

interface CasePortalProps {
  token: string;
}

type PortalClient = {
  boardId: string;
  clientName: string;
  displayName: string;
  driveFolderId?: string;
  portalPassword?: string | null;
  isDemo?: boolean;
};

type PortalTab = 'cases' | 'testimonials';

const getHashParams = () => {
  const search = window.location.hash.split('?')[1] || '';
  return new URLSearchParams(search);
};

const resolveClientFromToken = async (token: string): Promise<PortalClient | null> => {
  if (token === 'demo') {
    return {
      boardId: 'demo-board',
      clientName: 'Clínica Demo',
      displayName: 'Clínica Demo',
      driveFolderId: 'demo-drive-folder',
      isDemo: true,
    };
  }

  const params = getHashParams();
  const fallbackBoardId = params.get('boardId');
  const fallbackClientName = params.get('cliente') || params.get('client');

  let client: Client | null = null;
  try {
    client = await getClientByCaseToken(token);
  } catch (e) {
    console.warn('[Cases] Nao foi possivel buscar por case_public_token. Tentando fallback.', e);
  }

  if (!client && /^\d+$/.test(token)) {
    try {
      client = await getClientByBoardId(token);
    } catch (e) {
      console.warn('[Cases] Nao foi possivel buscar por boardId.', e);
    }
  }

  if (client) {
    return {
      boardId: client.case_board_id || client.boardId,
      clientName: client.case_client_label || client.name,
      displayName: client.name,
      driveFolderId: client.drive_folder_id,
      portalPassword: client.portal_password || null,
    };
  }

  if (fallbackBoardId && fallbackClientName) {
    return {
      boardId: fallbackBoardId,
      clientName: fallbackClientName,
      displayName: fallbackClientName,
      driveFolderId: params.get('driveFolderId') || undefined,
    };
  }

  return null;
};

const CasePortal: React.FC<CasePortalProps> = ({ token }) => {
  const [portalClient, setPortalClient] = useState<PortalClient | null>(null);
  const [patients, setPatients] = useState<CasePatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create'>('list');
  const [activeTab, setActiveTab] = useState<PortalTab>('cases');
  const [testimonialSearch, setTestimonialSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionPwOk, setSessionPwOk] = useState(false);
  const [pwInput, setPwInput] = useState('');
  const [pwError, setPwError] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>([]);
  const [manualNotifications, setManualNotifications] = useState<PortalNotification[]>([]);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  const selectedPatient = useMemo(
    () => patients.find(patient => patient.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );
  const {
    testimonials: readyTestimonials,
    countsByCaseId: readyTestimonialCounts,
    refresh: refreshReadyTestimonials,
  } = useReadyTestimonials(token, portalClient?.isDemo, Boolean(portalClient));

  const editedTestimonials = useMemo(
    () => readyTestimonials.filter(item => String(item.status || '').trim().toLowerCase() === 'editado'),
    [readyTestimonials]
  );

  const unreadEditedTestimonials = useMemo(
    () => editedTestimonials.filter(item => !readNotificationIds.includes(item.id)),
    [editedTestimonials, readNotificationIds]
  );

  const unreadManualNotifications = useMemo(
    () => manualNotifications.filter(item => !readNotificationIds.includes(`admin:${item.id}`)),
    [manualNotifications, readNotificationIds]
  );

  const editedAssetCount = useMemo(
    () => unreadEditedTestimonials.reduce((sum, item) => sum + Math.max(item.assets.length, 1), 0),
    [unreadEditedTestimonials]
  );

  const unreadNotificationCount = editedAssetCount + unreadManualNotifications.length;

  const loadPatients = useCallback(async (client: PortalClient, refreshing = false) => {
    if (refreshing) setIsRefreshing(true);
    try {
      if (client.isDemo) {
        setPatients(MOCK_CASE_PATIENTS);
        return;
      }
      const loaded = await fetchSupabaseCasePatients(token);
      setPatients(loaded);
    } finally {
      if (refreshing) setIsRefreshing(false);
    }
  }, [token]);

  const loadManualNotifications = useCallback(async (client: PortalClient | null = portalClient) => {
    if (!client || client.isDemo) {
      setManualNotifications([]);
      return;
    }
    try {
      const loaded = await fetchPortalNotifications(token);
      setManualNotifications(loaded);
    } catch (err) {
      console.warn('[Cases] Nao foi possivel buscar notificacoes manuais.', err);
      setManualNotifications([]);
    }
  }, [portalClient, token]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(`case_notifications_read_${token}`);
      setReadNotificationIds(stored ? JSON.parse(stored) : []);
    } catch {
      setReadNotificationIds([]);
    }
  }, [token]);

  useEffect(() => {
    if (!notificationsOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      if (target && notificationsRef.current?.contains(target)) return;
      setNotificationsOpen(false);
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [notificationsOpen]);

  useEffect(() => {
    if (!notificationsOpen || (unreadEditedTestimonials.length === 0 && unreadManualNotifications.length === 0)) return;
    const timer = window.setTimeout(() => {
      setReadNotificationIds(previousIds => {
        const nextIds = Array.from(new Set([
          ...previousIds,
          ...unreadEditedTestimonials.map(item => item.id),
          ...unreadManualNotifications.map(item => `admin:${item.id}`),
        ]));
        try {
          localStorage.setItem(`case_notifications_read_${token}`, JSON.stringify(nextIds));
        } catch {
          // localStorage can be unavailable in private contexts.
        }
        return nextIds;
      });
    }, 900);

    return () => window.clearTimeout(timer);
  }, [notificationsOpen, token, unreadEditedTestimonials, unreadManualNotifications]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const resolvedClient = await resolveClientFromToken(token);
        if (!resolvedClient) {
          throw new Error('Link de casos não encontrado. Verifique se o link está correto.');
        }
        if (cancelled) return;
        setPortalClient(resolvedClient);
        // Check portal password
        if (resolvedClient.portalPassword) {
          const sessionKey = `portal_pw_ok_${token}`;
          const already = sessionStorage.getItem(sessionKey);
          if (already === resolvedClient.portalPassword) {
            setSessionPwOk(true);
          }
          // else: gate will be shown
        } else {
          setSessionPwOk(true);
        }
        const patientsPromise = loadPatients(resolvedClient);
        const notificationsPromise = loadManualNotifications(resolvedClient);
        const testimonialsPromise = prefetchReadyTestimonials(token, resolvedClient.isDemo).catch(err => {
          console.warn('[Cases] Nao foi possivel buscar resumo de depoimentos prontos.', err);
        });
        await patientsPromise;
        void notificationsPromise;
        void testimonialsPromise;
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Não foi possível abrir o portal.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    initialize();
    return () => { cancelled = true; };
  }, [loadPatients, token]);

  const handleRefresh = async () => {
    if (!portalClient) return;
    await loadPatients(portalClient, true);
    void refreshReadyTestimonials();
    void loadManualNotifications(portalClient);
  };

  const handleSetTab = (tab: PortalTab) => {
    setActiveTab(tab);
    setNotificationsOpen(false);
    if (tab === 'testimonials') setTestimonialSearch('');
    setMode('list');
    setSelectedPatientId(null);
  };

  const handleOpenTestimonialsForPatient = (patient: CasePatient) => {
    setNotificationsOpen(false);
    setTestimonialSearch(patient.name);
    setActiveTab('testimonials');
    setMode('list');
    setSelectedPatientId(null);
  };

  const persistReadNotifications = (ids: string[]) => {
    const uniqueIds = Array.from(new Set(ids));
    setReadNotificationIds(uniqueIds);
    try {
      localStorage.setItem(`case_notifications_read_${token}`, JSON.stringify(uniqueIds));
    } catch {
      // localStorage can be unavailable in private contexts.
    }
  };

  const handleOpenEditedMaterial = (notificationId: string, patientName: string) => {
    persistReadNotifications([...readNotificationIds, notificationId]);
    setNotificationsOpen(false);
    setTestimonialSearch(patientName);
    setActiveTab('testimonials');
    setMode('list');
    setSelectedPatientId(null);
  };

  const handleMarkAllNotificationsRead = () => {
    persistReadNotifications([
      ...readNotificationIds,
      ...editedTestimonials.map(item => item.id),
      ...manualNotifications.map(item => `admin:${item.id}`),
    ]);
  };

  const handleOpenCaseFromTestimonial = (caseId: string) => {
    setActiveTab('cases');
    setMode('list');
    setSelectedPatientId(caseId);
  };

  const handleRefreshPatient = async (patientId: string) => {
    if (!portalClient || portalClient.isDemo) return;
    await loadPatients(portalClient, true);
  };

  const handleCreatePatient = async (payload: NewCasePatientPayload) => {
    if (!portalClient) return;
    if (portalClient.isDemo) {
      const patientId = `demo-${Date.now()}`;
      setPatients(prev => [
        {
          id: patientId,
          boardId: portalClient.boardId,
          name: payload.name,
          clientName: portalClient.clientName,
          age: null,
          birthDate: payload.birthDate,
          gender: payload.gender,
          procedure: payload.procedure,
          procedureDescription: null,
          dentistResponsible: payload.dentistResponsible || null,
          notes: payload.notes,
          createdAt: new Date(),
          stages: CASE_STAGE_DEFINITIONS.map((stage, index) => ({
            id: `${patientId}-stage-${index + 1}`,
            boardId: portalClient.boardId,
            parentItemId: patientId,
            title: stage.title,
            moment: stage.moment,
            expectedItems: [],
            status: 'Fazer',
            statusColumnId: 'demo-status',
            filesColumnId: 'demo-files',
            files: [],
          })),
        },
        ...prev,
      ]);
      setSelectedPatientId(patientId);
      setMode('list');
      return;
    }
    const patientId = await createSupabaseCasePatient(token, payload);
    await loadPatients(portalClient, true);
    setSelectedPatientId(patientId);
    setMode('list');
  };

  const handleDemoUpload = async (stage: any, files: File[]) => {
    setPatients(prev => prev.map(patient => {
      if (patient.id !== stage.parentItemId) return patient;
      return {
        ...patient,
        stages: patient.stages.map(currentStage => {
          if (currentStage.id !== stage.id) return currentStage;
          return {
            ...currentStage,
            status: 'Capturado',
            files: [
              ...currentStage.files,
              ...files.map((file, index) => ({
                id: `${stage.id}-demo-upload-${Date.now()}-${index}`,
                name: file.name,
                public_url: URL.createObjectURL(file),
                type: file.type,
              })),
            ],
          };
        }),
      };
    }));
  };

  const handleDeletePatient = async (patient: CasePatient) => {
    if (!portalClient) return;
    if (portalClient.isDemo) {
      setPatients(prev => prev.filter(item => item.id !== patient.id));
      setSelectedPatientId(null);
      return;
    }
    await deleteSupabaseCasePatient(token, patient.id);
    setSelectedPatientId(null);
    await loadPatients(portalClient, true);
    void refreshReadyTestimonials();
  };

  const handleRequestStageEditing = async (stage: CaseStage) => {
    if (!portalClient || !selectedPatient) return;
    if (portalClient.isDemo) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return;
    }
    await requestCaseStageEditing(token, selectedPatient.id, stage.id);
    await loadPatients(portalClient, true);
    void refreshReadyTestimonials();
  };

  // Loading state
  if (isLoading) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 rounded-2xl border-[3px] border-zinc-200 border-t-black animate-spin" />
          <p className="mt-5 text-sm font-semibold text-zinc-500">Carregando portal...</p>
        </div>
      </main>
    );
  }

  // Error state
  if (error || !portalClient) {
    return (
      <main className="min-h-screen bg-zinc-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-zinc-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="h-7 w-7 text-zinc-500">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-zinc-900">Não foi possível abrir o portal</h1>
          <p className="mt-3 text-sm text-zinc-600 leading-relaxed">{error}</p>
        </div>
      </main>
    );
  }

  const clientInitials = portalClient.displayName.slice(0, 2).toUpperCase();

  // Password gate
  const needsPassword = portalClient.portalPassword && !sessionPwOk;
  if (needsPassword) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex justify-center">
            <img
              src="https://ik.imagekit.io/zslvvoal4/Logo%20Impact%20Blue.webp?updatedAt=1763034634122"
              alt="Impact Doctor"
              width={180}
              height={40}
              className="h-8 w-auto max-w-[180px] object-contain sm:h-10"
            />
          </div>
          <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
            <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-900">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-6 w-6 text-white">
                <path fillRule="evenodd" d="M12 1.5a5.25 5.25 0 0 0-5.25 5.25v3a3 3 0 0 0-3 3v6.75a3 3 0 0 0 3 3h10.5a3 3 0 0 0 3-3v-6.75a3 3 0 0 0-3-3v-3c0-2.9-2.35-5.25-5.25-5.25Zm3.75 8.25v-3a3.75 3.75 0 1 0-7.5 0v3h7.5Z" clipRule="evenodd" />
              </svg>
            </div>
            <h1 className="mt-4 text-2xl font-bold text-zinc-900">Portal {portalClient.displayName}</h1>
            <p className="mt-1 text-sm text-zinc-500">Digite a senha para acessar os casos clínicos.</p>
            <form
              onSubmit={e => {
                e.preventDefault();
                if (pwInput === portalClient.portalPassword) {
                  sessionStorage.setItem(`portal_pw_ok_${token}`, portalClient.portalPassword!);
                  setSessionPwOk(true);
                  setPwError(false);
                } else {
                  setPwError(true);
                  setPwInput('');
                }
              }}
              className="mt-6 space-y-4"
            >
              <label htmlFor="portal-password" className="sr-only">Senha do portal</label>
              <input
                id="portal-password"
                name="portal-password"
                type="password"
                value={pwInput}
                onChange={e => { setPwInput(e.target.value); setPwError(false); }}
                placeholder="Senha"
                autoComplete="current-password"
                aria-invalid={pwError}
                aria-describedby={pwError ? 'portal-password-error' : undefined}
                className={`w-full rounded-xl border px-4 py-3 text-sm outline-none transition-all ${
                  pwError
                    ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-2 focus:ring-red-200'
                    : 'border-zinc-200 bg-white focus:border-zinc-900 focus:ring-2 focus:ring-zinc-900/10'
                }`}
              />
              {pwError && (
                <p id="portal-password-error" className="text-sm font-medium text-red-600" aria-live="polite">Senha incorreta. Tente novamente.</p>
              )}
              <button
                type="submit"
                className="w-full rounded-xl bg-zinc-900 py-3 text-sm font-bold text-white transition-all hover:bg-zinc-700 active:scale-95"
              >
                Entrar
              </button>
            </form>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="impact-page">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-white/70 bg-white/60 backdrop-blur-2xl">
        <div className="relative mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <button
            type="button"
            onClick={() => {
              setActiveTab('cases');
              setMode('list');
              setSelectedPatientId(null);
              setTestimonialSearch('');
            }}
            aria-label="Voltar para a lista de casos"
            className="flex shrink-0 items-center gap-3 transition-opacity hover:opacity-80 active:scale-95"
          >
            <img
              src="https://ik.imagekit.io/zslvvoal4/Logo%20Impact%20Blue.webp?updatedAt=1763034634122"
              alt="Impact Doctor"
              width={180}
              height={32}
              className="h-7 w-auto max-w-[150px] shrink-0 object-contain sm:h-8 sm:max-w-[190px]"
            />
          </button>
          <div className="flex items-center gap-2">
            <div className="flex items-center rounded-2xl border border-[#cfe7fb] bg-white/60 p-1 shadow-[0_8px_24px_rgba(22,78,129,0.08)] backdrop-blur-xl">
              <button
                type="button"
                onClick={() => handleSetTab('cases')}
                className={`flex min-h-9 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                  activeTab === 'cases'
                    ? 'bg-white text-[#09315f] shadow-sm'
                    : 'text-[#7894b7] hover:text-[#09315f]'
                }`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path d="M4.25 3A2.25 2.25 0 0 0 2 5.25v9.5A2.25 2.25 0 0 0 4.25 17h11.5A2.25 2.25 0 0 0 18 14.75v-9.5A2.25 2.25 0 0 0 15.75 3H4.25Zm0 1.5h11.5a.75.75 0 0 1 .75.75V7h-13V5.25a.75.75 0 0 1 .75-.75ZM3.5 8.5h13v6.25a.75.75 0 0 1-.75.75H4.25a.75.75 0 0 1-.75-.75V8.5Z" />
                </svg>
                Casos
              </button>
              <button
                type="button"
                onClick={() => handleSetTab('testimonials')}
                className={`flex min-h-9 items-center gap-1.5 rounded-xl px-3 py-1.5 text-xs font-black transition-all ${
                  activeTab === 'testimonials'
                    ? 'bg-white text-[#09315f] shadow-sm'
                    : 'text-[#7894b7] hover:text-[#09315f]'
                }`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M1 8a2 2 0 0 1 2-2h1.5l1.447-2.17A2 2 0 0 1 7.61 3h4.78a2 2 0 0 1 1.664.89L15.5 6H17a2 2 0 0 1 2 2v6a3 3 0 0 1-3 3H4a3 3 0 0 1-3-3V8Zm9 7a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm0-1.5a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Materiais Prontos</span>
                <span className="sm:hidden">Materiais</span>
              </button>
            </div>

            <div className="relative" ref={notificationsRef}>
              <button
                type="button"
                onClick={() => setNotificationsOpen(prev => !prev)}
                className="relative flex h-11 w-11 items-center justify-center rounded-full border border-[#cfe7fb] bg-white/70 text-[#0b3768] shadow-[0_8px_24px_rgba(22,78,129,0.08)] backdrop-blur-xl transition-all hover:bg-white active:scale-95"
                aria-label="Notificações"
                aria-expanded={notificationsOpen}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5" aria-hidden="true">
                  <path d="M10 2a6 6 0 0 0-6 6v2.65L2.52 13.6A1 1 0 0 0 3.42 15h13.16a1 1 0 0 0 .9-1.4L16 10.65V8a6 6 0 0 0-6-6Zm0 16a3 3 0 0 0 2.83-2H7.17A3 3 0 0 0 10 18Z" />
                </svg>
                {unreadNotificationCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-black text-white ring-2 ring-white">
                    {unreadNotificationCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 top-[3.25rem] z-50 w-[min(21rem,calc(100vw-2rem))] overflow-hidden rounded-[1.35rem] border border-[#d6ebfb] bg-white/95 shadow-[0_24px_70px_rgba(22,78,129,0.18)] backdrop-blur-xl">
                  <div className="flex items-center justify-between gap-3 border-b border-[#e4f1fb] px-4 py-3">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[#20a8f5]">Notificações</p>
                    {unreadNotificationCount > 0 && (
                      <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                        {unreadNotificationCount} novas
                      </span>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto p-2">
                    {manualNotifications.length === 0 && editedTestimonials.length === 0 ? (
                      <div className="rounded-2xl bg-[#f5fbff] px-4 py-6 text-center">
                        <p className="text-sm font-black text-[#244f7f]">Nada novo por enquanto.</p>
                        <p className="mt-1 text-xs font-semibold text-[#7d9bbd]">Avisos do admin e materiais editados aparecem aqui.</p>
                      </div>
                    ) : (
                      <>
                        {manualNotifications.slice(0, 4).map(item => {
                          const notificationId = `admin:${item.id}`;
                          const isUnread = !readNotificationIds.includes(notificationId);
                          return (
                            <div key={item.id} className="rounded-2xl px-3 py-3 transition-colors hover:bg-[#f1f9ff]">
                              <div className="flex items-start gap-3">
                                <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                  isUnread ? 'bg-sky-100 text-sky-700' : 'bg-[#edf6ff] text-[#5f82aa]'
                                }`}>
                                  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                                    <path d="M10 2a6 6 0 0 0-6 6v2.65L2.52 13.6A1 1 0 0 0 3.42 15h13.16a1 1 0 0 0 .9-1.4L16 10.65V8a6 6 0 0 0-6-6Z" />
                                  </svg>
                                </span>
                                <div className="min-w-0 flex-1">
                                  <span className="flex min-w-0 items-center gap-2">
                                    <span className="block truncate text-sm font-black text-[#082653]">{item.title}</span>
                                    {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-sky-500" aria-label="Nova notificação" />}
                                  </span>
                                  {item.body && <p className="mt-1 line-clamp-3 text-xs font-semibold leading-relaxed text-[#5f82aa]">{item.body}</p>}
                                  {item.media_url && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(item.media_url) && (
                                    <img src={item.media_url} alt="" className="mt-2 h-24 w-full rounded-2xl object-cover" loading="lazy" decoding="async" />
                                  )}
                                  {item.media_url && /\.(mp4|m4v|mov|webm|mpeg|mpg|3gp|ogv)(\?|$)/i.test(item.media_url) && (
                                    <video src={item.media_url} controls className="mt-2 max-h-40 w-full rounded-2xl bg-black object-contain" />
                                  )}
                                  {item.media_url && (
                                    <a
                                      href={item.media_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={() => persistReadNotifications([...readNotificationIds, notificationId])}
                                      className="mt-2 inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-sky-700"
                                    >
                                      Ver mídia
                                    </a>
                                  )}
                                  {item.cta_url && (
                                    <a
                                      href={item.cta_url}
                                      target="_blank"
                                      rel="noreferrer"
                                      onClick={() => persistReadNotifications([...readNotificationIds, notificationId])}
                                      className="ml-2 mt-2 inline-flex rounded-full bg-[#e8f6ff] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#0b3768]"
                                    >
                                      {item.cta_label || 'Abrir'}
                                    </a>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {editedTestimonials.slice(0, 6).map(item => {
                          const isUnread = !readNotificationIds.includes(item.id);
                          return (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => handleOpenEditedMaterial(item.id, item.patientName)}
                              className="flex w-full items-start gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-[#f1f9ff]"
                            >
                              <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                                isUnread ? 'bg-emerald-100 text-emerald-700' : 'bg-[#edf6ff] text-[#5f82aa]'
                              }`}>
                                <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden="true">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 0 1 0 1.414l-8 8a1 1 0 0 1-1.414 0l-4-4a1 1 0 0 1 1.414-1.414L8 12.586l7.293-7.293a1 1 0 0 1 1.414 0Z" clipRule="evenodd" />
                                </svg>
                              </span>
                              <span className="min-w-0">
                                <span className="flex min-w-0 items-center gap-2">
                                  <span className="block truncate text-sm font-black text-[#082653]">{item.patientName}</span>
                                  {isUnread && <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Nova notificação" />}
                                </span>
                                <span className="mt-0.5 block truncate text-xs font-bold text-[#5f82aa]">{item.title}</span>
                                <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-emerald-700">
                                  {isUnread ? 'Novo material' : 'Lido'}
                                </span>
                              </span>
                            </button>
                          );
                        })}
                      </>
                    )}
                  </div>
                  {unreadNotificationCount > 0 && (
                    <div className="border-t border-[#e4f1fb] p-2">
                      <button
                        type="button"
                        onClick={handleMarkAllNotificationsRead}
                        className="flex w-full items-center justify-center rounded-2xl bg-[#f5fbff] px-4 py-3 text-xs font-black text-[#0b3768] transition-colors hover:bg-[#e8f6ff]"
                      >
                        Marcar tudo como lido
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="impact-shell">
        {activeTab === 'testimonials' ? (
          <ReadyTestimonials
            token={token}
            clientName={portalClient.displayName}
            isDemo={portalClient.isDemo}
            initialSearch={testimonialSearch}
            onBack={() => handleSetTab('cases')}
            onOpenCase={handleOpenCaseFromTestimonial}
          />
        ) : mode === 'create' ? (
          <NewCasePatientForm
            clientName={portalClient.displayName}
            onCancel={() => setMode('list')}
            onSubmit={handleCreatePatient}
          />
        ) : selectedPatient ? (
          <CasePatientDetail
            patient={selectedPatient}
            onBack={() => setSelectedPatientId(null)}
            onRefreshPatient={handleRefreshPatient}
            onDeletePatient={handleDeletePatient}
            onUploadStageFiles={portalClient.isDemo ? handleDemoUpload : undefined}
            readyTestimonialCount={selectedPatient ? readyTestimonialCounts[selectedPatient.id] || 0 : 0}
            onOpenTestimonials={handleOpenTestimonialsForPatient}
            onRequestStageEditing={handleRequestStageEditing}
          />
        ) : (
          <CasePatientList
            patients={patients}
            clientName={portalClient.displayName}
            onCreate={() => setMode('create')}
            onOpen={patient => setSelectedPatientId(patient.id)}
            onOpenTestimonials={handleOpenTestimonialsForPatient}
            readyTestimonialCounts={readyTestimonialCounts}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        )}
      </div>
    </main>
  );
};

export default CasePortal;
