import { useCallback, useEffect, useRef, useState } from "react";
import { api, ApiError } from "@/lib/api";

interface WithId {
  id: string;
}

export function useResource<T extends WithId>(basePath: string) {
  const [items, setItems] = useState<T[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestSeq = useRef(0);
  const mounted = useRef(true);
  /**
   * The underlying server text, when there was one. `error` is the friendly
   * sentence a screen shows; this is what `ErrorState`'s "รายละเอียดทางเทคนิค"
   * disclosure reveals, so a support conversation can quote the real cause
   * without putting it in front of the user first.
   */
  const [errorTechnical, setErrorTechnical] = useState<string | null>(null);

  useEffect(
    () => () => {
      mounted.current = false;
    },
    []
  );

  const load = useCallback(async () => {
    const requestId = ++requestSeq.current;
    setIsLoading(true);
    setError(null);
    setErrorTechnical(null);
    try {
      const data = await api.get<T[]>(basePath);
      if (!mounted.current || requestId !== requestSeq.current) return;
      setItems(data);
    } catch (err) {
      if (!mounted.current || requestId !== requestSeq.current) return;
      setError(err instanceof ApiError ? err.message : "โหลดข้อมูลไม่สำเร็จ");
      setErrorTechnical(
        err instanceof ApiError
          ? (err.serverMessage ?? err.message)
          : String(err)
      );
    } finally {
      if (mounted.current && requestId === requestSeq.current)
      setIsLoading(false);
    }
  }, [basePath]);

  useEffect(() => {
    load();
  }, [load]);

  const create = useCallback(
    async (input: unknown) => {
      const created = await api.post<T>(basePath, input);
      if (mounted.current) setItems(prev => [created, ...prev]);
      return created;
    },
    [basePath]
  );

  const update = useCallback(
    async (id: string, input: unknown) => {
      const updated = await api.put<T>(`${basePath}/${id}`, input);
      if (mounted.current) {
        setItems(prev => prev.map(item => (item.id === id ? updated : item)));
      }
      return updated;
    },
    [basePath]
  );

  const remove = useCallback(
    async (id: string) => {
      await api.delete(`${basePath}/${id}`);
      if (mounted.current)
        setItems(prev => prev.filter(item => item.id !== id));
    },
    [basePath]
  );

  return {
    items,
    isLoading,
    error,
    errorTechnical,
    reload: load,
    create,
    update,
    remove,
  };
}
