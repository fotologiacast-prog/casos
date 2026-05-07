import { Client } from '../types';

export class AdminApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AdminApiError';
    this.status = status;
  }
}

export type ClientPayload = {
  name: string;
  boardId: string;
  avatar_url?: string;
  logo_url?: string;
  brand_primary_color?: string;
  brand_accent_color?: string;
  case_public_token: string;
  case_board_id?: string;
  case_client_label?: string;
  monday_board_id?: string;
  monday_client_label?: string;
  drive_folder_id?: string;
  active?: boolean;
};

const requestAdminClients = async (
  password: string,
  options: RequestInit & { query?: string } = {}
) => {
  let response: Response;
  try {
    response = await fetch(`/api/admin-clients${options.query || ''}`, {
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
    const message = details && data.error
      ? `${data.error} ${details}`
      : details || data.error;
    const fallback = responseText
      ? responseText.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 220)
      : '';
    throw new AdminApiError(
      message ||
        fallback ||
        `Falha ao comunicar com admin. HTTP ${response.status}`,
      response.status
    );
  }
  return data;
};

export const listAdminClients = async (password: string): Promise<Client[]> => {
  const data = await requestAdminClients(password, { method: 'GET' });
  return data.clients || [];
};

export const createAdminClient = async (password: string, payload: ClientPayload): Promise<Client> => {
  const data = await requestAdminClients(password, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.client;
};

export const updateAdminClient = async (password: string, id: number, payload: ClientPayload): Promise<Client> => {
  const data = await requestAdminClients(password, {
    method: 'PUT',
    query: `?id=${encodeURIComponent(String(id))}`,
    body: JSON.stringify(payload),
  });
  return data.client;
};

export const deleteAdminClient = async (password: string, id: number): Promise<void> => {
  await requestAdminClients(password, {
    method: 'DELETE',
    query: `?id=${encodeURIComponent(String(id))}`,
  });
};
