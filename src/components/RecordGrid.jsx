import React, { memo, useCallback } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity,
  ActivityIndicator, RefreshControl, StyleSheet,
} from 'react-native';
import { formatValue, choiceColor, getContrastColor, isSortable } from '../utils/fieldTypes';

const INDEX_WIDTH = 44;

const COLUMN_WIDTHS = {
  Checkbox: 80, Rating: 100, Number: 100, Decimal: 110, Currency: 120, Percent: 90,
  Year: 80, Date: 110, DateTime: 150, Time: 80, Duration: 100, LongText: 240,
  SingleSelect: 140, MultiSelect: 200, Email: 200, URL: 200, JSON: 200,
};
const columnWidth = (field) => COLUMN_WIDTHS[field.type] ?? 170;

function Cell({ field, value, theme }) {
  const width = columnWidth(field);

  if ((field.type === 'SingleSelect' || field.type === 'MultiSelect') && value) {
    const titles = Array.isArray(value) ? value : String(value).split(',');
    return (
      <View style={[styles.cell, styles.pillCell, { width, borderRightColor: theme.border }]}>
        {titles.slice(0, 3).map((t) => {
          const bg = choiceColor(field, t) ?? theme.border;
          return (
            <View key={t} style={[styles.pill, { backgroundColor: bg }]}>
              <Text style={[styles.pillText, { color: getContrastColor(bg) }]} numberOfLines={1}>{t}</Text>
            </View>
          );
        })}
      </View>
    );
  }

  const isNumeric = ['Number', 'Decimal', 'Currency', 'Percent', 'Year', 'Duration'].includes(field.type);
  return (
    <View style={[styles.cell, { width, borderRightColor: theme.border }]}>
      <Text
        style={[
          styles.cellText,
          { color: theme.text, textAlign: isNumeric ? 'right' : field.type === 'Checkbox' ? 'center' : 'left' },
          field.type === 'Rating' && { color: '#f6ad55' },
        ]}
        numberOfLines={1}
      >
        {formatValue(field, value)}
      </Text>
    </View>
  );
}

const Row = memo(function Row({ record, index, fields, onPress, theme }) {
  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: index % 2 ? theme.surfaceAlt : theme.surface, borderBottomColor: theme.border }]}
      onPress={() => onPress(record)}
      activeOpacity={0.6}
    >
      <View style={[styles.cell, styles.indexCell, { borderRightColor: theme.border }]}>
        <Text style={[styles.indexText, { color: theme.textMuted }]}>{index + 1}</Text>
      </View>
      {fields.map((f) => (
        <Cell key={f.id} field={f} value={record.fields?.[f.title]} theme={theme} />
      ))}
    </TouchableOpacity>
  );
});

/**
 * Widok tabeli: przewijany w poziomie, nagłówek stoi w miejscu przy przewijaniu w pionie.
 * Kliknięcie nagłówka zmienia sortowanie: brak → rosnąco → malejąco → brak.
 */
function RecordGrid({
  fields, records, onRowPress, onEndReached, hasMore, loadingMore,
  refreshing, onRefresh, sort, onSortChange, theme,
}) {
  const totalWidth = INDEX_WIDTH + fields.reduce((sum, f) => sum + columnWidth(f), 0);

  const toggleSort = useCallback((field) => {
    if (sort?.field !== field.title) onSortChange({ field: field.title, direction: 'asc' });
    else if (sort.direction === 'asc') onSortChange({ field: field.title, direction: 'desc' });
    else onSortChange(null);
  }, [sort, onSortChange]);

  const renderItem = useCallback(({ item, index }) => (
    <Row record={item} index={index} fields={fields} onPress={onRowPress} theme={theme} />
  ), [fields, onRowPress, theme]);

  return (
    <ScrollView horizontal bounces={false} style={styles.flex}>
      <View style={{ width: totalWidth, flex: 1 }}>
        <View style={[styles.row, styles.headerRow, { backgroundColor: theme.surfaceAlt, borderBottomColor: theme.border }]}>
          <View style={[styles.cell, styles.indexCell, { borderRightColor: theme.border }]}>
            <Text style={[styles.headerText, { color: theme.textMuted }]}>#</Text>
          </View>
          {fields.map((f) => {
            const active = sort?.field === f.title;
            return (
              <TouchableOpacity
                key={f.id}
                style={[styles.cell, { width: columnWidth(f), borderRightColor: theme.border }]}
                onPress={() => toggleSort(f)}
                disabled={!isSortable(f)}
                activeOpacity={0.6}
              >
                <Text style={[styles.headerText, { color: active ? theme.accent : theme.textSecondary }]} numberOfLines={1}>
                  {f.title}{active ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ''}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <FlatList
          data={records}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          onEndReached={hasMore ? onEndReached : undefined}
          onEndReachedThreshold={0.5}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: theme.textMuted }]}>Brak rekordów.</Text>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={styles.footer} color={theme.accent} />
              : hasMore ? (
                <TouchableOpacity style={styles.footer} onPress={onEndReached}>
                  <Text style={[styles.moreText, { color: theme.accent }]}>Załaduj więcej…</Text>
                </TouchableOpacity>
              ) : null
          }
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, minHeight: 44 },
  headerRow: { minHeight: 40 },
  cell: {
    paddingHorizontal: 10, paddingVertical: 10, justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  indexCell: { width: INDEX_WIDTH, alignItems: 'center', paddingHorizontal: 4 },
  indexText: { fontSize: 12 },
  headerText: { fontSize: 12, fontWeight: '700' },
  cellText: { fontSize: 14 },
  pillCell: { flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden', justifyContent: 'flex-start' },
  pill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, maxWidth: 120 },
  pillText: { fontSize: 12, fontWeight: '600' },
  listContent: { paddingBottom: 96 },
  empty: { padding: 24, fontSize: 14 },
  footer: { padding: 16, alignItems: 'flex-start' },
  moreText: { fontSize: 14, fontWeight: '600' },
});

export default memo(RecordGrid);
