import React, { memo, useRef, useCallback } from 'react';
import {
  View, Text, ScrollView, Animated, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet,
} from 'react-native';
import {
  formatValue, choiceColor, getContrastColor, isSortable, isLinkField, linkedRecordsOf, linkedLabel,
} from '../utils/fieldTypes';
import { Icon } from './ui';
import { t } from '../theme/typography';

const FIRST_WIDTH = 156;
const HEADER_HEIGHT = 40;

const COLUMN_WIDTHS = {
  Checkbox: 84, Rating: 104, Number: 100, Decimal: 110, Currency: 124, Percent: 92,
  Year: 80, Date: 104, DateTime: 150, Time: 80, Duration: 100, LongText: 240,
  SingleSelect: 136, MultiSelect: 200, Email: 200, URL: 200, JSON: 200,
  Links: 170, LinkToAnotherRecord: 150,
};
const columnWidth = (field) => COLUMN_WIDTHS[field.type] ?? 170;
const NUMERIC = ['Number', 'Decimal', 'Currency', 'Percent', 'Year', 'Duration'];

function Cell({ field, value, theme }) {
  const width = columnWidth(field);

  if ((field.type === 'SingleSelect' || field.type === 'MultiSelect') && value) {
    const titles = Array.isArray(value) ? value : String(value).split(',');
    return (
      <View style={[styles.cell, styles.pillCell, { width }]}>
        {titles.slice(0, 2).map((title) => {
          const bg = choiceColor(field, title) ?? theme.sunken;
          return (
            <View key={title} style={[styles.pill, { backgroundColor: bg }]}>
              <Text style={[t(12, 'bold'), { color: getContrastColor(bg) }]} numberOfLines={1}>{title}</Text>
            </View>
          );
        })}
        {titles.length > 2 ? <Text style={[t(12, 'bold'), { color: theme.textMuted }]}>+{titles.length - 2}</Text> : null}
      </View>
    );
  }

  if (field.type === 'Rating') {
    const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    return (
      <View style={[styles.cell, { width }]} accessible accessibilityLabel={`Priorytet ${n} z 5`}>
        <Text style={[t(13, 'medium'), styles.stars]}>
          <Text style={{ color: theme.star }}>{'★'.repeat(n)}</Text>
          <Text style={{ color: theme.starOff }}>{'★'.repeat(5 - n)}</Text>
        </Text>
      </View>
    );
  }

  if (field.type === 'Checkbox') {
    return (
      <View style={[styles.cell, styles.centerCell, { width }]}>
        {value ? <Icon name="check" size={18} color={theme.accent} /> : null}
      </View>
    );
  }

  if (isLinkField(field) && typeof value !== 'number') {
    const linked = linkedRecordsOf(value);
    return (
      <View style={[styles.cell, styles.linkCell, { width }]}>
        {linked.length ? <Icon name="link" size={13} color={theme.accent} /> : null}
        <Text style={[t(14, 'semibold'), styles.flexShrink, { color: linked.length ? theme.accent : theme.textFaint }]} numberOfLines={1}>
          {linked.length ? linkedLabel(linked[0]) : '—'}
        </Text>
        {linked.length > 1 ? <Text style={[t(12, 'bold'), { color: theme.textMuted }]}>+{linked.length - 1}</Text> : null}
      </View>
    );
  }

  return (
    <View style={[styles.cell, { width }]}>
      <Text
        style={[t(14, 'medium'), { color: theme.text, textAlign: NUMERIC.includes(field.type) ? 'right' : 'left', fontVariant: ['tabular-nums'] }]}
        numberOfLines={1}
      >
        {formatValue(field, value)}
      </Text>
    </View>
  );
}

function HeaderCell({ field, width, sort, onPress, theme }) {
  const active = sort?.field === field.title;
  const sortable = isSortable(field);
  return (
    <TouchableOpacity
      onPress={() => onPress(field)}
      disabled={!sortable}
      style={[styles.headerCell, { width }]}
      accessibilityRole="button"
      accessibilityLabel={sortable ? `Sortuj według ${field.title}` : field.title}
    >
      <Text style={[t(12, 'extrabold'), styles.flexShrink, { color: active ? theme.accentStrong : theme.textSecondary }]} numberOfLines={1}>{field.title}</Text>
      {active ? <Icon name={sort.direction === 'asc' ? 'arrow-up' : 'arrow-down'} size={13} color={theme.accentStrong} /> : null}
    </TouchableOpacity>
  );
}

/**
 * Tabela rekordów: pierwsza kolumna (pole główne) przypięta przy przewijaniu w bok,
 * nagłówek podąża za przewijaniem poziomym, kolejne strony doczytują się przy końcu listy.
 * Dotknięcie nagłówka: brak sortowania → rosnąco → malejąco → brak.
 */
