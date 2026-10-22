import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, View, Text, TextInput, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, SafeAreaView,
} from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { fetchRecords, fetchTableMetaCached, containsWhere } from '../services/nocodbApi';
import { isSingleLink, linkedLabel } from '../utils/fieldTypes';

/** Etykieta rekordu z tabeli powiązanej: wartość pola wyświetlanego albo #id */
function labelOf(record, displayTitle) {
  const v = displayTitle ? record?.fields?.[displayTitle] : undefined;
  if (v === null || v === undefined || v === '') return linkedLabel(record);
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/** Powiązane rekordy jako etykiety; onPress otwiera rekord, onRemove odłącza */
export function LinkChips({ records, onPress, onRemove, emptyText = '—', theme }) {
  if (!records.length) return <Text style={[styles.emptyText, { color: theme.textMuted }]}>{emptyText}</Text>;
  return (
    <View style={styles.chips}>
      {records.map((r) => (
        <View key={String(r.id)} style={[styles.chip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <TouchableOpacity onPress={onPress ? () => onPress(r) : undefined} disabled={!onPress} activeOpacity={0.6}>
            <Text style={[styles.chipText, { color: onPress ? theme.accent : theme.text }]} numberOfLines={1}>
              🔗 {linkedLabel(r)}
            </Text>
          </TouchableOpacity>
          {onRemove && (
            <TouchableOpacity onPress={() => onRemove(r)} hitSlop={8} style={styles.chipRemove}>
              <Text style={[styles.chipRemoveText, { color: theme.textMuted }]}>✕</Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}

/**
 * Wybór rekordów z tabeli powiązanej (z wyszukiwaniem po polu wyświetlanym).
 * Relacja pojedyncza: wybór jednym dotknięciem. Wielokrotna: zaznaczanie + „Dodaj”.
 */
export function RecordPickerModal({ visible, field, baseId, linkedIds = [], onPick, onClose, theme }) {
  const { settings } = useSettings();
  const single = isSingleLink(field);
  const relatedId = field.options?.related_table_id;

  const [table, setTable] = useState(null);
  const [query, setQuery] = useState('');
  const [records, setRecords] = useState([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState([]);
  const requestId = useRef(0);

  const displayTitle = table?.fields?.find((f) => f.id === table.display_field_id)?.title;

  useEffect(() => {
    if (!visible) return;
    setQuery(''); setSelected([]); setRecords([]); setError(null);
    fetchTableMetaCached(settings, baseId, relatedId).then(setTable).catch((e) => setError(e.message));
  }, [visible, settings, baseId, relatedId]);

  const load = useCallback(async (p) => {
    const req = ++requestId.current;
    setLoading(true); setError(null);
    try {
      const q = query.trim();
      const res = await fetchRecords(settings, baseId, relatedId, {
        page: p,
        where: q && displayTitle ? containsWhere(displayTitle, q) : undefined,
        fields: displayTitle ? [displayTitle] : undefined,
      });
      if (req !== requestId.current) return;
      setRecords((prev) => (p === 1 ? res.records : prev.concat(res.records)));
      setHasMore(res.hasMore);
      setPage(p);
    } catch (e) {
      if (req === requestId.current) setError(e.message);
    } finally {
      if (req === requestId.current) setLoading(false);
    }
  }, [settings, baseId, relatedId, query, displayTitle]);

  // Wyszukiwanie z opóźnieniem, żeby nie pytać serwera przy każdej literze
  useEffect(() => {
    if (!visible || !table) return undefined;
    const t = setTimeout(() => load(1), query ? 350 : 0);
    return () => clearTimeout(t);
  }, [visible, table, query, load]);

  const linked = new Set(linkedIds.map(String));
  const isSelected = (r) => selected.some((s) => String(s.id) === String(r.id));
  const asLink = (r) => ({ id: r.id, fields: displayTitle ? { [displayTitle]: r.fields?.[displayTitle] ?? null } : {} });

  const handlePress = (r) => {
    if (single) { onPick([asLink(r)]); return; }
    setSelected((prev) => (isSelected(r) ? prev.filter((s) => String(s.id) !== String(r.id)) : [...prev, r]));
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.surface }]}>
        <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} style={styles.topBtn}>
            <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Anuluj</Text>
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={1}>{field.title}</Text>
            {table ? <Text style={[styles.subTitle, { color: theme.textMuted }]} numberOfLines={1}>z tabeli {table.title}</Text> : null}
          </View>
          {single ? <View style={styles.topBtnPlaceholder} /> : (
            <TouchableOpacity
              onPress={() => onPick(selected.map(asLink))}
              disabled={!selected.length}
              style={[styles.addBtn, { backgroundColor: theme.accent, opacity: selected.length ? 1 : 0.4 }]}
            >
              <Text style={[styles.addText, { color: theme.accentText }]}>Dodaj{selected.length ? ` (${selected.length})` : ''}</Text>
            </TouchableOpacity>
          )}
        </View>

        <TextInput
          style={[styles.search, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText }]}
          value={query}
          onChangeText={setQuery}
          placeholder={displayTitle ? `Szukaj po „${displayTitle}”…` : 'Szukaj…'}
          placeholderTextColor={theme.inputPlaceholder}
          autoCorrect={false}
          clearButtonMode="while-editing"
        />

        {error ? <Text style={[styles.error, { color: theme.error }]}>⚠️ {error}</Text> : null}

        <FlatList
          data={records}
          keyExtractor={(r) => String(r.id)}
          keyboardShouldPersistTaps="handled"
          onEndReached={hasMore && !loading ? () => load(page + 1) : undefined}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => {
            const already = linked.has(String(item.id));
            const checked = isSelected(item);
            return (
              <TouchableOpacity
                onPress={() => handlePress(item)}
                disabled={already && !single}
                style={[styles.row, { borderBottomColor: theme.borderLight, backgroundColor: checked ? theme.surfaceAlt : 'transparent' }]}
                activeOpacity={0.6}
              >
                <Text style={[styles.rowText, { color: already ? theme.textMuted : theme.text }]} numberOfLines={2}>
                  {labelOf(item, displayTitle)}
                </Text>
                <Text style={[styles.rowMark, { color: theme.accent }]}>
                  {already ? 'powiązany' : checked ? '✓' : ''}
                </Text>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            loading ? null : <Text style={[styles.emptyList, { color: theme.textMuted }]}>{query ? 'Brak wyników.' : 'Brak rekordów.'}</Text>
          }
          ListFooterComponent={loading ? <ActivityIndicator style={styles.footer} color={theme.accent} /> : null}
        />
      </SafeAreaView>
    </Modal>
  );
}

/** Pole powiązania w formularzu: lista powiązanych rekordów + przycisk wyboru */
export function LinkFieldInput({ field, value, onChange, baseId, loading, theme }) {
  const [picking, setPicking] = useState(false);
  const single = isSingleLink(field);
  const ids = value.map((r) => String(r.id));

  const handlePick = (picked) => {
    setPicking(false);
    if (single) onChange(picked.slice(0, 1));
    else onChange([...value, ...picked.filter((r) => !ids.includes(String(r.id)))]);
  };

  return (
    <View style={styles.inputWrap}>
      {loading
        ? <ActivityIndicator style={styles.inputLoading} color={theme.accent} />
        : <LinkChips records={value} onRemove={(r) => onChange(value.filter((x) => String(x.id) !== String(r.id)))} emptyText="Brak powiązań" theme={theme} />}
      <TouchableOpacity
        onPress={() => setPicking(true)}
        disabled={loading}
        style={[styles.pickBtn, { borderColor: theme.accent, opacity: loading ? 0.5 : 1 }]}
        activeOpacity={0.7}
      >
        <Text style={[styles.pickText, { color: theme.accent }]}>
          {single && value.length ? '⇄ Zmień powiązanie' : '＋ Dodaj powiązanie'}
        </Text>
      </TouchableOpacity>
      <RecordPickerModal
        visible={picking}
        field={field}
        baseId={baseId}
        linkedIds={ids}
        onPick={handlePick}
        onClose={() => setPicking(false)}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { flexDirection: 'row', alignItems: 'center', borderRadius: 14, borderWidth: 1, paddingLeft: 10, paddingRight: 6, paddingVertical: 4, maxWidth: '100%' },
  chipText: { fontSize: 13, fontWeight: '600', maxWidth: 240 },
  chipRemove: { marginLeft: 6, paddingHorizontal: 2 },
  chipRemoveText: { fontSize: 12, fontWeight: '700' },
  emptyText: { fontSize: 14 },
  inputWrap: { gap: 8 },
  inputLoading: { alignSelf: 'flex-start' },
  pickBtn: { alignSelf: 'flex-start', borderWidth: 1, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 6 },
  pickText: { fontSize: 13, fontWeight: '700' },
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 8 },
  topBtn: { paddingVertical: 6, paddingRight: 8, minWidth: 70 },
  topBtnPlaceholder: { minWidth: 70 },
  cancelText: { fontSize: 15, fontWeight: '600' },
  titleWrap: { flex: 1, alignItems: 'center' },
  modalTitle: { fontSize: 17, fontWeight: '700' },
  subTitle: { fontSize: 12, marginTop: 2 },
  addBtn: { borderRadius: 16, paddingHorizontal: 14, height: 34, minWidth: 70, alignItems: 'center', justifyContent: 'center' },
  addText: { fontSize: 14, fontWeight: '700' },
  search: { margin: 12, borderRadius: 10, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  error: { paddingHorizontal: 16, paddingBottom: 8, fontSize: 13 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, gap: 10 },
  rowText: { flex: 1, fontSize: 15 },
  rowMark: { fontSize: 13, fontWeight: '700' },
  emptyList: { padding: 24, textAlign: 'center', fontSize: 14 },
  footer: { padding: 16 },
});
