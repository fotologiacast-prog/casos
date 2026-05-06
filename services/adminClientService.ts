import { Client } from '../types';

export type ClientPayload = {
  name: string;
  boardId: string;
  avatar_url?: string;
  case_public_token: string;
  case_board_id?: string;
  case_client_label?: string;
  drive_folder_id?: string;
  active?: boolean;
};

const requestAdminClients = async (
  password: string,
  options: RequestInit & { query?: string } = {}
) => {
  const response = await fetch(`/api/admin-clients${options.query || ''}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': password,
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.details || 'Falha ao comunicar com admin.');
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
