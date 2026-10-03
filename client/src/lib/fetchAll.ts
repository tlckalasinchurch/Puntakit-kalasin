import { api } from "./api";

/**
 * Reads every page of a list endpoint.
 *
 * The API caps `limit` per request (100 for members, 200 for attendance), so a
 * page that asks for `limit=300` in one go gets a 400 and shows nothing. With a
 * few hundred members that is the normal case, not an edge case. This walks
 * `page=1..meta.totalPages` at a limit every list endpoint accepts.
 *
 * `MAX_PAGES` stops a bad `totalPages` from looping; hitting it throws rather
 * than silently returning a partial list.
 */
export const PAGE_LIMIT = 100;
const MAX_PAGES = 50;

type PageResult<T> = { data?: T[]; meta?: { totalPages?: number } };

export async function fetchAllPages<T>(
  path: string,
  fetchPage: (url: string) => Promise<PageResult<T>> = (url) => api.getWithMeta<T[]>(url) as Promise<PageResult<T>>
): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  const rows: T[] = [];
  let totalPages = 1;
  for (let page = 1; page <= totalPages; page += 1) {
    if (page > MAX_PAGES) throw new Error(`รายการยาวเกิน ${MAX_PAGES * PAGE_LIMIT} แถว`);
    const result = await fetchPage(`${path}${sep}limit=${PAGE_LIMIT}&page=${page}`);
    rows.push(...(result.data ?? []));
    totalPages = Math.max(1, result.meta?.totalPages ?? 1);
  }
  return rows;
}

/** All members, name order, for pickers and rosters. */
export const fetchAllMembers = <T>() => fetchAllPages<T>("/api/members?sortBy=name&sortOrder=asc");
