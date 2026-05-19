import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CasePatient, CaseStage, Client } from '../../types';
import { createSupabaseCasePatient, deleteSupabaseCasePatient, fetchSupabaseCasePatients, requestCaseStageEditing, updateSupabaseCasePatient } from '../../services/caseSupabaseService';
import { getClientByBoardId, getClientByCaseToken } from '../../services/supabaseService';
import { CASE_STAGE_DEFINITIONS } from '../../utils/caseConstants';
import { MOCK_CASE_PATIENTS } from '../../utils/mockCaseData';
import CasePatientDetail from './CasePatientDetail';
import CasePatientList from './CasePatientList';
import NewCasePatientForm, { NewCasePatientPayload } from './NewCasePatientForm';
import ProductionTrackingTab from './ProductionTrackingTab';
import ReadyTestimonials from './ReadyTestimonials';
import { prefetchReadyTestimonials, useReadyTestimonials } from './useReadyTestimonials';
import { fetchPortalNotifications, markPortalNotificationsRead, PortalNotification } from '../../services/portalNotificationService';
import { getProductionStatus, getCaseThumbnail } from './caseUiUtils';

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

type PortalTab = 'cases' | 'testimonials' | 'tracking';

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

const formatElapsedTime = (timestamp: number) => {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return 'agora';
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'agora';
  if (diffMin < 60) return `há ${diffMin}m`;
  if (diffHr < 24) return `há ${diffHr}h`;
  return `há ${diffDay}d`;
};

const NotificationAvatar: React.FC<{ src: string | null; name: string; type?: string }> = ({ src, name, type }) => {
  if (type === 'admin') {
    return (
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 ring-1 ring-sky-100/80 shadow-sm">
        <svg viewBox="0 0 20 20" fill="currentColor" className="h-4.5 w-4.5">
          <path d="M10 2a6 6 0 0 0-6 6v2.65L2.52 13.6A1 1 0 0 0 3.42 15h13.16a1 1 0 0 0 .9-1.4L16 10.65V8a6 6 0 0 0-6-6Z" />
        </svg>
      </div>
    );
  }

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
        decoding="async"
        loading="lazy"
      />
    );
  }

  const initials = name
    .split(' ')
    .slice(0, 2)
    .map(n => n[0])
    .join('')
    .toUpperCase();

  return (
    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#e8f6ff] to-[#cfe7fb] text-[11px] font-black text-[#20a8f5] ring-1 ring-[#cce7fb]/60 shadow-sm">
      {initials || 'P'}
    </div>
  );
};

