import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchBases, fetchTables, fetchTableMeta, fetchRecords, fetchAllRecords, fetchCount, getStatusOptions,
} from '../services/nocodbApi';
import { useSettings } from '../context/SettingsContext';

export function useBases() {
  const { settings, loaded } = useSettings();
  const [bases, setBases] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try { setBases(await fetchBases(settings)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [settings]);

  // Czekaj aż ustawienia zostaną wczytane z AsyncStorage
  useEffect(() => {
    if (loaded) load();
  }, [loaded, load]);

  return { bases, loading, error, reload: load };
}

export function useTables(baseId) {
  const { settings, loaded } = useSettings();
  const [tables, setTables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!baseId) return;
    setLoading(true); setError(null);
    try { setTables(await fetchTables(settings, baseId)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [baseId, settings]);

  useEffect(() => {
    if (loaded) load();
  }, [loaded, load]);

  return { tables, loading, error, reload: load };
}

/** Schemat tabeli: { id, title, display_field_id, fields: [...] } */
export function useTableMeta(baseId, tableId) {
  const { settings, loaded } = useSettings();
  const [table, setTable] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!baseId || !tableId) return;
    setLoading(true); setError(null);
    try { setTable(await fetchTableMeta(settings, baseId, tableId)); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, [baseId, tableId, settings]);

  useEffect(() => {
    if (loaded) load();
  }, [loaded, load]);

  const statusOptions = getStatusOptions(table?.fields, settings.statusField);

  return { table, statusOptions, loading, error, reload: load };
}

/**
 * Rekordy tabeli.
 *  • all = false → stronicowanie (loadMore doczytuje kolejne strony)
 *  • all = true  → wszystkie rekordy naraz (dla kanbana)
 *  • sort = { field, direction } | null
 *  • where = filtr v3 (np. wyszukiwanie) | undefined
 */
export function useRecords(baseId, tableId, { sort = null, where, all = false, enabled = true } = {}) {
  const { settings, loaded } = useSettings();
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const requestId = useRef(0);
  const loadingMoreRef = useRef(false);

  const load = useCallback(async () => {
    if (!baseId || !tableId) return;
    const req = ++requestId.current;
    setLoading(true); setError(null);
    try {
      if (all) {
        const list = await fetchAllRecords(settings, baseId, tableId, { sort, where });
        if (req !== requestId.current) return;
        setRecords(list); setHasMore(false); setPage(1);
      } else {
        const res = await fetchRecords(settings, baseId, tableId, { page: 1, sort, where });
        if (req !== requestId.current) return;
        setRecords(res.records); setHasMore(res.hasMore); setPage(1);
      }
    } catch (e) {
      if (req === requestId.current) setError(e.message);
    } finally {
      if (req === requestId.current) setLoading(false);
    }
  }, [baseId, tableId, settings, all, sort?.field, sort?.direction, where]);

  const loadMore = useCallback(async () => {
    if (all || !hasMore || loading || loadingMoreRef.current) return;
    const req = requestId.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const res = await fetchRecords(settings, baseId, tableId, { page: page + 1, sort, where });
      if (req !== requestId.current) return;
      setRecords((prev) => prev.concat(res.records));
      setHasMore(res.hasMore);
      setPage(page + 1);
    } catch (e) {
      if (req === requestId.current) setError(e.message);
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [all, hasMore, loading, settings, baseId, tableId, page, sort?.field, sort?.direction, where]);

  useEffect(() => {
    if (loaded && enabled) load();
  }, [loaded, enabled, load]);

  /** Podmienia rekord lokalnie (po edycji) bez przeładowania całej listy */
  const replaceLocal = useCallback((record) => {
    setRecords((prev) => prev.map((r) => (String(r.id) === String(record.id) ? record : r)));
  }, []);

  /** Usuwa rekord z listy lokalnie (po usunięciu na serwerze) */
  const removeLocal = useCallback((id) => {
    setRecords((prev) => prev.filter((r) => String(r.id) !== String(id)));
  }, []);

  return { records, hasMore, loading, loadingMore, error, reload: load, loadMore, replaceLocal, removeLocal };
}

/** Liczba rekordów tabeli (null, dopóki nie wiadomo); refreshKey wymusza ponowne pobranie */
export function useCount(baseId, tableId, { where, refreshKey = 0, enabled = true } = {}) {
  const { settings, loaded } = useSettings();
  const [count, setCount] = useState(null);

  useEffect(() => {
    if (!loaded || !enabled || !baseId || !tableId) return undefined;
    let cancelled = false;
    fetchCount(settings, baseId, tableId, where)
      .then((n) => { if (!cancelled) setCount(n); })
      .catch(() => { if (!cancelled) setCount(null); });
    return () => { cancelled = true; };
  }, [loaded, enabled, settings, baseId, tableId, where, refreshKey]);

  return count;
}
