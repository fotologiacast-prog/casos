import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { CasePatient, Client } from '../../types';
import { getDriveSetupWarning } from '../../services/driveService';
import { createSupabaseCasePatient, fetchSupabaseCasePatients } from '../../services/caseSupabaseService';
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
          throw new Error('Link de casos nao encontrado. Verifique se o link esta correto.');
        }
        if (cancelled) return;
        setPortalClient(resolvedClient);
        await loadPatients(resolvedClient);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Nao foi possivel abrir o portal.');
        }
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    initialize();
    return () => {
      cancelled = true;
    };
  }, [loadPatients, token]);

  const handleRefresh = async () => {
    if (!portalClient) return;
    await loadPatients(portalClient, true);
  };

  const handleRefreshPatient = async (patientId: string) => {
    if (!portalClient) return;
    if (portalClient.isDemo) return;
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
          age: payload.age,
          gender: payload.gender,
          procedure: payload.procedure,
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

  if (isLoading) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 rounded-full border-4 border-slate-200 border-t-sky-500 animate-spin" />
          <p className="mt-4 text-sm font-semibold text-slate-500">Carregando portal...</p>
        </div>
      </main>
    );
  }

  if (error || !portalClient) {
    return (
      <main className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-lg rounded-lg border border-red-100 bg-white p-8 text-center shadow-sm">
          <h1 className="text-xl font-semibold text-slate-950">Nao foi possivel abrir o portal</h1>
          <p className="mt-3 text-sm text-slate-600">{error}</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            {portalClient.avatarUrl ? (
              <img src={portalClient.avatarUrl} alt="" className="h-10 w-10 rounded-full object-cover" />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-sky-100 text-sm font-bold text-sky-700">
                {portalClient.displayName.slice(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <p className="text-sm font-semibold text-slate-950">{portalClient.displayName}</p>
              <p className="text-xs text-slate-500">Portal de casos</p>
            </div>
          </div>
          <div className="hidden text-right sm:block">
            {driveWarning ? (
              <p className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-200">
                Drive pendente
              </p>
            ) : (
              <p className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                Drive conectado
              </p>
            )}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        {driveWarning && !portalClient.isDemo && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {driveWarning}
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