function RecordGrid({
  fields, records, onRowPress, onEndReached, hasMore, loadingMore,
  refreshing, onRefresh, sort, onSortChange, rowHeight = 56, footer, theme,
}) {
  const scrollX = useRef(new Animated.Value(0)).current;
  const headerShift = useRef(Animated.multiply(scrollX, -1)).current;
  const [first, ...rest] = fields;
  const restWidth = rest.reduce((sum, f) => sum + columnWidth(f), 0);

  const toggleSort = useCallback((field) => {
    if (sort?.field !== field.title) onSortChange({ field: field.title, direction: 'asc' });
    else if (sort.direction === 'asc') onSortChange({ field: field.title, direction: 'desc' });
    else onSortChange(null);
  }, [sort, onSortChange]);

  const handleScroll = ({ nativeEvent: { contentOffset, layoutMeasurement, contentSize } }) => {
    if (hasMore && !loadingMore && contentOffset.y + layoutMeasurement.height >= contentSize.height - 400) onEndReached();
  };

  if (!first) return null;

  return (
    <View style={[styles.flex, { backgroundColor: theme.surface, borderTopColor: theme.border }, styles.topBorder]}>
      <View style={[styles.headerRow, { backgroundColor: theme.surfaceAlt, borderBottomColor: theme.border }]}>
        <View style={[styles.stickyCol, { width: FIRST_WIDTH, backgroundColor: theme.surfaceAlt, borderRightColor: theme.border }]}>
          <HeaderCell field={first} width={FIRST_WIDTH} sort={sort} onPress={toggleSort} theme={theme} />
        </View>
        <View style={styles.headerClip}>
          <Animated.View style={[styles.row, { width: restWidth, transform: [{ translateX: headerShift }] }]}>
            {rest.map((f) => <HeaderCell key={f.id} field={f} width={columnWidth(f)} sort={sort} onPress={toggleSort} theme={theme} />)}
          </Animated.View>
        </View>
      </View>

      <ScrollView
        style={styles.flex}
        onScroll={handleScroll}
        scrollEventThrottle={100}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.accent} colors={[theme.accent]} />}
        contentContainerStyle={styles.bodyContent}
      >
        {records.length === 0 && !refreshing ? (
          <View style={styles.empty}>
            <Icon name="inbox" size={28} color={theme.textFaint} />
            <Text style={[t(14, 'medium'), { color: theme.textMuted }]}>Brak rekordów.</Text>
          </View>
        ) : (
          <View style={styles.row}>
            <View style={[styles.stickyCol, { width: FIRST_WIDTH, backgroundColor: theme.surface, borderRightColor: theme.border }]}>
              {records.map((r) => (
                <TouchableOpacity
                  key={String(r.id)}
                  onPress={() => onRowPress(r)}
                  style={[styles.titleCell, { height: rowHeight, borderBottomColor: theme.borderLight }]}
                  activeOpacity={0.6}
                  accessibilityRole="button"
                >
                  <Text style={[t(14, 'bold'), { color: theme.text, lineHeight: 18 }]} numberOfLines={rowHeight >= 56 ? 2 : 1}>
                    {formatValue(first, r.fields?.[first.title]) || `#${r.id}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
            <Animated.ScrollView
              horizontal
              bounces={false}
              showsHorizontalScrollIndicator={false}
              scrollEventThrottle={16}
              onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], { useNativeDriver: true })}
            >
              <View style={{ width: restWidth }}>
                {records.map((r) => (
                  <TouchableOpacity
                    key={String(r.id)}
                    onPress={() => onRowPress(r)}
                    style={[styles.row, styles.dataRow, { height: rowHeight, borderBottomColor: theme.borderLight }]}
                    activeOpacity={0.6}
                    accessible={false}
                  >
                    {rest.map((f) => <Cell key={f.id} field={f} value={r.fields?.[f.title]} theme={theme} />)}
                  </TouchableOpacity>
                ))}
              </View>
            </Animated.ScrollView>
          </View>
        )}
        {loadingMore ? <ActivityIndicator style={styles.more} color={theme.accent} /> : null}
        {footer}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  flexShrink: { flexShrink: 1 },
  topBorder: { borderTopWidth: 1 },
  row: { flexDirection: 'row' },
  headerRow: { flexDirection: 'row', height: HEADER_HEIGHT, borderBottomWidth: 1 },
  headerClip: { flex: 1, overflow: 'hidden' },
  headerCell: { flexDirection: 'row', alignItems: 'center', gap: 4, height: HEADER_HEIGHT, paddingHorizontal: 12 },
  stickyCol: { borderRightWidth: StyleSheet.hairlineWidth, zIndex: 1, elevation: 2 },
  titleCell: { justifyContent: 'center', paddingLeft: 16, paddingRight: 10, borderBottomWidth: 1 },
  dataRow: { alignItems: 'center', borderBottomWidth: 1 },
  cell: { paddingHorizontal: 12, justifyContent: 'center' },
  centerCell: { alignItems: 'center' },
  pillCell: { flexDirection: 'row', alignItems: 'center', gap: 4, overflow: 'hidden' },
  pill: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, maxWidth: 120 },
  linkCell: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stars: { letterSpacing: 1 },
  bodyContent: { paddingBottom: 140 },
  empty: { alignItems: 'center', gap: 8, paddingVertical: 48 },
  more: { paddingVertical: 16 },
});

export default memo(RecordGrid);
