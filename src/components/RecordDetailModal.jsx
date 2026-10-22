import React, { memo, useState, useEffect } from 'react';
import {
  Modal, View, Text, ScrollView, ActivityIndicator,
  TouchableOpacity, StyleSheet, SafeAreaView, Alert,
} from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { fetchRecord, fetchTableMetaCached } from '../services/nocodbApi';
import {
  formatValue, recordTitle, choiceColor, getContrastColor,
  isLinkField, linkedRecordsOf, visibleFields, titleFieldName,
} from '../utils/fieldTypes';
import { LinkChips } from './LinkFields';

function FieldValue({ field, value, onOpenLink, theme }) {
  if (isLinkField(field) && typeof value !== 'number') {
    return <LinkChips records={linkedRecordsOf(value)} onPress={(r) => onOpenLink(field, r)} theme={theme} />;
  }
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

/** Podgląd rekordu z tabeli powiązanej (tylko do odczytu) */
function LinkedRecordModal({ baseId, link, onClose, theme }) {
  const { settings } = useSettings();
  const [state, setState] = useState({ loading: true });
  const relatedId = link?.field.options?.related_table_id;

  useEffect(() => {
    if (!link) return undefined;
    let cancelled = false;
    setState({ loading: true });
    Promise.all([
      fetchTableMetaCached(settings, baseId, relatedId),
      fetchRecord(settings, baseId, relatedId, link.record.id),
    ])
      .then(([table, record]) => { if (!cancelled) setState({ table, record }); })
      .catch((e) => { if (!cancelled) setState({ error: e.message }); });
    return () => { cancelled = true; };
  }, [link, settings, baseId, relatedId]);

  if (!link) return null;
  const { table, record, loading, error } = state;

  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.surface }]}>
        {table && record ? (
          <DetailContent
            record={record}
            fields={visibleFields(table)}
            titleField={titleFieldName(table, null)}
            subtitle={`Powiązany rekord · ${table.title}`}
            baseId={baseId}
            onClose={onClose}
            theme={theme}
          />
        ) : (
          <>
            <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
              <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={1}>{link.label}</Text>
              <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.surfaceAlt }]}>
                <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>✕</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.center}>
              {loading
                ? <ActivityIndicator size="large" color={theme.accent} />
                : <Text style={[styles.errorText, { color: theme.error }]}>⚠️ {error}</Text>}
            </View>
          </>
        )}
      </SafeAreaView>
    </Modal>
  );
}

/** Nagłówek + lista pól rekordu. Bez onEdit/onDelete – tryb tylko do odczytu. */
function DetailContent({ record, fields, titleField, subtitle, baseId, onClose, onEdit, onDelete, theme }) {
  const [deleting, setDeleting] = useState(false);
  const [openLink, setOpenLink] = useState(null); // { field, record, label }

  const title = recordTitle(record, titleField);

  const confirmDelete = () => {
    Alert.alert(
      'Usuń rekord',
      `Czy na pewno usunąć „${title}”?\nTej operacji nie można cofnąć.`,
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

  const handleOpenLink = (field, linked) => {
    setOpenLink({ field, record: linked, label: formatValue(field, linked) || `#${linked.id}` });
  };

  return (
    <>
      <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
        <View style={styles.titleWrap}>
          <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[styles.subTitle, { color: theme.textMuted }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
        {onEdit && (
          <TouchableOpacity onPress={() => onEdit(record)} style={[styles.editBtn, { backgroundColor: theme.accent }]}>
            <Text style={[styles.editBtnText, { color: theme.accentText }]}>✎ Edytuj</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={onClose} style={[styles.closeBtn, { backgroundColor: theme.surfaceAlt }]}>
          <Text style={[styles.closeBtnText, { color: theme.textSecondary }]}>✕</Text>
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {fields.map((f) => (
          <View key={f.id} style={[styles.field, { borderBottomColor: theme.borderLight }]}>
            <Text style={[styles.fieldKey, { color: theme.textMuted }]}>{f.title}</Text>
            <FieldValue field={f} value={record.fields?.[f.title]} onOpenLink={handleOpenLink} theme={theme} />
          </View>
        ))}
        {onDelete && (
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
        )}
        <Text style={[styles.idText, { color: theme.textMuted }]}>ID rekordu: {String(record.id)}</Text>
      </ScrollView>
      <LinkedRecordModal baseId={baseId} link={openLink} onClose={() => setOpenLink(null)} theme={theme} />
    </>
  );
}

function RecordDetailModal({ record, fields, titleField, baseId, visible, onClose, onEdit, onDelete, theme }) {
  if (!record) return null;
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.surface }]}>
        <DetailContent
          record={record}
          fields={fields}
          titleField={titleField}
          baseId={baseId}
          onClose={onClose}
          onEdit={onEdit}
          onDelete={onDelete}
          theme={theme}
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: 1, gap: 10 },
  titleWrap: { flex: 1 },
  modalTitle: { fontSize: 18, fontWeight: '700', flexShrink: 1 },
  subTitle: { fontSize: 12, marginTop: 2 },
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  errorText: { fontSize: 14, textAlign: 'center' },
});

export default memo(RecordDetailModal);
