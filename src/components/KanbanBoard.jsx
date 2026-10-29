import React, { memo, useMemo, useState } from 'react';
import {
  View, Text, ScrollView, FlatList, TouchableOpacity, RefreshControl, StyleSheet, useWindowDimensions,
} from 'react-native';
import {
  formatValue, recordTitle, isLinkField, linkedRecordsOf, linkedLabel, getContrastColor,
} from '../utils/fieldTypes';
import { Icon } from './ui';
import { t } from '../theme/typography';

export const NO_STATUS = 'Brak statusu';
const GAP = 12;

/** Które pola pokazać na karcie: pierwsza data, pierwsza ocena, pierwsze powiązanie */
function useCardFields(fields, statusField) {
  return useMemo(() => ({
    due: fields.find((f) => (f.type === 'Date' || f.type === 'DateTime') && f.title !== statusField),
    rating: fields.find((f) => f.type === 'Rating'),
    link: fields.find(isLinkField),
  }), [fields, statusField]);
}

function Stars({ value, theme }) {
  const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
  if (!n) return null;
  return (
    <Text style={[t(13, 'medium'), styles.stars]} accessibilityLabel={`Priorytet ${n} z 5`}>
      <Text style={{ color: theme.star }}>{'★'.repeat(n)}</Text>
      <Text style={{ color: theme.starOff }}>{'★'.repeat(5 - n)}</Text>
    </Text>
  );
}

