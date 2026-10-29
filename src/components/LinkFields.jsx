import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { fetchRecords, fetchTableMetaCached, containsWhere } from '../services/nocodbApi';
import { isSingleLink, linkedLabel } from '../utils/fieldTypes';
import {
  Icon, SheetBar, SearchField, PrimaryButton, Avatar, plural,
} from './ui';
import { t } from '../theme/typography';

const SECONDARY_TYPES = ['SingleLineText', 'Email', 'PhoneNumber', 'URL'];

/** Etykieta rekordu z tabeli powiązanej: wartość pola wyświetlanego albo #id */
function labelOf(record, displayTitle) {
  const v = displayTitle ? record?.fields?.[displayTitle] : undefined;
  if (v === null || v === undefined || v === '') return linkedLabel(record);
  return typeof v === 'object' ? JSON.stringify(v) : String(v);
}

/**
 * Wybór rekordów z tabeli powiązanej (wyszukiwanie po polu wyświetlanym).
 * Relacja pojedyncza: wybór jednym dotknięciem. Wielokrotna: zaznaczanie + „Dodaj”.
 */
export function RecordPickerModal({ visible, field, baseId, linkedIds = [], onPick, onClose, theme }) {
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
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
  const secondaryTitle = table?.fields?.find((f) => f.id !== table.display_field_id && SECONDARY_TYPES.includes(f.type))?.title;

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
        fields: displayTitle ? [displayTitle, secondaryTitle].filter(Boolean) : undefined,
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
  }, [settings, baseId, relatedId, query, displayTitle, secondaryTitle]);

  // Wyszukiwanie z opóźnieniem, żeby nie pytać serwera przy każdej literze
  useEffect(() => {
    if (!visible || !table) return undefined;
    const h = setTimeout(() => load(1), query ? 350 : 0);
    return () => clearTimeout(h);
  }, [visible, table, query, load]);

  const linked = new Set(linkedIds.map(String));
  const isSelected = (r) => selected.some((s) => String(s.id) === String(r.id));
  const asLink = (r) => ({ id: r.id, fields: displayTitle ? { [displayTitle]: r.fields?.[displayTitle] ?? null } : {} });

  const handlePress = (r) => {
    if (single) { onPick([asLink(r)]); return; }
    setSelected((prev) => (isSelected(r) ? prev.filter((s) => String(s.id) !== String(r.id)) : [...prev, r]));
  };

  const n = selected.length;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.flex, { backgroundColor: theme.surface }]}>
        <SheetBar
          onCancel={onClose}
          title={`${single ? 'Wybierz' : 'Dodaj'}: ${field.title}`}
          subtitle={table ? `z tabeli ${table.title}` : undefined}
          theme={theme}
        />

        <View style={styles.searchWrap}>
          <SearchField
            value={query}
            onChangeText={setQuery}
            placeholder={displayTitle ? `Szukaj w „${displayTitle}”` : 'Szukaj…'}
            theme={theme}
            active={!!query}
          />
        </View>

        {error ? (
          <View style={[styles.errorBox, { backgroundColor: theme.errorSoft }]}>
            <Icon name="alert-circle" size={16} color={theme.error} />
            <Text style={[t(13, 'semibold'), styles.flex, { color: theme.error }]}>{error}</Text>
          </View>
        ) : query.trim() && !loading ? (
          <Text style={[t(13, 'medium'), styles.count, { color: theme.textSecondary }]}>
            {records.length}{hasMore ? '+' : ''} {plural(records.length, 'wynik', 'wyniki', 'wyników')} dla „{query.trim()}”
          </Text>
        ) : null}

        <FlatList
          data={records}
          keyExtractor={(r) => String(r.id)}
          keyboardShouldPersistTaps="handled"
          onEndReached={hasMore && !loading ? () => load(page + 1) : undefined}
          onEndReachedThreshold={0.5}
          renderItem={({ item }) => {
            const already = linked.has(String(item.id));
            const checked = isSelected(item);
            const label = labelOf(item, displayTitle);
            const secondary = secondaryTitle ? item.fields?.[secondaryTitle] : null;
            return (
              <TouchableOpacity
                onPress={() => handlePress(item)}
                disabled={already && !single}
                style={[styles.row, { borderTopColor: theme.borderLight, backgroundColor: checked ? theme.accentSoft : 'transparent' }]}
                activeOpacity={0.6}
                accessibilityRole={single ? 'button' : 'checkbox'}
                accessibilityState={{ checked: checked || already, disabled: already && !single }}
              >
                <Avatar text={label} size={40} />
                <View style={styles.rowText}>
                  <Text style={[t(16, 'bold'), { color: already && !single ? theme.textSecondary : theme.text }]} numberOfLines={1}>{label}</Text>
                  {secondary ? <Text style={[t(13, 'medium'), { color: theme.textMuted }]} numberOfLines={1}>{String(secondary)}</Text> : null}
                </View>
                {already ? (
                  <View style={[styles.badge, { backgroundColor: theme.segment }]}>
                    <Text style={[t(12, 'extrabold'), { color: theme.textSecondary }]}>{single ? 'Obecny' : 'Powiązany'}</Text>
                  </View>
                ) : !single ? (
                  <View style={[styles.checkbox, checked
                    ? { backgroundColor: theme.accent, borderColor: theme.accent }
                    : { borderColor: theme.borderStrong }]}
                  >
                    {checked ? <Icon name="check" size={16} color={theme.accentText} /> : null}
                  </View>
                ) : null}
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={loading ? null : (
            <Text style={[t(14, 'medium'), styles.empty, { color: theme.textMuted }]}>{query ? 'Brak wyników.' : 'Brak rekordów.'}</Text>
          )}
          ListFooterComponent={loading ? <ActivityIndicator style={styles.footer} color={theme.accent} /> : null}
        />

        {!single && (
          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border }]}>
            <PrimaryButton
              label={n ? `Dodaj ${n} ${plural(n, 'rekord', 'rekordy', 'rekordów')}` : 'Zaznacz rekordy'}
              icon={n ? 'check' : undefined}
              onPress={() => onPick(selected.map(asLink))}
              disabled={!n}
              theme={theme}
              height={54}
            />
          </View>
        )}
      </View>
    </Modal>
  );
}

