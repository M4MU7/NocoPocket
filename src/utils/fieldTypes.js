/**
 * Obsługa typów pól NocoDB v3: wyświetlanie wartości oraz konwersja
 * między wartością z API a wartością w formularzu edycji.
 */

// Pola wyliczane / systemowe / złożone – tylko do odczytu w aplikacji
const READ_ONLY_TYPES = new Set([
  'ID', 'AutoNumber', 'Links', 'LinkToAnotherRecord', 'Lookup', 'Rollup', 'Formula',
  'Button', 'Barcode', 'QrCode', 'CreatedTime', 'LastModifiedTime', 'CreatedBy',
  'LastModifiedBy', 'Attachment', 'User', 'Geometry', 'Duration',
]);

// Pola, których nie pokazujemy w tabeli ani formularzu
const HIDDEN_TYPES = new Set(['ID', 'Button']);

// Pól złożonych nie da się sensownie sortować
const UNSORTABLE_TYPES = new Set([
  'Links', 'LinkToAnotherRecord', 'Lookup', 'Rollup', 'Attachment', 'JSON', 'Button', 'User', 'Geometry',
]);

export const isEditable = (field) => !READ_ONLY_TYPES.has(field.type);
export const isSortable = (field) => !UNSORTABLE_TYPES.has(field.type);

// Powiązania z innymi tabelami – edytowane osobnym komponentem przez endpoint /links
export const isLinkField = (field) =>
  (field.type === 'Links' || field.type === 'LinkToAnotherRecord') && !!field.options?.related_table_id;

/** Relacja wiele-do-jednego / jeden-do-jednego – rekord może mieć tylko jedno powiązanie */
export const isSingleLink = (field) => ['mo', 'oo'].includes(field.options?.relation_type);

/** Wartość pola powiązania z API → lista [{ id, fields }] (liczba = brak szczegółów) */
export function linkedRecordsOf(value) {
  if (value === null || value === undefined || typeof value !== 'object') return [];
  return (Array.isArray(value) ? value : [value]).filter((v) => v && typeof v === 'object' && v.id !== undefined);
}

/** Pola do wyświetlenia – pole wyświetlane (display field) zawsze pierwsze */
export function visibleFields(table) {
  const fields = (table?.fields ?? []).filter((f) => !HIDDEN_TYPES.has(f.type));
  const display = fields.find((f) => f.id === table?.display_field_id);
  return display ? [display, ...fields.filter((f) => f !== display)] : fields;
}

/** Nazwa pola używanego jako tytuł rekordu */
export function titleFieldName(table, settings) {
  const fields = table?.fields ?? [];
  if (settings?.titleField && fields.some((f) => f.title === settings.titleField)) return settings.titleField;
  return fields.find((f) => f.id === table?.display_field_id)?.title ?? fields.find((f) => !HIDDEN_TYPES.has(f.type))?.title;
}

