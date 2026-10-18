import React, { memo } from 'react';
import { Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { recordTitle } from '../utils/fieldTypes';

function KanbanCard({ record, titleField, onPress, theme }) {
  const { settings } = useSettings();
  const { descriptionField, descriptionMaxChars } = settings;

  const title = recordTitle(record, titleField);
  const rawValue = descriptionField ? record.fields?.[descriptionField] : null;
  const rawDesc = rawValue === null || rawValue === undefined ? null : String(rawValue);
  const maxChars = Number(descriptionMaxChars) || 120;
  const description = rawDesc && rawDesc.length > maxChars
    ? rawDesc.slice(0, maxChars) + '…' : rawDesc;

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: theme.surface, shadowColor: theme.shadow }]}
      onPress={() => onPress(record)}
      activeOpacity={0.75}
    >
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={2}>{title}</Text>
      {description ? <Text style={[styles.desc, { color: theme.textSecondary }]}>{description}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 10, padding: 12, marginVertical: 5, marginHorizontal: 12,
    shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
  },
  title: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  desc: { fontSize: 12, lineHeight: 18 },
});

export default memo(KanbanCard);
