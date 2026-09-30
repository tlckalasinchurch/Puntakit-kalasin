import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface WithId {
  id: string;
}

export function useResource<T extends WithId>(basePath: string) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await api.get<T[]>(basePath);
      setItems(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "โหลดข้อมูลไม่สำเร็จ");
    } finally {
      setIsLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (input: unknown) => {
      const created = await api.post<T>(basePath, input);
      setItems((prev) => [created, ...prev]);
      return created;
    },
    [basePath]
  );

  const update = useCallback(
    async (id: string, input: unknown) => {
      const updated = await api.put<T>(`${basePath}/${id}`, input);
      setItems((prev) => prev.map((item) => (item.id === id ? updated : item)));
      return updated;
    },
    [basePath]
  );

  const remove = useCallback(
    async (id: string) => {
      await api.delete(`${basePath}/${id}`);
      setItems((prev) => prev.filter((item) => item.id !== id));
    },
    [basePath]
  );

  return { items, isLoading, error, reload: load, create, update, remove };
}
