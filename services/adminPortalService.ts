import { Client } from '../types';
import { AdminApiError } from './adminClientService';

export type AdminDashboardClient = {
  id: number;
  name: string;
  active: boolean;
  patientsCount: number;
  editingSentCount: number;
  editingPendingCount: number;
  editedReadyCount: number;
  stagesTotalCount?: number;
  stagesWithFilesCount?: number;
  lastCaseCreatedAt?: string | null;
  lastEditingSentAt?: string | null;
  daysSinceLastUpdate?: number;
  healthStatus?: 'healthy' | 'attention' | 'critical';
};

export type AdminDashboardSummary = {
  totals: {
    clients: number;
    activeClients: number;
    patients: number;
    editingSent: number;
    editingPending: number;
    editedReady: number;
  };
  clients: AdminDashboardClient[];
};

export type AdminNotification = {
  id: string;
  title: string;
  body: string | null;
  media_url: string | null;
  cta_label: string | null;
  cta_url: string | null;
  audience: 'all' | 'client' | string;
  client_id: number | null;
  active: boolean;
  published_at: string;
  created_at: string;
  updated_at?: string;
  read_count?: number;
  recipient_count?: number;
  last_read_at?: string | null;
};

export type AdminNotificationPayload = {
  title: string;
  body?: string | null;
  media_url?: string | null;
  cta_label?: string | null;
  cta_url?: string | null;
  client_id?: number | null;
  active?: boolean;
};

export type AdminEditingRequestStageFile = {
  id: string;
  name: string;
  type?: string | null;
  sizeBytes?: number | null;
  publicUrl: string;
  previewUrl?: string | null;
  createdAt?: string | null;
};

export type AdminEditingRequestStage = {
  id: string;
  name: string;
  moment?: string | null;
  status?: string | null;
  sortOrder?: number | null;
  folderUrl?: string | null;
  isUsed: boolean;
  lockedByOtherRequest: boolean;
  lock?: {
    id: string;
    editingRequestId?: string | null;
    lockedAt?: string | null;
    lockedBy?: string | null;
  } | null;
  files: AdminEditingRequestStageFile[];
};

export type AdminEditingRequest = {
  id: string;
  clientId: number;
  clientName: string;
  caseId: string;
  patientName: string;
  patientAge?: number | null;
  patientBirthDate?: string | null;
  patientGender?: string | null;
  patientProcedure?: string | null;
  requestedStageId?: string | null;
  requestedStageName?: string | null;
  materialUrl?: string | null;
  status?: string | null;
  creativeType?: string | null;
  sentAt?: string | null;
  editedAt?: string | null;
  usedStageIds: string[];
  usedCount: number;
  coverUrl?: string | null;
  availableStages: AdminEditingRequestStage[];
};

const requestAdmin = async (
  path: string,
  password: string,
  options: RequestInit = {}
) => {
  let response: Response;
  try {
    response = await fetch(path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'X-Admin-Password': password,
        ...(options.headers || {}),
      },
    });
  } catch (error) {
    throw new AdminApiError(error instanceof Error ? error.message : 'Falha de rede ao chamar o admin.', 0);
  }

  const responseText = await response.text();
  let data: any = {};
  try {
    data = responseText ? JSON.parse(responseText) : {};
  } catch {
    data = {};
  }

  if (!response.ok) {
    const details = typeof data.details === 'string' ? data.details : '';
    const message = details && data.error ? `${data.error} ${details}` : details || data.error;
    throw new AdminApiError(message || `Falha ao comunicar com admin. HTTP ${response.status}`, response.status);
  }

  return data;
};

export const fetchAdminDashboard = async (password: string): Promise<AdminDashboardSummary> => {
  const data = await requestAdmin('/api/admin?module=dashboard', password, { method: 'GET' });
  return data.dashboard;
};

export const listAdminNotifications = async (password: string): Promise<AdminNotification[]> => {
  const data = await requestAdmin('/api/admin?module=notifications', password, { method: 'GET' });
  return data.notifications || [];
};

export const createAdminNotification = async (
  password: string,
  payload: AdminNotificationPayload
): Promise<AdminNotification> => {
  const data = await requestAdmin('/api/admin?module=notifications', password, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.notification;
};

export const updateAdminNotification = async (
  password: string,
  id: string,
  payload: AdminNotificationPayload
): Promise<AdminNotification> => {
  const data = await requestAdmin(`/api/admin?module=notifications&id=${encodeURIComponent(id)}`, password, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
  return data.notification;
};

export const deleteAdminNotification = async (password: string, id: string): Promise<void> => {
  await requestAdmin(`/api/admin?module=notifications&id=${encodeURIComponent(id)}`, password, { method: 'DELETE' });
};

export const listAdminEditingRequests = async (password: string): Promise<AdminEditingRequest[]> => {
  const data = await requestAdmin('/api/admin?module=editing-requests', password, { method: 'GET' });
  return data.requests || [];
};

export const updateAdminEditingRequestMaterials = async (
  password: string,
  id: string,
  usedStageIds: string[]
): Promise<string[]> => {
  const data = await requestAdmin(`/api/admin?module=editing-requests&id=${encodeURIComponent(id)}`, password, {
    method: 'PUT',
    body: JSON.stringify({ usedStageIds }),
  });
  return data.usedStageIds || usedStageIds;
};

export const resolveNotificationClientName = (notification: AdminNotification, clients: Client[]) => {
  if (notification.audience === 'all' || !notification.client_id) return 'Todos os clientes';
  return clients.find(client => client.id === notification.client_id)?.name || 'Cliente específico';
};
