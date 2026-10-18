import React, { useState, memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import KanbanCard from './KanbanCard';
import { getContrastColor } from '../utils/fieldTypes';

function KanbanColumn({ column, records, titleField, onCardPress, theme }) {
  const [collapsed, setCollapsed] = useState(false);

  const bgColor = column.color ?? '#e2e8f0';
  const textColor = getContrastColor(bgColor);

  return (
    <View style={[styles.column, { backgroundColor: theme.surfaceAlt, borderColor: theme.border }]}>
      <TouchableOpacity
        style={[styles.header, { backgroundColor: bgColor }]}
        onPress={() => setCollapsed((v) => !v)}
        activeOpacity={0.8}
      >
        <View style={styles.headerLeft}>
          <Text style={[styles.headerTitle, { color: textColor }]}>{column.title}</Text>
          <View style={[styles.badge, { backgroundColor: 'rgba(0,0,0,0.15)' }]}>
            <Text style={[styles.badgeText, { color: textColor }]}>{records.length}</Text>
          </View>
        </View>
        <Text style={[styles.chevron, { color: textColor }]}>{collapsed ? '›' : '⌄'}</Text>
      </TouchableOpacity>

      {!collapsed && (
        <View style={styles.cardsContainer}>
          {records.length === 0
            ? <Text style={[styles.emptyText, { color: theme.textMuted }]}>Brak zadań</Text>
            : records.map((record) => (
              <KanbanCard
                key={String(record.id)}
                record={record}
                titleField={titleField}
                onPress={onCardPress}
                theme={theme}
              />
            ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { marginBottom: 12, borderRadius: 12, overflow: 'hidden', borderWidth: 1 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12 },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerTitle: { fontSize: 15, fontWeight: '700' },
  badge: { borderRadius: 12, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 12, fontWeight: '600' },
  chevron: { fontSize: 18 },
  cardsContainer: { paddingVertical: 8 },
  emptyText: { textAlign: 'center', fontSize: 13, paddingVertical: 12 },
});

export default memo(KanbanColumn);