export function recordTitle(record, titleField) {
  const v = titleField ? record?.fields?.[titleField] : null;
  if (v === null || v === undefined || v === '') return `Rekord #${record?.id ?? '?'}`;
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

// ───────────────────────── wyświetlanie ─────────────────────────

const pad = (n) => String(n).padStart(2, '0');

function toArray(value, splitString = false) {
  if (Array.isArray(value)) return value;
  if (splitString && typeof value === 'string') return value.split(',').map((s) => s.trim()).filter(Boolean);
  return [value];
}

/** "2022-02-02 00:00:00+00:00" → Date (Hermes nie parsuje spacji zamiast "T") */
function parseDateTime(value) {
  if (!value) return null;
  const d = new Date(String(value).trim().replace(' ', 'T'));
  return isNaN(d.getTime()) ? null : d;
}

function formatLocalDateTime(d) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDuration(seconds) {
  const s = Number(seconds);
  if (!isFinite(s)) return String(seconds);
  return `${Math.floor(s / 3600)}:${pad(Math.floor((s % 3600) / 60))}:${pad(Math.floor(s % 60))}`;
}

export function linkedLabel(item) {
  if (item === null || item === undefined) return '';
  if (typeof item !== 'object') return String(item);
  const first = item.fields ? Object.values(item.fields)[0] : undefined;
  return first !== undefined && first !== null ? String(first) : `#${item.id ?? '?'}`;
}

export function formatValue(field, value) {
  if (value === null || value === undefined || value === '') return '';
  switch (field?.type) {
    case 'Checkbox':
      return value ? '✓' : '';
    case 'MultiSelect':
      return toArray(value, true).join(', ');
    case 'DateTime':
    case 'CreatedTime':
    case 'LastModifiedTime': {
      const d = parseDateTime(value);
      return d ? formatLocalDateTime(d) : String(value);
    }
    case 'Time':
      return String(value).slice(0, 5);
    case 'Percent':
      return `${value}%`;
    case 'Currency':
      return field.options?.code ? `${value} ${field.options.code}` : String(value);
    case 'Rating':
      return '★'.repeat(Math.max(0, Math.round(Number(value) || 0)));
    case 'Duration':
      return formatDuration(value);
    case 'Attachment':
      return toArray(value).map((a) => a?.title ?? a?.url ?? 'plik').join(', ');
    case 'User':
    case 'CreatedBy':
    case 'LastModifiedBy':
      return toArray(value).map((u) => u?.display_name || u?.email || u?.id || '').join(', ');
    case 'Links':
    case 'LinkToAnotherRecord':
      if (typeof value === 'number') return `${value} powiąz.`;
      return toArray(value).map(linkedLabel).join(', ');
    default:
      if (Array.isArray(value)) return value.map(linkedLabel).join(', ');
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
  }
}

/** Kolor opcji SingleSelect/MultiSelect (lub null) */
export function choiceColor(field, title) {
  return field?.options?.choices?.find((c) => c.title === title)?.color ?? null;
}

/** Kolor tekstu czytelny na danym tle */
export function getContrastColor(hexColor) {
  try {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#1a202c' : '#f0f4f8';
  } catch {
    return '#1a202c';
  }
}

// ───────────────────────── formularz ─────────────────────────

/** Wartość z API → wartość trzymana w stanie formularza */
export function toFormValue(field, value) {
  switch (field.type) {
    case 'Checkbox':
      return !!value;
    case 'SingleSelect':
      return value ?? null;
    case 'MultiSelect':
      return value === null || value === undefined ? [] : toArray(value, true);
    case 'Rating':
      return Number(value) || 0;
    case 'DateTime': {
      const d = parseDateTime(value);
      return d ? formatLocalDateTime(d) : '';
    }
    case 'Time':
      return value ? String(value).slice(0, 5) : '';
    case 'JSON':
      if (value === null || value === undefined) return '';
      return typeof value === 'string' ? value : JSON.stringify(value, null, 2);
    default:
      return value === null || value === undefined ? '' : String(value);
  }
}

/**
 * Wartość z formularza → wartość wysyłana do API.
 * Rzuca Error z czytelnym komunikatem, gdy wartość jest niepoprawna.
 */
export function fromFormValue(field, formValue) {
  const str = typeof formValue === 'string' ? formValue.trim() : formValue;
  switch (field.type) {
    case 'Checkbox':
      return !!formValue;
    case 'SingleSelect':
      return formValue || null;
    case 'MultiSelect':
      return formValue?.length ? formValue : null;
    case 'Rating':
      return Number(formValue) || 0;
    case 'Number':
    case 'Year': {
      if (str === '') return null;
      const n = Number(str);
      if (!Number.isInteger(n)) throw new Error('musi być liczbą całkowitą');
      return n;
    }
    case 'Decimal':
    case 'Currency':
    case 'Percent': {
      if (str === '') return null;
      const n = Number(str.replace(',', '.'));
      if (!isFinite(n)) throw new Error('musi być liczbą');
      return n;
    }
    case 'Date': {
      if (str === '') return null;
      if (!/^\d{4}-\d{2}-\d{2}$/.test(str) || isNaN(new Date(`${str}T00:00:00`).getTime())) {
        throw new Error('format daty: RRRR-MM-DD');
      }
      return str;
    }
    case 'DateTime': {
      if (str === '') return null;
      const m = str.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})$/);
      if (!m) throw new Error('format: RRRR-MM-DD GG:MM');
      // Użytkownik wpisuje czas lokalny – wysyłamy w UTC
      const d = new Date(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
      if (isNaN(d.getTime())) throw new Error('niepoprawna data');
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:00+00:00`;
    }
    case 'Time': {
      if (str === '') return null;
      const m = str.match(/^(\d{1,2}):(\d{2})$/);
      if (!m || +m[1] > 23 || +m[2] > 59) throw new Error('format: GG:MM');
      return `${pad(m[1])}:${m[2]}:00`;
    }
    case 'JSON': {
      if (str === '') return null;
      try { return JSON.parse(str); } catch { throw new Error('niepoprawny JSON'); }
    }
    default:
      return str === '' ? null : str;
  }
}

/** Dzisiejsza data / teraz w formacie formularza */
export function nowFormValue(field) {
  const d = new Date();
  if (field.type === 'Date') return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  if (field.type === 'Time') return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  return formatLocalDateTime(d);
}
