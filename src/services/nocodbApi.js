/**
 * Klient NocoDB REST API v3 (zgodnie ze specyfikacją NocoDB 2026.09.1).
 *
 * Najważniejsze różnice względem v2:
 *  • meta:  /api/v3/meta/workspaces/{ws}/bases, /api/v3/meta/bases/{base}/tables[/{table}]
 *  • dane:  /api/v3/data/{base}/{table}/records – wymagane baseId
 *  • rekord ma postać { id, fields: { ... } } zamiast płaskiego obiektu
 *  • paginacja przez page/pageSize, koniec danych gdy `next` === null
 *  • opcje SingleSelect są w field.options.choices (zamiast colOptions.options)
 */

function getHeaders(cfg) {
  return {
    'xc-token': cfg.apiToken,
    'Content-Type': 'application/json',
  };
}

function buildQuery(params = {}) {
  const parts = Object.entries(params)
    .filter(([, v]) => v !== undefined && v !== null && v !== '')
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : v)}`);
  return parts.length ? `?${parts.join('&')}` : '';
}

function describeError(status, text) {
  try {
    const body = JSON.parse(text);
    const msg = body.message ?? body.msg ?? text;
    return body.error ? `${body.error}: ${msg}` : msg;
  } catch (_) {
    return text;
  }
}

async function apiFetch(cfg, endpoint, options = {}) {
  const baseUrl = (cfg.baseUrl ?? '').trim().replace(/\/+$/, '');
  const url = `${baseUrl}/api/v3${endpoint}`;

  // Debug – widoczny w logach Metro / adb logcat
  console.log('[NocoDB]', options.method ?? 'GET', url);

  let response;
  try {
    response = await fetch(url, {
      ...options,
      headers: { ...getHeaders(cfg), ...options.headers },
    });
  } catch (networkErr) {
    console.error('[NocoDB] Network error:', networkErr.message);
    throw new Error(`Błąd sieci: ${networkErr.message}\n\nSprawdź:\n• Czy URL jest poprawny (${baseUrl})\n• Czy serwer NocoDB działa\n• Czy telefon jest w tej samej sieci co serwer`);
  }

  console.log('[NocoDB] Response status:', response.status);

  if (!response.ok) {
    const text = await response.text();
    console.error('[NocoDB] API error:', response.status, text);
    throw new Error(`NocoDB ${response.status}: ${describeError(response.status, text)}`);
  }

  const text = await response.text();
  return text ? JSON.parse(text) : {};
}

// ───────────────────────── META ─────────────────────────

export async function fetchWorkspaces(cfg) {
  const data = await apiFetch(cfg, '/meta/workspaces');
  return data?.list ?? [];
}

export async function fetchBases(cfg) {
  // Konkretny workspace wpisany w ustawieniach – pytamy tylko o niego
  if (cfg.workspaceId && cfg.workspaceId !== 'default') {
    const data = await apiFetch(cfg, `/meta/workspaces/${cfg.workspaceId}/bases`);
    return data?.list ?? [];
  }
  // W self-hosted bez licencji jest jeden domyślny workspace – zbieramy bazy ze wszystkich dostępnych
  const workspaces = await fetchWorkspaces(cfg);
  const lists = await Promise.all(
    workspaces.map((ws) => apiFetch(cfg, `/meta/workspaces/${ws.id}/bases`).then((d) => d?.list ?? []))
  );
  return lists.flat();
}

export async function fetchTables(cfg, baseId) {
  const data = await apiFetch(cfg, `/meta/bases/${baseId}/tables`);
  return data?.list ?? [];
}

/** Zwraca { id, title, display_field_id, fields: [...], views: [...] } */
export async function fetchTableMeta(cfg, baseId, tableId) {
  return apiFetch(cfg, `/meta/bases/${baseId}/tables/${tableId}`);
}

// Schematy tabel powiązanych – pobierane raz na sesję (wybór rekordów, podgląd powiązań)
const metaCache = new Map();
export function fetchTableMetaCached(cfg, baseId, tableId) {
  const key = `${cfg.baseUrl}|${baseId}|${tableId}`;
  if (!metaCache.has(key)) {
    metaCache.set(key, fetchTableMeta(cfg, baseId, tableId).catch((e) => { metaCache.delete(key); throw e; }));
  }
  return metaCache.get(key);
}

export function getStatusOptions(fields, statusFieldName) {
  const statusCol = (fields ?? []).find(
    (f) => f.title === statusFieldName && f.type === 'SingleSelect'
  );
  if (!statusCol) return [];
  const choices = statusCol.options?.choices ?? [];
  return choices.map((c) => ({ id: c.id, title: c.title, color: c.color ?? '#e2e8f0' }));
}

// ───────────────────────── DANE ─────────────────────────

/** Filtr "zawiera" w składni v3 – cudzysłowy chronią przecinki i nawiasy */
export function containsWhere(fieldTitle, text) {
  const clean = (v) => String(v).replace(/"/g, '');
  return `("${clean(fieldTitle)}",like,"%${clean(text)}%")`;
}

/**
 * Jedna strona rekordów.
 * sort: { field: 'Tytuł', direction: 'asc' | 'desc' } (opcjonalnie)
 * where: filtr v3, np. containsWhere('Nazwa', 'abc') (opcjonalnie)
 * fields: lista nazw pól do zwrócenia (opcjonalnie, domyślnie wszystkie)
 * Pola Links zwracane są jako lista powiązanych rekordów (linksAsLtar), a nie liczba.
 * Zwraca { records: [{ id, fields }], hasMore }
 */
export async function fetchRecords(cfg, baseId, tableId, { page = 1, sort, where, fields } = {}) {
  const pageSize = Number(cfg.pageSize) || 50;
  const query = buildQuery({ page, pageSize, sort: sort ? [sort] : undefined, where, fields, linksAsLtar: 'true' });
  const data = await apiFetch(cfg, `/data/${baseId}/${tableId}/records${query}`);
  return { records: data?.records ?? [], hasMore: !!data?.next };
}

export async function fetchAllRecords(cfg, baseId, tableId, opts = {}) {
  let all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const res = await fetchRecords(cfg, baseId, tableId, { ...opts, page });
    all = all.concat(res.records);
    hasMore = res.hasMore && res.records.length > 0;
    page++;
  }
  return all;
}

/** Liczba rekordów tabeli (opcjonalnie z filtrem where) */
export async function fetchCount(cfg, baseId, tableId, where) {
  const data = await apiFetch(cfg, `/data/${baseId}/${tableId}/count${buildQuery({ where })}`);
  return typeof data?.count === 'number' ? data.count : null;
}

export async function fetchRecord(cfg, baseId, tableId, recordId) {
  return apiFetch(cfg, `/data/${baseId}/${tableId}/records/${encodeURIComponent(recordId)}?linksAsLtar=true`);
}

/** fields: { 'Nazwa pola': wartość, ... } → zwraca utworzony rekord { id, fields } */
export async function createRecord(cfg, baseId, tableId, fields) {
  const data = await apiFetch(cfg, `/data/${baseId}/${tableId}/records`, {
    method: 'POST',
    body: JSON.stringify([{ fields }]),
  });
  return data?.records?.[0] ?? null;
}

/** Aktualizuje tylko przekazane pola (PATCH = merge) */
export async function updateRecord(cfg, baseId, tableId, recordId, fields) {
  const data = await apiFetch(cfg, `/data/${baseId}/${tableId}/records`, {
    method: 'PATCH',
    body: JSON.stringify([{ id: recordId, fields }]),
  });
  return data?.records?.[0] ?? null;
}

/** Usuwa rekord – odpowiedź v3: { records: [{ id, deleted: true }] } */
export async function deleteRecord(cfg, baseId, tableId, recordId) {
  const data = await apiFetch(cfg, `/data/${baseId}/${tableId}/records`, {
    method: 'DELETE',
    body: JSON.stringify([{ id: recordId }]),
  });
  const result = data?.records?.[0];
  if (result && result.deleted === false) throw new Error('NocoDB nie usunął rekordu.');
  return result ?? null;
}

// ───────────────────────── POWIĄZANIA (Links / LinkToAnotherRecord) ─────────────────────────

const linksPath = (baseId, tableId, linkFieldId, recordId) =>
  `/data/${baseId}/${tableId}/links/${linkFieldId}/${encodeURIComponent(recordId)}`;

/** Wszystkie rekordy powiązane przez pole linkFieldId: [{ id, fields: { <pole wyświetlane>: wartość } }] */
export async function fetchLinkedRecords(cfg, baseId, tableId, linkFieldId, recordId) {
  let all = [];
  let page = 1;
  let hasMore = true;
  while (hasMore) {
    const data = await apiFetch(cfg, `${linksPath(baseId, tableId, linkFieldId, recordId)}${buildQuery({ page, pageSize: 100 })}`);
    const records = data?.records ?? [];
    all = all.concat(records);
    hasMore = !!data?.next && records.length > 0;
    page++;
  }
  return all;
}

// API v3 wymaga id jako tekstu: [{ "id": "12" }]
const linkBody = (ids) => JSON.stringify(ids.map((id) => ({ id: String(id) })));

export async function linkRecords(cfg, baseId, tableId, linkFieldId, recordId, ids) {
  if (!ids.length) return;
  await apiFetch(cfg, linksPath(baseId, tableId, linkFieldId, recordId), { method: 'POST', body: linkBody(ids) });
}

export async function unlinkRecords(cfg, baseId, tableId, linkFieldId, recordId, ids) {
  if (!ids.length) return;
  await apiFetch(cfg, linksPath(baseId, tableId, linkFieldId, recordId), { method: 'DELETE', body: linkBody(ids) });
}

/**
 * Doprowadza powiązania pola do stanu afterIds: najpierw odłącza usunięte
 * (ważne przy relacjach jeden-do-jednego / wiele-do-jednego), potem dołącza nowe.
 */
export async function saveLinkChanges(cfg, baseId, tableId, linkFieldId, recordId, beforeIds, afterIds) {
  const before = new Set(beforeIds.map(String));
  const after = new Set(afterIds.map(String));
  const toRemove = [...before].filter((id) => !after.has(id));
  const toAdd = [...after].filter((id) => !before.has(id));
  await unlinkRecords(cfg, baseId, tableId, linkFieldId, recordId, toRemove);
  await linkRecords(cfg, baseId, tableId, linkFieldId, recordId, toAdd);
  return { added: toAdd.length, removed: toRemove.length };
}
