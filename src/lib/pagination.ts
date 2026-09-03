export const DEFAULT_PAGE_SIZE = 25;

export function parsePageParam(value: string | string[] | undefined): number {
  const raw = Array.isArray(value) ? value[0] : value;
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : 1;
}

/** Inclusive [from, to] row range for supabase-js's `.range()`. */
export function pageRange(page: number, pageSize: number = DEFAULT_PAGE_SIZE): [number, number] {
  const from = (page - 1) * pageSize;
  return [from, from + pageSize - 1];
}
