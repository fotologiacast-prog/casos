import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CasePatient, Client } from '../../types';
import { getDriveSetupWarning } from '../../services/driveService';
import { createSupabaseCasePatient, deleteSupabaseCasePatient, fetchSupabaseCasePatients } from '../../services/caseSupabaseService';
import { getClientByBoardId, getClientByCaseToken } from '../../services/supabaseService';
import { CASE_STAGE_DEFINITIONS } from '../../utils/caseConstants';
import { MOCK_CASE_PATIENTS } from '../../utils/mockCaseData';
import CasePatientDetail from './CasePatientDetail';
import CasePatientList from './CasePatientList';
import NewCasePatientForm, { NewCasePatientPayload } from './NewCasePatientForm';

interface CasePortalProps {
  token: string;
}

type PortalClient = {
  boardId: string;
  clientName: string;
  displayName: string;
  avatarUrl?: string;
  driveFolderId?: string;
  isDemo?: boolean;
};

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
      avatarUrl: client.avatar_url,
      driveFolderId: client.drive_folder_id,
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
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedPatient = useMemo(
    () => patients.find(patient => patient.id === selectedPatientId) || null,
    [patients, selectedPatientId]
  );
  const driveWarning = portalClient ? getDriveSetupWarning(portalClient.driveFolderId) : null;

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
        await loadPatients(resolvedClient);
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
          keywords: payload.keywords,
          procedureDescription: payload.procedureDescription,
          notes: payload.notes,
          createdAt: new Date(),
          stages: CASE_STAGE_DEFINITIONS.map((stage, index) => ({
            id: `${patientId}-stage-${index + 1}`,
            boardId: portalClient.boardId,
            parentItemId: patientId,
            title: stage.title,
            moment: stage.moment,
            expectedItems: [...stage.expectedItems],
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

  const avatarInitials = portalClient.displayName.slice(0, 2).toUpperCase();

  return (
    <main className="min-h-screen bg-zinc-50">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            {portalClient.avatarUrl ? (
              <img src={portalClient.avatarUrl} alt="" className="h-9 w-9 rounded-xl object-cover" />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 text-xs font-bold text-white">
                {avatarInitials}
              </div>
            )}
            <div>
              <p className="text-sm font-bold text-zinc-900 leading-tight">{portalClient.displayName}</p>
              <p className="text-xs text-zinc-500 leading-tight">Portal de casos</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2">
            {driveWarning ? (
              <div className="flex items-center gap-1.5 rounded-full bg-zinc-100 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-zinc-400" />
                <span className="text-xs font-semibold text-zinc-600">Drive pendente</span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 rounded-full bg-zinc-900 px-3 py-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-white" />
                <span className="text-xs font-bold text-white">Drive conectado</span>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        {driveWarning && !portalClient.isDemo && (
          <div className="mb-5 flex items-center gap-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3.5 shadow-sm">
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-5 w-5 shrink-0 text-zinc-500">
              <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495ZM10 5a.75.75 0 0 1 .75.75v3.5a.75.75 0 0 1-1.5 0v-3.5A.75.75 0 0 1 10 5Zm0 9a1 1 0 1 0 0-2 1 1 0 0 0 0 2Z" clipRule="evenodd" />
            </svg>
            <p className="text-sm font-medium text-zinc-700">{driveWarning}</p>
          </div>
        )}

        {mode === 'create' ? (
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
          />
        ) : (
          <CasePatientList
            patients={patients}
            clientName={portalClient.displayName}
            onCreate={() => setMode('create')}
            onOpen={patient => setSelectedPatientId(patient.id)}
            onRefresh={handleRefresh}
            isRefreshing={isRefreshing}
          />
        )}
      </div>
    </main>
  );
};

export default CasePortal;
