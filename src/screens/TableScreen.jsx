import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Platform, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RecordGrid from '../components/RecordGrid';
import KanbanBoard, { NO_STATUS } from '../components/KanbanBoard';
import MoveSheet from '../components/MoveSheet';
import RecordDetailModal from '../components/RecordDetailModal';
import RecordFormModal from '../components/RecordFormModal';
import { useTableMeta, useRecords, useCount } from '../hooks/useNocoDB';
import { useSettings } from '../context/SettingsContext';
import { usePins } from '../context/PinsContext';
import { useTheme } from '../theme/ThemeContext';
import {
  deleteRecord, updateRecord, fetchRecord, containsWhere,
} from '../services/nocodbApi';
import { visibleFields, titleFieldName, recordTitle } from '../utils/fieldTypes';
import {
  Icon, IconButton, TopBar, Segmented, SearchField, Chip, PrimaryButton, plural,
} from '../components/ui';
import { t } from '../theme/typography';

const VIEW_MODE_KEY = 'nocodb_view_mode';
const layoutKey = (tableId) => `nocopocket_kanban_layout_${tableId}`;
const SEARCHABLE = ['SingleLineText', 'LongText', 'Email', 'URL', 'PhoneNumber'];

export default function TableScreen({ route, navigation }) {
  const { baseId, baseName, tableId, tableName } = route.params;
  const { settings } = useSettings();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const { isPinned, togglePin } = usePins();

  const meta = useTableMeta(baseId, tableId);
  const fields = useMemo(() => visibleFields(meta.table), [meta.table]);
  const titleField = useMemo(() => titleFieldName(meta.table, settings), [meta.table, settings]);
  const displayField = fields[0];
  const searchable = !!displayField && SEARCHABLE.includes(displayField.type);
  const hasKanban = meta.statusOptions.length > 0;

  const [mode, setMode] = useState('grid');
  const [layout, setLayout] = useState('horizontal');
  const [sort, setSort] = useState(null);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const viewMode = hasKanban ? mode : 'grid';

  // Wyszukiwanie z opóźnieniem – serwer filtruje po polu głównym tabeli
  useEffect(() => {
    const h = setTimeout(() => setSearch(query.trim()), 350);
    return () => clearTimeout(h);
  }, [query]);
  const where = search && searchable ? containsWhere(displayField.title, search) : undefined;

  const grid = useRecords(baseId, tableId, { sort, where, enabled: !!meta.table && viewMode === 'grid' });
  const kanban = useRecords(baseId, tableId, { all: true, enabled: !!meta.table && viewMode === 'kanban' });
  const active = viewMode === 'grid' ? grid : kanban;

  const [countKey, setCountKey] = useState(0);
  const total = useCount(baseId, tableId, { refreshKey: countKey, enabled: !!meta.table });
  const found = useCount(baseId, tableId, { where, refreshKey: countKey, enabled: !!meta.table && !!where && viewMode === 'grid' });

  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(null); // { mode: 'create' | 'edit', record, preset }
  const [moving, setMoving] = useState(null); // rekord przenoszony w Kanbanie
  const [movingTo, setMovingTo] = useState(null);

  useEffect(() => {
    AsyncStorage.multiGet([VIEW_MODE_KEY, layoutKey(tableId)]).then(([[, m], [, l]]) => {
      if (m === 'grid' || m === 'kanban') setMode(m);
      if (l === 'horizontal' || l === 'vertical') setLayout(l);
    }).catch(() => {});
  }, [tableId]);

  const changeMode = (m) => { setMode(m); AsyncStorage.setItem(VIEW_MODE_KEY, m).catch(() => {}); };
  const changeLayout = (l) => { setLayout(l); AsyncStorage.setItem(layoutKey(tableId), l).catch(() => {}); };

  // iOS nie pozwala otworzyć modala, zanim poprzedni się nie zamknie
  const afterModal = (fn) => (Platform.OS === 'ios' ? setTimeout(fn, 400) : fn());

  const refreshAll = useCallback(() => { active.reload(); setCountKey((k) => k + 1); }, [active.reload]);

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
      refreshAll();
      // Nowy rekord może nie trafić na pierwszą stronę – pokaż go od razu
      if (record) afterModal(() => setSelected(record));
    }
  }, [grid.replaceLocal, kanban.replaceLocal, refreshAll]);

  const handleDelete = useCallback(async (record) => {
    await deleteRecord(settings, baseId, tableId, record.id);
    setSelected(null);
    grid.removeLocal(record.id);
    kanban.removeLocal(record.id);
    setCountKey((k) => k + 1);
    // Usunięcie przesuwa kolejne strony – odśwież, żeby przy doczytywaniu nic nie pominąć
    if (viewMode === 'grid' && grid.hasMore) grid.reload();
  }, [settings, baseId, tableId, viewMode, grid.hasMore, grid.removeLocal, grid.reload, kanban.removeLocal]);

  const handleMove = async (status) => {
    setMovingTo(status);
    try {
      await updateRecord(settings, baseId, tableId, moving.id, { [settings.statusField]: status === NO_STATUS ? null : status });
      const fresh = await fetchRecord(settings, baseId, tableId, moving.id);
      kanban.replaceLocal(fresh);
      grid.replaceLocal(fresh);
      setMoving(null);
    } catch (e) {
      Alert.alert('Nie udało się przenieść', e.message);
    } finally {
      setMovingTo(null);
    }
  };

  const pinned = isPinned(tableId);
  const openMenu = () => Alert.alert(tableName, undefined, [
    { text: pinned ? 'Odepnij z ekranu startowego' : 'Przypnij na ekranie startowym', onPress: () => togglePin({ baseId, baseTitle: baseName, tableId, title: tableName }) },
    { text: 'Odśwież', onPress: () => { meta.reload(); refreshAll(); } },
    { text: 'Anuluj', style: 'cancel' },
  ]);

  const subtitle = [baseName, total !== null ? `${total} ${plural(total, 'rekord', 'rekordy', 'rekordów')}` : null].filter(Boolean).join(' · ');
  const topBar = (
    <TopBar
      onBack={() => navigation.goBack()}
      title={tableName}
      subtitle={subtitle}
      right={<IconButton icon="more-horizontal" label="Więcej opcji tabeli" onPress={openMenu} theme={theme} />}
      theme={theme}
    />
  );

  if (meta.loading || (!meta.table && !meta.error)) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.bg }]}>
        {topBar}
        <View style={styles.center}><ActivityIndicator size="large" color={theme.accent} /></View>
      </View>
    );
  }

  if (meta.error) {
    return (
      <View style={[styles.flex, { backgroundColor: theme.bg }]}>
        {topBar}
        <View style={styles.center}>
          <Icon name="alert-circle" size={28} color={theme.error} />
          <Text style={[t(15, 'semibold'), styles.centerText, { color: theme.error }]}>{meta.error}</Text>
          <PrimaryButton label="Spróbuj ponownie" onPress={meta.reload} theme={theme} height={46} />
        </View>
      </View>
    );
  }

  const loaded = grid.records.length;
  const gridFooter = loaded ? (
    <Text style={[t(13, 'medium'), styles.gridFooter, { color: theme.textSecondary }]}>
      {grid.hasMore
        ? `Wczytano ${loaded}${(where ? found : total) !== null ? ` z ${where ? found : total}` : ''} · przewiń, aby wczytać więcej`
        : `${loaded} ${plural(loaded, 'rekord', 'rekordy', 'rekordów')}`}
    </Text>
  ) : null;

  const statusColumns = [...meta.statusOptions, { title: NO_STATUS, color: null }];

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      {topBar}

      {hasKanban && (
        <View style={styles.segmentWrap}>
          <Segmented
            options={[{ key: 'grid', label: 'Tabela', icon: 'grid' }, { key: 'kanban', label: 'Kanban', icon: 'trello' }]}
            value={viewMode}
            onChange={changeMode}
            theme={theme}
          />
        </View>
      )}

      {active.error ? (
        <TouchableOpacity onPress={refreshAll} style={[styles.errorBanner, { backgroundColor: theme.errorSoft }]} accessibilityRole="button">
          <Icon name="alert-circle" size={18} color={theme.error} />
          <Text style={[t(13, 'semibold'), styles.flex, { color: theme.error }]} numberOfLines={3}>{active.error}</Text>
          <Text style={[t(13, 'extrabold'), { color: theme.error }]}>Ponów</Text>
        </TouchableOpacity>
      ) : null}

      {viewMode === 'grid' ? (
        <>
          {searchable && (
            <View style={styles.searchWrap}>
              <SearchField value={query} onChangeText={setQuery} placeholder={`Szukaj w „${displayField.title}”`} theme={theme} height={44} />
            </View>
          )}
          <View style={styles.toolbar}>
            {sort ? (
              <Chip
                active
                icon={sort.direction === 'asc' ? 'arrow-up' : 'arrow-down'}
                label={`${sort.field} ${sort.direction === 'asc' ? 'rosnąco' : 'malejąco'}`}
                onRemove={() => setSort(null)}
                theme={theme}
              />
            ) : (
              <Text style={[t(13, 'medium'), { color: theme.textMuted }]}>Dotknij nagłówka kolumny, aby sortować</Text>
            )}
            <View style={styles.flex} />
            {where && found !== null ? <Text style={[t(13, 'bold'), { color: theme.textSecondary }]}>{found} {plural(found, 'wynik', 'wyniki', 'wyników')}</Text> : null}
          </View>
          <RecordGrid
            fields={fields}
            records={grid.records}
            onRowPress={setSelected}
            onEndReached={grid.loadMore}
            hasMore={grid.hasMore}
            loadingMore={grid.loadingMore}
            refreshing={grid.loading}
            onRefresh={refreshAll}
            sort={sort}
            onSortChange={setSort}
            footer={gridFooter}
            theme={theme}
          />
        </>
      ) : (
        <>
          <View style={styles.toolbar}>
            <View style={[styles.infoChip, { borderColor: theme.borderStrong, backgroundColor: theme.surface }]}>
              <Icon name="columns" size={15} color={theme.textSecondary} />
              <Text style={[t(13, 'bold'), { color: theme.text }]} numberOfLines={1}>Kolumny: {settings.statusField}</Text>
            </View>
            <View style={styles.flex} />
            <Segmented
              compact
              options={[
                { key: 'horizontal', icon: 'columns', a11y: 'Układ: kolumny w bok' },
                { key: 'vertical', icon: 'align-justify', a11y: 'Układ: kolumny z góry na dół' },
              ]}
              value={layout}
              onChange={changeLayout}
              theme={theme}
            />
          </View>
          {kanban.loading && !kanban.records.length ? (
            <View style={styles.center}><ActivityIndicator size="large" color={theme.accent} /></View>
          ) : (
            <KanbanBoard
              layout={layout}
              columns={meta.statusOptions}
              records={kanban.records}
              statusField={settings.statusField}
              titleField={titleField}
              fields={fields}
              descriptionField={settings.descriptionField}
              descriptionMaxChars={settings.descriptionMaxChars}
              onCardPress={setSelected}
              onCardLongPress={setMoving}
              onAdd={(status) => setForm({ mode: 'create', record: null, preset: { [settings.statusField]: status } })}
              refreshing={kanban.loading}
              onRefresh={refreshAll}
              theme={theme}
            />
          )}
        </>
      )}

      {viewMode === 'grid' ? (
        <TouchableOpacity
          onPress={() => setForm({ mode: 'create', record: null })}
          style={[styles.fabWide, { bottom: insets.bottom + 20, backgroundColor: theme.accent, shadowColor: theme.accent }]}
          accessibilityRole="button"
          activeOpacity={0.85}
        >
          <Icon name="plus" size={20} color={theme.accentText} />
          <Text style={[t(15, 'extrabold'), { color: theme.accentText }]}>Nowy rekord</Text>
        </TouchableOpacity>
      ) : (
        <TouchableOpacity
          onPress={() => setForm({ mode: 'create', record: null })}
          style={[styles.fab, { bottom: insets.bottom + 64, backgroundColor: theme.accent, shadowColor: theme.accent }]}
          accessibilityRole="button"
          accessibilityLabel="Nowy rekord"
          activeOpacity={0.85}
        >
          <Icon name="plus" size={24} color={theme.accentText} />
        </TouchableOpacity>
      )}

      <RecordDetailModal
        record={selected}
        fields={fields}
        titleField={titleField}
        statusField={settings.statusField}
        backLabel={tableName}
        baseId={baseId}
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
        preset={form?.preset}
        fields={fields}
        baseId={baseId}
        tableId={tableId}
        onClose={() => setForm(null)}
        onSaved={handleSaved}
        theme={theme}
      />
      <MoveSheet
        visible={!!moving}
        title={moving ? recordTitle(moving, titleField) : ''}
        columns={statusColumns}
        current={moving ? (moving.fields?.[settings.statusField] ?? NO_STATUS) : null}
        moving={movingTo}
        onMove={handleMove}
        onClose={() => setMoving(null)}
        theme={theme}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, padding: 24 },
  centerText: { textAlign: 'center' },
  segmentWrap: { paddingHorizontal: 16, paddingTop: 8 },
  searchWrap: { paddingHorizontal: 16, paddingTop: 12 },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 16, paddingTop: 10, paddingBottom: 12, minHeight: 58 },
  infoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 999, borderWidth: 1, flexShrink: 1 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: 10, padding: 12, borderRadius: 12 },
  gridFooter: { textAlign: 'center', paddingVertical: 16, paddingHorizontal: 16 },
  fabWide: {
    position: 'absolute', right: 16, height: 52, paddingLeft: 16, paddingRight: 20, borderRadius: 16,
    flexDirection: 'row', alignItems: 'center', gap: 8,
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
  fab: {
    position: 'absolute', right: 16, width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.35, shadowRadius: 12, elevation: 6,
  },
});
