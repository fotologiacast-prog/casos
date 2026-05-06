import { createClient } from '@supabase/supabase-js';
import { SUPABASE_ANON_KEY, SUPABASE_URL } from '../config';
import { Client } from '../types';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn('[Supabase] Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY para conectar o portal.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const getErrorMessage = (error: any) => error.message || 'Erro desconhecido';

export async function getClientByBoardId(boardId: string): Promise<Client | null> {
  const { data, error } = await supabase.from('clients').select('*').eq('boardId', String(boardId)).maybeSingle();
  if (error) throw new Error(`Erro ao buscar cliente: ${getErrorMessage(error)}`);
  return data as Client | null;
}

export async function getClientByCaseToken(token: string): Promise<Client | null> {
  const { data, error } = await supabase.rpc('get_client_by_case_token', { p_token: token }).maybeSingle();
  if (error) throw new Error(`Erro ao buscar cliente pelo link de casos: ${getErrorMessage(error)}`);
  return data as Client | null;
}
