import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, ScrollView, ActivityIndicator, TouchableOpacity,
  StyleSheet, RefreshControl, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import KanbanColumn from '../components/KanbanColumn';
import RecordGrid from '../components/RecordGrid';
import RecordDetailModal from '../components/RecordDetailModal';
import RecordFormModal from '../components/RecordFormModal';
import { useTableMeta, useRecords } from '../hooks/useNocoDB';
import { deleteRecord } from '../services/nocodbApi';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../theme/ThemeContext';
import { visibleFields, titleFieldName } from '../utils/fieldTypes';

const VIEW_MODE_KEY = 'nocodb_view_mode';
const NO_STATUS = 'Brak statusu';

function KanbanView({ columns, records, statusField, titleField, onCardPress, loading, reload, theme }) {
  const grouped = useMemo(() => {
    const g = {};
    columns.forEach((col) => { g[col.title] = []; });
    records.forEach((r) => {
      const status = r.fields?.[statusField];
      if (status && g[status]) g[status].push(r);
      else (g[NO_STATUS] = g[NO_STATUS] ?? []).push(r);
    });
    return g;
  }, [columns, records, statusField]);

  const allColumns = grouped[NO_STATUS]?.length ? [...columns, { title: NO_STATUS, color: theme.border }] : columns;

  return (
    <ScrollView
      contentContainerStyle={styles.scrollContent}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} tintColor={theme.accent} colors={[theme.accent]} />}
    >
      {allColumns.map((col) => (
        <KanbanColumn
          key={col.title}
          column={col}
          records={grouped[col.title] ?? []}
          titleField={titleField}
          onCardPress={onCardPress}
          theme={theme}
        />
      ))}
    </ScrollView>
  );
}

