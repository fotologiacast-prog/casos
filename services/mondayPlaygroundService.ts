type MondayPlaygroundResponse<T = any> = {
  data?: T;
  errors?: { message: string }[];
  error?: string;
  details?: string;
};

export type MondayUser = {
  id: string;
  name: string;
  email?: string | null;
  title?: string | null;
  enabled?: boolean | null;
  is_guest?: boolean | null;
  is_pending?: boolean | null;
  is_view_only?: boolean | null;
};

const readPlaygroundResponse = async <T>(response: Response): Promise<MondayPlaygroundResponse<T>> => {
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.errors || data.error) {
    const graphQlMessage = data.errors?.map((error: any) => error.message).join(', ');
    throw new Error(graphQlMessage || data.details || data.error || `Falha no Monday. HTTP ${response.status}`);
  }
  return data;
};

export const runMondayPlaygroundQuery = async <T = any>(
  adminPassword: string,
  query: string,
  variables: Record<string, unknown> = {}
): Promise<MondayPlaygroundResponse<T>> => {
  const response = await fetch('/api/monday', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Admin-Password': adminPassword,
    },
    body: JSON.stringify({ query, variables }),
  });
  return readPlaygroundResponse<T>(response);
};

export const searchMondayUsers = async (adminPassword: string, search = ''): Promise<MondayUser[]> => {
  const userFields = 'id name email title enabled is_guest is_pending is_view_only';
  const query = `query { users(limit: 100) { ${userFields} } }`;
  const result = await runMondayPlaygroundQuery<{ users: MondayUser[] }>(
    adminPassword,
    query,
    {}
  );
  const users = result.data?.users || [];
  const normalizedSearch = search.trim().toLowerCase();
  if (!normalizedSearch) return users;
  return users.filter(user =>
    user.name?.toLowerCase().includes(normalizedSearch) ||
    user.email?.toLowerCase().includes(normalizedSearch) ||
    user.title?.toLowerCase().includes(normalizedSearch) ||
    String(user.id).includes(normalizedSearch)
  );
};
