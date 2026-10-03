import { describe, expect, it } from "vitest";
import { PAGE_LIMIT, fetchAllPages } from "./fetchAll";

const pages = (total: number, size: number) => async (url: string) => {
  const page = Number(new URL(url, "http://x").searchParams.get("page"));
  const limit = Number(new URL(url, "http://x").searchParams.get("limit"));
  expect(limit).toBe(PAGE_LIMIT);
  const start = (page - 1) * limit;
  const data = Array.from({ length: Math.max(0, Math.min(limit, total - start)) }, (_, i) => start + i);
  return { data, meta: { totalPages: Math.ceil(total / size) } };
};

describe("fetchAllPages", () => {
  it("never asks for more than the API allows and joins every page", async () => {
    const all = await fetchAllPages<number>("/api/members?sortBy=name", pages(463, PAGE_LIMIT));
    expect(all).toHaveLength(463);
    expect(all[0]).toBe(0);
    expect(all[462]).toBe(462);
  });

  it("uses ? or & correctly and handles a single page and an empty list", async () => {
    const urls: string[] = [];
    const spy = async (u: string) => (urls.push(u), { data: [1, 2], meta: { totalPages: 1 } });
    await fetchAllPages<number>("/api/x", spy);
    await fetchAllPages<number>("/api/x?a=1", spy);
    expect(urls).toEqual(["/api/x?limit=100&page=1", "/api/x?a=1&limit=100&page=1"]);
    expect(await fetchAllPages<number>("/api/x", async () => ({ data: [], meta: { totalPages: 0 } }))).toEqual([]);
  });

  it("throws instead of returning a partial list when totalPages is absurd", async () => {
    await expect(fetchAllPages<number>("/api/x", async () => ({ data: [1], meta: { totalPages: 99999 } }))).rejects.toThrow();
  });

  it("propagates a failed page", async () => {
    await expect(fetchAllPages<number>("/api/x", async () => { throw new Error("400"); })).rejects.toThrow("400");
  });
});
