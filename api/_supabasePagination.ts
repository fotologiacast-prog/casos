export const SUPABASE_PAGE_SIZE = 1000;

const serializeSupabaseError = (error: unknown) => {
  if (error instanceof Error) return error.message;
  if (error && typeof error === "object") {
    const record = error as Record<string, unknown>;
    const parts = [record.code, record.message, record.details, record.hint]
      .filter(Boolean)
      .map(String);
    if (parts.length > 0) return parts.join(" ");
  }
  return String(error);
};

export const fetchAllSupabaseRows = async <T>(
  createQuery: () => { range: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }> },
  pageSize = SUPABASE_PAGE_SIZE
): Promise<T[]> => {
  const rows: T[] = [];
  let from = 0;

  while (true) {
    const to = from + pageSize - 1;
    const { data, error } = await createQuery().range(from, to);
    if (error) throw new Error(serializeSupabaseError(error));

    const pageRows = data || [];
    rows.push(...pageRows);
    if (pageRows.length < pageSize) return rows;

    from += pageSize;
  }
};