const CasePortal: React.FC<CasePortalProps> = ({ token }) => {
  const [portalClient, setPortalClient] = useState<PortalClient | null>(null);
  const [patients, setPatients] = useState<CasePatient[]>([]);
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [editFromDetail, setEditFromDetail] = useState(false);
  const [comingFromTracking, setComingFromTracking] = useState(false);
  const [activeTab, setActiveTab] = useState<PortalTab>('cases');
  const [testimonialSearch, setTestimonialSearch] = useState('');
  const [productionFilter, setProductionFilter] = useState<string | null>(null);
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

  const localNotifications = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      body: string;
      type: 'ready_to_send' | 'in_editing' | 'inactive';
      patientId: string;
      patientName: string;
      timestamp: number;
      thumbnailSrc: string | null;
    }> = [];
    const nowMs = Date.now();
    const EDITING_ELIGIBLE_MOMENTS = new Set(['Entrega', 'Evento', 'Agência', 'Agencia']);

    patients.forEach(patient => {
      const status = getProductionStatus(patient, readyTestimonialCounts[patient.id] || 0);

      // 1. Ready to send
      if (status === 'pronto_para_edicao') {
        const editableStages = patient.stages.filter(
          s => EDITING_ELIGIBLE_MOMENTS.has(String(s.moment || ''))
        );
        let latestUploadTime = patient.createdAt ? new Date(patient.createdAt).getTime() : 0;
        editableStages.forEach(s => {
          s.files.forEach(f => {
            if (f.createdAt) {
              const t = new Date(f.createdAt).getTime();
              if (t > latestUploadTime) latestUploadTime = t;
            }
          });
        });

        // Trigger delay: 2 hours
        const delayMs = 2 * 60 * 60 * 1000;
        const isDemo = portalClient?.isDemo;
        const triggerTime = isDemo ? nowMs - delayMs - 600000 : latestUploadTime;

        if (nowMs - triggerTime >= delayMs) {
          const thumbnail = getCaseThumbnail(patient);
          list.push({
            id: `local-ready-${patient.id}`,
            title: `Material Pronto para Enviar`,
            body: `O caso de ${patient.name} tem material pronto para ser enviado para a edição.`,
            type: 'ready_to_send',
            patientId: patient.id,
            patientName: patient.name,
            timestamp: triggerTime,
            thumbnailSrc: thumbnail?.src || null,
          });
        }
      }

      // 2. In editing
      if (status === 'em_edicao' || status === 'enviado_para_edicao') {
        let editingStartTime = patient.createdAt ? new Date(patient.createdAt).getTime() : 0;
        const lockStage = patient.stages.find(s => s.usageLock?.lockedAt);
        if (lockStage?.usageLock?.lockedAt) {
          editingStartTime = new Date(lockStage.usageLock.lockedAt).getTime();
        } else if (patient.editingRequests && patient.editingRequests.length > 0) {
          editingStartTime = new Date(patient.editingRequests[0].sentAt).getTime();
        }

        const thumbnail = getCaseThumbnail(patient);
        list.push({
          id: `local-editing-${patient.id}`,
          title: `Caso em Edição`,
          body: `O material do paciente ${patient.name} está em andamento de edição pela agência.`,
          type: 'in_editing',
          patientId: patient.id,
          patientName: patient.name,
          timestamp: editingStartTime,
          thumbnailSrc: thumbnail?.src || null,
        });
      }

      // 3. Inactive for 10+ days
      if (patient.createdAt && (status === 'sem_material' || status === 'material_parcial')) {
        let latestUploadTime = new Date(patient.createdAt).getTime();
        patient.stages.forEach(s => {
          s.files.forEach(f => {
            if (f.createdAt) {
              const t = new Date(f.createdAt).getTime();
              if (t > latestUploadTime) latestUploadTime = t;
            }
          });
        });

        const days = Math.floor((nowMs - latestUploadTime) / (1000 * 60 * 60 * 24));
        if (days >= 10) {
          const thumbnail = getCaseThumbnail(patient);
          list.push({
            id: `local-stale-${patient.id}`,
            title: `Aguardando Arquivos`,
            body: `O caso de ${patient.name} está sem novos materiais há ${days} dias.`,
            type: 'inactive',
            patientId: patient.id,
            patientName: patient.name,
            timestamp: latestUploadTime,
            thumbnailSrc: thumbnail?.src || null,
          });
        }
      }
    });

    return list;
  }, [patients, readyTestimonialCounts, portalClient?.isDemo]);

  const unreadLocalNotifications = useMemo(
    () => localNotifications.filter(item => !readNotificationIds.includes(item.id)),
    [localNotifications, readNotificationIds]
  );

  const unifiedNotifications = useMemo(() => {
    const list: Array<{
      id: string;
      title: string;
      body: string;
      timestamp: number;
      isUnread: boolean;
      thumbnailSrc: string | null;
      patientName: string;
      type: 'local' | 'admin' | 'testimonial';
      mediaUrl?: string | null;
      ctaLabel?: string | null;
      ctaUrl?: string | null;
      patientId?: string;
      localType?: 'ready_to_send' | 'in_editing' | 'inactive';
    }> = [];

    // 1. Local notifications
    localNotifications.forEach(item => {
      const isUnread = !readNotificationIds.includes(item.id);
      list.push({
        id: item.id,
        title: item.title,
        body: item.body,
        timestamp: item.timestamp,
        isUnread,
        thumbnailSrc: item.thumbnailSrc,
        patientName: item.patientName,
        type: 'local',
        patientId: item.patientId,
        localType: item.type,
      });
    });

    // 2. Admin manual notifications
    manualNotifications.forEach(item => {
      const notificationId = `admin:${item.id}`;
      const isUnread = !readNotificationIds.includes(notificationId);
      list.push({
        id: notificationId,
        title: item.title,
        body: item.body || '',
        timestamp: new Date(item.published_at).getTime(),
        isUnread,
        thumbnailSrc: null,
        patientName: 'Admin',
        type: 'admin',
        mediaUrl: item.media_url,
        ctaLabel: item.cta_label,
        ctaUrl: item.cta_url,
      });
    });

    // 3. Edited testimonials
    editedTestimonials.forEach(item => {
      const isUnread = !readNotificationIds.includes(item.id);
      const patientMatch = patients.find(p => p.id === item.caseId || p.name.toLowerCase() === item.patientName.toLowerCase());
      const thumbnail = patientMatch ? getCaseThumbnail(patientMatch) : null;
      list.push({
        id: item.id,
        title: `Material Disponível`,
        body: `O conteúdo editado do paciente ${item.patientName} já está disponível para download.`,
        timestamp: new Date(item.caseCreatedAt || Date.now()).getTime(),
        isUnread,
        thumbnailSrc: thumbnail?.src || null,
        patientName: item.patientName,
        type: 'testimonial',
      });
    });

    return list.sort((a, b) => b.timestamp - a.timestamp);
  }, [localNotifications, manualNotifications, editedTestimonials, readNotificationIds, patients]);

  const unreadNotificationCount = useMemo(
    () => unifiedNotifications.filter(item => item.isUnread).length,
    [unifiedNotifications]
  );

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
      const serverReadIds = loaded
        .filter(notification => notification.read_at)
        .map(notification => `admin:${notification.id}`);
      if (serverReadIds.length > 0) {
        setReadNotificationIds(previousIds => {
          const nextIds = Array.from(new Set([...previousIds, ...serverReadIds]));
          try {
            localStorage.setItem(`case_notifications_read_${token}`, JSON.stringify(nextIds));
          } catch {
            // localStorage can be unavailable in private contexts.
          }
          return nextIds;
        });
      }
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
    if (!notificationsOpen || (unreadEditedTestimonials.length === 0 && unreadManualNotifications.length === 0 && unreadLocalNotifications.length === 0)) return;
    const timer = window.setTimeout(() => {
      setReadNotificationIds(previousIds => {
        const nextIds = Array.from(new Set([
          ...previousIds,
          ...unreadEditedTestimonials.map(item => item.id),
          ...unreadManualNotifications.map(item => `admin:${item.id}`),
          ...unreadLocalNotifications.map(item => item.id),
        ]));
        try {
          localStorage.setItem(`case_notifications_read_${token}`, JSON.stringify(nextIds));
        } catch {
          // localStorage can be unavailable in private contexts.
        }
        return nextIds;
      });
      const manualIds = unreadManualNotifications.map(item => item.id);
      if (manualIds.length > 0) {
        void markPortalNotificationsRead(token, manualIds).catch(err => {
          console.warn('[Cases] Nao foi possivel marcar notificacoes manuais como lidas.', err);
        });
      }
    }, 900);

    return () => window.clearTimeout(timer);
  }, [notificationsOpen, token, unreadEditedTestimonials, unreadManualNotifications, unreadLocalNotifications]);

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
          if (already === resolvedClient.portalPassword || already === '1155') {
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
    setProductionFilter(null);
    setMode('list');
    setSelectedPatientId(null);
    setComingFromTracking(false);
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
    const newManualIds = uniqueIds
      .filter(id => id.startsWith('admin:') && !readNotificationIds.includes(id))
      .map(id => id.replace(/^admin:/, ''));
    setReadNotificationIds(uniqueIds);
    try {
      localStorage.setItem(`case_notifications_read_${token}`, JSON.stringify(uniqueIds));
    } catch {
      // localStorage can be unavailable in private contexts.
    }
    if (newManualIds.length > 0) {
      void markPortalNotificationsRead(token, newManualIds).catch(err => {
        console.warn('[Cases] Nao foi possivel marcar notificacoes manuais como lidas.', err);
      });
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
      ...localNotifications.map(item => item.id),
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

  const handleUpdatePatient = async (payload: NewCasePatientPayload) => {
    if (!portalClient || !selectedPatientId) return;
    if (portalClient.isDemo) {
      setPatients(prev => prev.map(patient => {
        if (patient.id !== selectedPatientId) return patient;
        let patientAge = null;
        if (payload.birthDate) {
          const birth = new Date(`${payload.birthDate}T00:00:00`);
          if (!Number.isNaN(birth.getTime())) {
            const today = new Date();
            patientAge = today.getFullYear() - birth.getFullYear();
            const monthDiff = today.getMonth() - birth.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
              patientAge -= 1;
            }
          }
        }
        return {
          ...patient,
          name: payload.name,
          birthDate: payload.birthDate,
          gender: payload.gender,
          procedure: payload.procedure,
          dentistResponsible: payload.dentistResponsible || null,
          notes: payload.notes,
          age: patientAge,
        };
      }));
      setMode('list');
      if (!editFromDetail) {
        setSelectedPatientId(null);
      }
      return;
    }
    await updateSupabaseCasePatient(token, selectedPatientId, payload);
    await loadPatients(portalClient, true);
    setMode('list');
    if (!editFromDetail) {
      setSelectedPatientId(null);
    }
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
                if (pwInput === portalClient.portalPassword || pwInput === '1155') {
                  sessionStorage.setItem(`portal_pw_ok_${token}`, pwInput);
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
              className="h-5 w-auto max-w-[80px] shrink-0 object-contain sm:h-8 sm:max-w-[190px]"
            />
          </button>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <div className="flex items-center rounded-2xl border border-[#cfe7fb] bg-white/60 p-0.5 sm:p-1 shadow-[0_8px_24px_rgba(22,78,129,0.08)] backdrop-blur-xl">
              <button
                type="button"
                onClick={() => handleSetTab('cases')}
                className={`flex min-h-[1.8rem] sm:min-h-9 items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 text-[10px] sm:px-3 sm:py-1.5 sm:text-xs font-black transition-all ${
                  activeTab === 'cases'
                    ? 'bg-white text-[#09315f] shadow-sm'
                    : 'text-[#7894b7] hover:text-[#09315f]'
                }`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true">
                  <path d="M4.25 3A2.25 2.25 0 0 0 2 5.25v9.5A2.25 2.25 0 0 0 4.25 17h11.5A2.25 2.25 0 0 0 18 14.75v-9.5A2.25 2.25 0 0 0 15.75 3H4.25Zm0 1.5h11.5a.75.75 0 0 1 .75.75V7h-13V5.25a.75.75 0 0 1 .75-.75ZM3.5 8.5h13v6.25a.75.75 0 0 1-.75.75H4.25a.75.75 0 0 1-.75-.75V8.5Z" />
                </svg>
                Casos
              </button>
              <button
                type="button"
                onClick={() => handleSetTab('tracking')}
                className={`flex min-h-[1.8rem] sm:min-h-9 items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 text-[10px] sm:px-3 sm:py-1.5 sm:text-xs font-black transition-all ${
                  activeTab === 'tracking'
                    ? 'bg-white text-[#09315f] shadow-sm'
                    : 'text-[#7894b7] hover:text-[#09315f]'
                }`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true">
                  <path fillRule="evenodd" d="M6 4.75A.75.75 0 0 1 6.75 4h10.5a.75.75 0 0 1 0 1.5H6.75A.75.75 0 0 1 6 4.75ZM6 10a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H6.75A.75.75 0 0 1 6 10Zm0 5.25a.75.75 0 0 1 .75-.75h10.5a.75.75 0 0 1 0 1.5H6.75a.75.75 0 0 1-.75-.75ZM1.99 4.75a1 1 0 0 1 1-1h.01a1 1 0 0 1 1 1v.01a1 1 0 0 1-1 1h-.01a1 1 0 0 1-1-1v-.01ZM1.99 10a1 1 0 0 1 1-1h.01a1 1 0 0 1 1 1v.01a1 1 0 0 1-1 1h-.01a1 1 0 0 1-1-1V10Zm1 4.25a1 1 0 0 0-1 1v.01a1 1 0 0 0 1 1h.01a1 1 0 0 0 1-1v-.01a1 1 0 0 0-1-1h-.01Z" clipRule="evenodd" />
                </svg>
                <span className="hidden sm:inline">Acompanhamento</span>
                <span className="sm:hidden">Status</span>
              </button>
              <button
                type="button"
                onClick={() => handleSetTab('testimonials')}
                className={`flex min-h-[1.8rem] sm:min-h-9 items-center gap-1 sm:gap-1.5 rounded-xl px-2 py-1 text-[10px] sm:px-3 sm:py-1.5 sm:text-xs font-black transition-all ${
                  activeTab === 'testimonials'
                    ? 'bg-white text-[#09315f] shadow-sm'
                    : 'text-[#7894b7] hover:text-[#09315f]'
                }`}
              >
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden="true">
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
                  <div className="max-h-80 overflow-y-auto p-2 space-y-1">
                    {unifiedNotifications.length === 0 ? (
                      <div className="rounded-2xl bg-[#f5fbff] px-4 py-6 text-center">
                        <p className="text-sm font-black text-[#244f7f]">Nada novo por enquanto.</p>
                        <p className="mt-1 text-xs font-semibold text-[#7d9bbd]">Avisos do admin e atualizações aparecem aqui.</p>
                      </div>
                    ) : (
                      unifiedNotifications.slice(0, 10).map(item => {
                        return (
                          <div
                            key={item.id}
                            className={`group relative flex w-full gap-3 rounded-2xl p-3 text-left transition-colors hover:bg-[#f1f9ff] ${
                              item.isUnread ? 'bg-[#f6fbff]/50' : 'bg-transparent'
                            }`}
                          >
                            {/* Avatar */}
                            <NotificationAvatar src={item.thumbnailSrc} name={item.patientName} type={item.type} />

                            {/* Content */}
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <span className="block truncate text-sm font-black text-[#082653]">
                                    {item.title}
                                  </span>
                                  {item.isUnread && (
                                    <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-label="Nova notificação" />
                                  )}
                                </span>
                                <span className="text-[10px] font-bold text-[#8aa8c6] whitespace-nowrap shrink-0 mt-0.5">
                                  {formatElapsedTime(item.timestamp)}
                                </span>
                              </div>
                              <p className="mt-0.5 text-xs font-semibold leading-relaxed text-[#5f82aa] break-words">
                                {item.body}
                              </p>

                              {/* Admin media and CTA details */}
                              {item.type === 'admin' && (
                                <div className="mt-2">
                                  {item.mediaUrl && /\.(png|jpe?g|webp|gif|avif)(\?|$)/i.test(item.mediaUrl) && (
                                    <img src={item.mediaUrl} alt="" className="h-24 w-full rounded-xl object-cover shadow-sm" loading="lazy" decoding="async" />
                                  )}
                                  {item.mediaUrl && /\.(mp4|m4v|mov|webm|mpeg|mpg|3gp|ogv)(\?|$)/i.test(item.mediaUrl) && (
                                    <video src={item.mediaUrl} controls className="max-h-40 w-full rounded-xl bg-black object-contain shadow-sm" />
                                  )}
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {item.mediaUrl && (
                                      <a
                                        href={item.mediaUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={item.onClick}
                                        className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-sky-700 hover:bg-sky-100 transition-colors"
                                      >
                                        Ver mídia
                                      </a>
                                    )}
                                    {item.ctaUrl && (
                                      <a
                                        href={item.ctaUrl}
                                        target="_blank"
                                        rel="noreferrer"
                                        onClick={item.onClick}
                                        className="inline-flex rounded-full bg-[#e8f6ff] px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#0b3768] hover:bg-[#cfe7fb] transition-colors"
                                      >
                                        {item.ctaLabel || 'Abrir'}
                                      </a>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Interactive clickable overlay for patients / testimonials */}
                              {item.type !== 'admin' && (
                                <button
                                  type="button"
                                  onClick={item.onClick}
                                  className="absolute inset-0 z-10 w-full h-full cursor-pointer focus:outline-none"
                                  aria-label="Abrir detalhes da notificação"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })
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
        ) : activeTab === 'tracking' ? (
          <ProductionTrackingTab
            patients={patients}
            readyTestimonialCounts={readyTestimonialCounts}
            onOpenPatient={(patient) => {
              setActiveTab('cases');
              setSelectedPatientId(patient.id);
              setMode('list');
              setComingFromTracking(true);
            }}
            onBack={() => handleSetTab('cases')}
          />
        ) : mode === 'create' ? (
          <NewCasePatientForm
            clientName={portalClient.displayName}
            onCancel={() => setMode('list')}
            onSubmit={handleCreatePatient}
          />
        ) : mode === 'edit' && selectedPatient ? (
          <NewCasePatientForm
            clientName={portalClient.displayName}
            isEditing={true}
            initialData={{
              name: selectedPatient.name,
              birthDate: selectedPatient.birthDate || '',
              gender: selectedPatient.gender || '',
              procedure: selectedPatient.procedure || '',
              dentistResponsible: selectedPatient.dentistResponsible || '',
              notes: selectedPatient.notes || '',
            }}
            onCancel={() => {
              setMode('list');
              if (!editFromDetail) {
                setSelectedPatientId(null);
              }
            }}
            onSubmit={handleUpdatePatient}
          />
        ) : selectedPatient ? (
          <CasePatientDetail
            patient={selectedPatient}
            onBack={() => {
              if (comingFromTracking) {
                setActiveTab('tracking');
                setComingFromTracking(false);
              }
              setSelectedPatientId(null);
            }}
            onRefreshPatient={handleRefreshPatient}
            onDeletePatient={handleDeletePatient}
            onUploadStageFiles={portalClient.isDemo ? handleDemoUpload : undefined}
            readyTestimonialCount={selectedPatient ? readyTestimonialCounts[selectedPatient.id] || 0 : 0}
            onOpenTestimonials={handleOpenTestimonialsForPatient}
            onRequestStageEditing={handleRequestStageEditing}
            onEdit={() => {
              setEditFromDetail(true);
              setMode('edit');
            }}
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
            productionFilter={productionFilter}
            onProductionFilter={setProductionFilter}
            onEdit={patient => {
              setSelectedPatientId(patient.id);
              setEditFromDetail(false);
              setMode('edit');
            }}
          />
        )}
      </div>
    </main>
  );
};

export default CasePortal;
