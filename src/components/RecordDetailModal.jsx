import React, { memo, useState } from 'react';
import {
  Modal, View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { formatValue, recordTitle, choiceColor, getContrastColor } from '../utils/fieldTypes';

function FieldValue({ field, value, theme }) {
  if ((field.type === 'SingleSelect' || field.type === 'MultiSelect') && value) {
    const titles = Array.isArray(value) ? value : String(value).split(',');
    return (
      <View style={styles.pills}>
        {titles.map((t) => {
          const bg = choiceColor(field, t) ?? theme.border;
          return (
            <View key={t} style={[styles.pill, { backgroundColor: bg }]}>
              <Text style={[styles.pillText, { color: getContrastColor(bg) }]}>{t}</Text>
            </View>
          );
        })}
      </View>
    );
  }
  const text = field.type === 'Checkbox' ? (value ? '✓ Tak' : '✗ Nie')
    : field.type === 'JSON' && value && typeof value === 'object' ? JSON.stringify(value, null, 2)
    : formatValue(field, value);
  return <Text style={[styles.fieldValue, { color: theme.text }]} selectable>{text || '—'}</Text>;
}

function RecordDetailModal({ record, fields, titleField, visible, onClose, onEdit, onDelete, theme }) {
  const [deleting, setDeleting] = useState(false);
  if (!record) return null;

  const title = recordTitle(record, titleField);

  const confirmDelete = () => {
    Alert.alert(
      'Usuń rekord',
      `Czy na pewno usunąć „${title}”?
Tej operacji nie można cofnąć.`,
      [
        { text: 'Anuluj', style: 'cancel' },
        {
          text: 'Usuń',
          style: 'destructive',
          onPress: async () => {
            setDeleting(true);
            try { await onDelete(record); }
            catch (e) { Alert.alert('Nie udało się usunąć', e.message); }
            finally { setDeleting(false); }
          },
        },
      ],
    );
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.surface }]}>
        <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
          <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
          <TouchableOpacity onPress={() => onEdit(record)} style={[styles.editBtn, { backgroundColor: theme.accent }]}>
            <Text style={[styles.editBtnText, { color: theme.accentText }]}>✎ Edytuj</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.surfaceAlt }]}>
            <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>✕</Text>
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {fields.map((f) => (
            <View key={f.id} style={[styles.field, { borderBottomColor: theme.borderLight }]}>
              <Text style={[styles.fieldKey, { color: theme.textMuted }]}>{f.title}</Text>
              <FieldValue field={f} value={record.fields?.[f.title]} theme={theme} />
            </View>
          ))}
          <TouchableOpacity
            onPress={confirmDelete}
            disabled={deleting}
            style={[styles.deleteBtn, { backgroundColor: theme.danger, borderColor: theme.dangerBorder, opacity: deleting ? 0.6 : 1 }]}
            activeOpacity={0.8}
          >
            {deleting
              ? <ActivityIndicator size="small" color={theme.dangerText} />
              : <Text style={[styles.deleteBtnText, { color: theme.dangerText }]}>🗑 Usuń rekord</Text>}
          </TouchableOpacity>
          <Text style={[styles.idText, { color: theme.textMuted }]}>ID rekordu: {String(record.id)}</Text>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, gap: 10 },
  modalTitle: { fontSize: 18, fontWeight: '700', flex: 1 },
  editBtn: { borderRadius: 16, paddingHorizontal: 14, height: 32, justifyContent: 'center' },
  editBtnText: { fontSize: 14, fontWeight: '700' },
  closeBtn: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  closeBtnText: { fontSize: 14, fontWeight: '600' },
  content: { padding: 20, gap: 16 },
  field: { borderBottomWidth: 1, paddingBottom: 12 },
  fieldKey: { fontSize: 11, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  fieldValue: { fontSize: 14, lineHeight: 20 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  pill: { borderRadius: 12, paddingHorizontal: 10, paddingVertical: 3 },
  pillText: { fontSize: 13, fontWeight: '600' },
  deleteBtn: { marginTop: 12, borderRadius: 12, borderWidth: 1, paddingVertical: 13, alignItems: 'center' },
  deleteBtnText: { fontSize: 14, fontWeight: '700' },
  idText: { fontSize: 11, textAlign: 'center', marginTop: 4 },
});

export default memo(RecordDetailModal);