/** Pole powiązania w formularzu: pojedyncze jako wiersz z „Zmień”, wielokrotne jako etykiety + „Dodaj” */
export function LinkFieldInput({ field, value, onChange, baseId, loading, theme }) {
  const [picking, setPicking] = useState(false);
  const single = isSingleLink(field);
  const ids = value.map((r) => String(r.id));

  const handlePick = (picked) => {
    setPicking(false);
    if (single) onChange(picked.slice(0, 1));
    else onChange([...value, ...picked.filter((r) => !ids.includes(String(r.id)))]);
  };
  const remove = (r) => onChange(value.filter((x) => String(x.id) !== String(r.id)));

  let body;
  if (loading) {
    body = <ActivityIndicator style={styles.loading} color={theme.accent} />;
  } else if (single) {
    const current = value[0];
    body = (
      <View style={[styles.singleRow, { borderColor: theme.borderStrong }]}>
        <Icon name="link" size={16} color={current ? theme.accent : theme.textFaint} />
        <Text style={[t(15, current ? 'bold' : 'medium'), styles.flex, { color: current ? theme.text : theme.textFaint }]} numberOfLines={1}>
          {current ? linkedLabel(current) : 'Brak powiązania'}
        </Text>
        {current ? (
          <TouchableOpacity onPress={() => remove(current)} style={styles.smallBtn} accessibilityRole="button" accessibilityLabel={`Odłącz ${linkedLabel(current)}`}>
            <Icon name="x" size={17} color={theme.textSecondary} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity onPress={() => setPicking(true)} style={[styles.changeBtn, { backgroundColor: theme.accentSoft }]} accessibilityRole="button">
          <Icon name={current ? 'repeat' : 'plus'} size={15} color={theme.accentStrong} />
          <Text style={[t(14, 'extrabold'), { color: theme.accentStrong }]}>{current ? 'Zmień' : 'Wybierz'}</Text>
        </TouchableOpacity>
      </View>
    );
  } else {
    body = (
      <View style={styles.chips}>
        {value.map((r) => (
          <View key={String(r.id)} style={[styles.chip, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
            <Text style={[t(14, 'bold'), styles.chipText, { color: theme.text }]} numberOfLines={1}>{linkedLabel(r)}</Text>
            <TouchableOpacity onPress={() => remove(r)} style={styles.chipRemove} accessibilityRole="button" accessibilityLabel={`Odłącz ${linkedLabel(r)}`}>
              <Icon name="x" size={14} color={theme.textSecondary} />
            </TouchableOpacity>
          </View>
        ))}
        <TouchableOpacity onPress={() => setPicking(true)} style={[styles.addChip, { borderColor: theme.accent }]} accessibilityRole="button">
          <Icon name="plus" size={14} color={theme.accent} />
          <Text style={[t(14, 'extrabold'), { color: theme.accent }]}>Dodaj</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      {body}
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
  flex: { flex: 1 },
  loading: { alignSelf: 'flex-start', paddingVertical: 8 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  count: { paddingHorizontal: 20, paddingVertical: 8 },
  errorBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16, marginTop: 8, padding: 10, borderRadius: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68, paddingHorizontal: 20, borderTopWidth: 1 },
  rowText: { flex: 1, minWidth: 0, gap: 2 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  checkbox: { width: 24, height: 24, borderRadius: 7, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  empty: { padding: 24, textAlign: 'center' },
  footer: { padding: 16 },
  bottomBar: { paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1 },
  singleRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingLeft: 12, paddingRight: 6, borderRadius: 12, borderWidth: 1 },
  smallBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  changeBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 12, borderRadius: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', height: 36, paddingLeft: 12, paddingRight: 2, borderRadius: 999, borderWidth: 1, maxWidth: '100%' },
  chipText: { flexShrink: 1, maxWidth: 220 },
  chipRemove: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1.5, borderStyle: 'dashed' },
});