function ModeSwitch({ mode, onChange, hasKanban, info, theme }) {
  const Btn = ({ value, label }) => {
    const active = mode === value;
    return (
      <TouchableOpacity
        onPress={() => onChange(value)}
        style={[styles.modeBtn, active && { backgroundColor: theme.accent }]}
        activeOpacity={0.7}
      >
        <Text style={[styles.modeText, { color: active ? theme.accentText : theme.textSecondary }]}>{label}</Text>
      </TouchableOpacity>
    );
  };
  return (
    <View style={[styles.modeBar, { backgroundColor: theme.surface, borderBottomColor: theme.border }]}>
      {hasKanban ? (
        <View style={[styles.modeGroup, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
          <Btn value="grid" label="▦ Tabela" />
          <Btn value="kanban" label="☰ Kanban" />
        </View>
      ) : <View />}
      <Text style={[styles.infoText, { color: theme.textMuted }]}>{info}</Text>
    </View>
  );
}

export default function TableScreen({ route, navigation }) {
  const { baseId, tableId, tableName } = route.params;
  const { settings } = useSettings();
  const { theme } = useTheme();

  const meta = useTableMeta(baseId, tableId);
  const fields = useMemo(() => visibleFields(meta.table), [meta.table]);
  const titleField = useMemo(() => titleFieldName(meta.table, settings), [meta.table, settings]);
  const hasKanban = meta.statusOptions.length > 0;

  const [mode, setMode] = useState('grid');
  const [sort, setSort] = useState(null);
  const viewMode = hasKanban ? mode : 'grid';

  const grid = useRecords(baseId, tableId, { sort, enabled: !!meta.table && viewMode === 'grid' });
  const kanban = useRecords(baseId, tableId, { all: true, enabled: !!meta.table && viewMode === 'kanban' });
  const active = viewMode === 'grid' ? grid : kanban;

  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null); // { mode: 'create' | 'edit', record }

  useEffect(() => {
    AsyncStorage.getItem(VIEW_MODE_KEY).then((v) => { if (v === 'grid' || v === 'kanban') setMode(v); }).catch(() => {});
  }, []);

  const changeMode = (m) => {
    setMode(m);
    AsyncStorage.setItem(VIEW_MODE_KEY, m).catch(() => {});
  };

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: tableName ?? 'Tabela',
      headerStyle: { backgroundColor: theme.header },
      headerTintColor: theme.headerText,
    });
  }, [navigation, tableName, theme]);

  // iOS nie pozwala otworzyć modala, zanim poprzedni się nie zamknie
  const afterModal = (fn) => (Platform.OS === 'ios' ? setTimeout(fn, 400) : fn());

  const openEdit = useCallback((record) => {
    setSelected(null);
    afterModal(() => setForm({ mode: 'edit', record }));
  }, []);

  const handleSaved = useCallback((record, kind) => {
    setForm(null);
    if (kind === 'edit' && record) {
      grid.replaceLocal(record);
      kanban.replaceLocal(record);
    } else {
      active.reload();
      // Nowy rekord może nie trafić na pierwszą stronę – pokaż go od razu
      if (record) afterModal(() => setSelected(record));
    }
  }, [grid.replaceLocal, kanban.replaceLocal, active.reload]);

  const handleDelete = useCallback(async (record) => {
    await deleteRecord(settings, baseId, tableId, record.id);
    setSelected(null);
    grid.removeLocal(record.id);
    kanban.removeLocal(record.id);
    // Usunięcie przesuwa kolejne strony – odśwież, żeby przy doczytywaniu nic nie pominąć
    if (viewMode === 'grid' && grid.hasMore) grid.reload();
  }, [settings, baseId, tableId, viewMode, grid.hasMore, grid.removeLocal, grid.reload, kanban.removeLocal]);

  if (meta.loading || (!meta.table && !meta.error)) return (
    <View style={[styles.center, { backgroundColor: theme.bg }]}>
      <ActivityIndicator size="large" color={theme.accent} />
      <Text style={[styles.loadingText, { color: theme.textMuted }]}>Ładowanie…</Text>
    </View>
  );

  const error = meta.error ?? active.error;
  if (error) return (
    <View style={[styles.center, { backgroundColor: theme.bg }]}>
      <Text style={[styles.errorText, { color: theme.error }]}>⚠️ {error}</Text>
      <TouchableOpacity
        style={[styles.retryBtn, { backgroundColor: theme.accent }]}
        onPress={meta.error ? meta.reload : sort ? () => setSort(null) : active.reload}
      >
        <Text style={[styles.retryText, { color: theme.accentText }]}>Spróbuj ponownie</Text>
      </TouchableOpacity>
    </View>
  );

  const count = active.records.length;
  const info = active.loading && !count ? 'Ładowanie…' : `${count}${active.hasMore ? '+' : ''} rekordów`;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <ModeSwitch mode={viewMode} onChange={changeMode} hasKanban={hasKanban} info={info} theme={theme} />

      {viewMode === 'kanban' ? (
        <KanbanView
          columns={meta.statusOptions}
          records={kanban.records}
          statusField={settings.statusField}
          titleField={titleField}
          onCardPress={setSelected}
          loading={kanban.loading}
          reload={kanban.reload}
          theme={theme}
        />
      ) : (
        <RecordGrid
          fields={fields}
          records={grid.records}
          onRowPress={setSelected}
          onEndReached={grid.loadMore}
          hasMore={grid.hasMore}
          loadingMore={grid.loadingMore}
          refreshing={grid.loading}
          onRefresh={grid.reload}
          sort={sort}
          onSortChange={setSort}
          theme={theme}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: theme.accent, shadowColor: theme.shadow }]}
        onPress={() => setForm({ mode: 'create', record: null })}
        activeOpacity={0.85}
      >
        <Text style={[styles.fabText, { color: theme.accentText }]}>＋</Text>
      </TouchableOpacity>

      <RecordDetailModal
        record={selected}
        fields={fields}
        titleField={titleField}
        visible={!!selected}
        onClose={() => setSelected(null)}
        onEdit={openEdit}
        onDelete={handleDelete}
        theme={theme}
      />
      <RecordFormModal
        key={form ? `${form.mode}-${form.record?.id ?? 'new'}` : 'closed'}
        visible={!!form}
        mode={form?.mode}
        record={form?.record}
        fields={fields}
        baseId={baseId}
        tableId={tableId}
        onClose={() => setForm(null)}
        onSaved={handleSaved}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { padding: 12, paddingBottom: 96 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  loadingText: { fontSize: 14, marginTop: 8 },
  errorText: { fontSize: 14, textAlign: 'center' },
  retryBtn: { borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  modeBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth,
  },
  modeGroup: { flexDirection: 'row', borderRadius: 10, borderWidth: 1, padding: 2 },
  modeBtn: { borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6 },
  modeText: { fontSize: 13, fontWeight: '700' },
  infoText: { fontSize: 12 },
  fab: {
    position: 'absolute', right: 20, bottom: 28, width: 58, height: 58, borderRadius: 29,
    alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.25, shadowRadius: 6, elevation: 6,
  },
  fabText: { fontSize: 28, fontWeight: '600', marginTop: -2 },
});