function Card({ record, compact, cardFields, titleField, description, onPress, onLongPress, theme }) {
  const due = cardFields.due ? formatValue(cardFields.due, record.fields?.[cardFields.due.title]) : '';
  const rating = cardFields.rating ? record.fields?.[cardFields.rating.title] : null;
  const linked = cardFields.link ? linkedRecordsOf(record.fields?.[cardFields.link.title]) : [];
  const linkText = linked.length ? linkedLabel(linked[0]) + (linked.length > 1 ? ` +${linked.length - 1}` : '') : '';

  return (
    <TouchableOpacity
      onPress={() => onPress(record)}
      onLongPress={() => onLongPress(record)}
      delayLongPress={350}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityHint="Przytrzymaj, aby przenieść do innej kolumny"
      style={[compact ? styles.cardCompact : styles.card, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
    >
      <Text style={[t(15, 'bold'), { color: theme.text, lineHeight: 20 }]} numberOfLines={compact ? 2 : 3}>{recordTitle(record, titleField)}</Text>

      {compact ? (
        (due || rating || linkText) ? (
          <View style={styles.metaRow}>
            {due ? <Text style={[t(13, 'medium'), { color: theme.textSecondary, fontVariant: ['tabular-nums'] }]}>{due.slice(0, 16)}</Text> : null}
            <Stars value={rating} theme={theme} />
            <Text style={[t(13, 'bold'), styles.compactLink, { color: theme.accent }]} numberOfLines={1}>{linkText}</Text>
          </View>
        ) : null
      ) : (
        <>
          {description ? <Text style={[t(13, 'medium'), { color: theme.textSecondary, lineHeight: 18 }]} numberOfLines={2}>{description}</Text> : null}
          {(due || rating) ? (
            <View style={styles.metaRow}>
              {due ? (
                <View style={styles.inline}>
                  <Icon name="calendar" size={14} color={theme.textSecondary} />
                  <Text style={[t(13, 'medium'), { color: theme.textSecondary, fontVariant: ['tabular-nums'] }]}>{due.slice(0, 16)}</Text>
                </View>
              ) : null}
              <Stars value={rating} theme={theme} />
            </View>
          ) : null}
          {linkText ? (
            <View style={[styles.linkChip, { backgroundColor: theme.surfaceAlt }]}>
              <Icon name="link" size={12} color={theme.accent} />
              <Text style={[t(12, 'bold'), styles.shrink, { color: theme.accent }]} numberOfLines={1}>{linkText}</Text>
            </View>
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
}

function ColumnHeader({ col, count, onAdd, onToggle, expanded, theme }) {
  const bg = col.color ?? theme.sunken;
  const pill = (
    <>
      {onToggle ? <Icon name={expanded ? 'chevron-down' : 'chevron-right'} size={18} color={theme.textSecondary} /> : null}
      <View style={[styles.statusPill, { backgroundColor: bg }]}>
        <Text style={[t(13, 'extrabold'), { color: getContrastColor(bg) }]} numberOfLines={1}>{col.title}</Text>
      </View>
      <Text style={[t(13, 'bold'), { color: theme.textSecondary }]}>{count}</Text>
    </>
  );
  return (
    <View style={styles.colHeader}>
      {onToggle ? (
        <TouchableOpacity
          onPress={onToggle}
          style={[styles.colHeaderMain, styles.colHeaderToggle]}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={`Kolumna ${col.title}, ${count}. ${expanded ? 'Zwiń' : 'Rozwiń'}`}
        >
          {pill}
        </TouchableOpacity>
      ) : <View style={styles.colHeaderMain}>{pill}</View>}
      {onAdd ? (
        <TouchableOpacity onPress={() => onAdd(col.title)} style={[styles.addBtn, { backgroundColor: theme.surface }]} accessibilityRole="button" accessibilityLabel={`Dodaj rekord w kolumnie ${col.title}`}>
          <Icon name="plus" size={18} color={theme.accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

/**
 * Kanban w dwóch układach:
 *  • 'horizontal' – kolumny w bok, przewijane z przyciąganiem, następna kolumna widoczna z brzegu
 *  • 'vertical'   – kolumny z góry na dół, zwijane dotknięciem nagłówka, gęstsze karty
 */
function KanbanBoard({
  layout, columns, records, statusField, titleField, fields, descriptionField, descriptionMaxChars,
  onCardPress, onCardLongPress, onAdd, refreshing, onRefresh, theme,
}) {
  const { width } = useWindowDimensions();
  const colWidth = Math.min(320, width - 72);
  const [page, setPage] = useState(0);
  const [collapsed, setCollapsed] = useState({});
  const cardFields = useCardFields(fields, statusField);
  const maxChars = Number(descriptionMaxChars) || 120;

  const grouped = useMemo(() => {
    const g = Object.fromEntries(columns.map((c) => [c.title, []]));
    records.forEach((r) => {
      const status = r.fields?.[statusField];
      (g[status] ?? (g[NO_STATUS] = g[NO_STATUS] ?? [])).push(r);
    });
    return g;
  }, [columns, records, statusField]);

  const allColumns = grouped[NO_STATUS]?.length && !columns.some((c) => c.title === NO_STATUS)
    ? [...columns, { title: NO_STATUS, color: null }] : columns;

  const descOf = (r) => {
    const v = descriptionField ? r.fields?.[descriptionField] : null;
    if (v === null || v === undefined || v === '') return null;
    const s = typeof v === 'object' ? JSON.stringify(v) : String(v);
    return s.length > maxChars ? `${s.slice(0, maxChars)}…` : s;
  };

  const renderCard = (r, compact) => (
    <Card
      key={String(r.id)}
      record={r}
      compact={compact}
      cardFields={cardFields}
      titleField={titleField}
      description={compact ? null : descOf(r)}
      onPress={onCardPress}
      onLongPress={onCardLongPress}
      theme={theme}
    />
  );

  const refresh = <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />;

  if (layout === 'vertical') {
    return (
      <ScrollView style={styles.flex} contentContainerStyle={styles.verticalContent} refreshControl={refresh}>
        {allColumns.map((col) => {
          const list = grouped[col.title] ?? [];
          const expanded = !collapsed[col.title];
          return (
            <View key={col.title} style={[styles.vColumn, { backgroundColor: theme.sunken }]}>
              <ColumnHeader
                col={col}
                count={list.length}
                expanded={expanded}
                onToggle={() => setCollapsed((c) => ({ ...c, [col.title]: expanded }))}
                onAdd={col.title === NO_STATUS ? null : onAdd}
                theme={theme}
              />
              {expanded && (list.length
                ? <View style={styles.vCards}>{list.map((r) => renderCard(r, true))}</View>
                : <Text style={[t(13, 'medium'), styles.emptyCol, { color: theme.textMuted }]}>Brak rekordów</Text>)}
            </View>
          );
        })}
        <Text style={[t(13, 'medium'), styles.hint, { color: theme.textSecondary }]}>Dotknij nagłówka, aby zwinąć kolumnę · przytrzymaj kartę, aby ją przenieść</Text>
      </ScrollView>
    );
  }

  return (
    <View style={styles.flex}>
      <ScrollView
        horizontal
        style={styles.flex}
        showsHorizontalScrollIndicator={false}
        snapToInterval={colWidth + GAP}
        snapToAlignment="start"
        decelerationRate="fast"
        contentContainerStyle={styles.hContent}
        onScroll={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / (colWidth + GAP)))}
        scrollEventThrottle={64}
      >
        {allColumns.map((col) => {
          const list = grouped[col.title] ?? [];
          return (
            <View key={col.title} style={[styles.hColumn, { width: colWidth, backgroundColor: theme.sunken }]}>
              <ColumnHeader col={col} count={list.length} onAdd={col.title === NO_STATUS ? null : onAdd} theme={theme} />
              <FlatList
                data={list}
                keyExtractor={(r) => String(r.id)}
                renderItem={({ item }) => renderCard(item, false)}
                nestedScrollEnabled
                refreshControl={refresh}
                contentContainerStyle={styles.hCards}
                ListEmptyComponent={<Text style={[t(13, 'medium'), styles.emptyCol, { color: theme.textMuted }]}>Brak rekordów</Text>}
              />
            </View>
          );
        })}
      </ScrollView>
      <View style={styles.pager} accessible accessibilityLabel={`Kolumna ${page + 1} z ${allColumns.length}`}>
        {allColumns.length <= 8 ? allColumns.map((c, i) => (
          <View key={c.title} style={[styles.dot, i === page ? [styles.dotOn, { backgroundColor: theme.accent }] : { backgroundColor: theme.borderStrong }]} />
        )) : <Text style={[t(13, 'bold'), { color: theme.textSecondary }]}>{page + 1} / {allColumns.length}</Text>}
      </View>
      <Text style={[t(13, 'medium'), styles.hint, { color: theme.textSecondary }]}>Przytrzymaj kartę, aby przenieść ją do innej kolumny</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  shrink: { flexShrink: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stars: { letterSpacing: 1 },
  card: { gap: 10, padding: 14, borderRadius: 14, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  cardCompact: { gap: 6, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 12, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 2, elevation: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  compactLink: { flex: 1, textAlign: 'right' },
  linkChip: { flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start', maxWidth: '100%', paddingLeft: 7, paddingRight: 9, paddingVertical: 3, borderRadius: 999 },
  colHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  colHeaderMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4 },
  colHeaderToggle: { height: 44 },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, flexShrink: 1 },
  addBtn: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  hContent: { paddingHorizontal: 16, gap: GAP },
  hColumn: { borderRadius: 18, padding: 10, gap: 10 },
  hCards: { gap: 10, paddingBottom: 90 },
  verticalContent: { paddingHorizontal: 16, paddingBottom: 110, gap: 12 },
  vColumn: { borderRadius: 18, paddingHorizontal: 8, paddingTop: 4, paddingBottom: 8, gap: 6 },
  vCards: { gap: 6 },
  emptyCol: { textAlign: 'center', paddingVertical: 14 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingTop: 10, paddingBottom: 2 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  dotOn: { width: 18 },
  hint: { textAlign: 'center', paddingHorizontal: 24, paddingTop: 4, paddingBottom: 18 },
});

export default memo(KanbanBoard);
