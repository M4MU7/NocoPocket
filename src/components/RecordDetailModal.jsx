import React, { memo, useState, useEffect } from 'react';
import {
  Modal, View, Text, ScrollView, ActivityIndicator, TouchableOpacity, StyleSheet, Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { fetchRecord, fetchTableMetaCached } from '../services/nocodbApi';
import {
  formatValue, recordTitle, choiceColor, getContrastColor,
  isLinkField, linkedRecordsOf, linkedLabel, visibleFields, titleFieldName,
} from '../utils/fieldTypes';
import {
  Icon, IconButton, TopBar, SectionLabel, Card, PrimaryButton, Pill, Avatar,
} from './ui';
import { t } from '../theme/typography';

const FACT_TYPES = ['Date', 'DateTime', 'Number', 'Decimal', 'Currency', 'Percent', 'Rating', 'Checkbox', 'Year', 'Time', 'Duration', 'SingleSelect'];
const SYSTEM_TYPES = ['CreatedTime', 'LastModifiedTime', 'CreatedBy', 'LastModifiedBy', 'AutoNumber'];

function choicePills(field, value, size = 13) {
  const titles = Array.isArray(value) ? value : String(value).split(',').map((s) => s.trim()).filter(Boolean);
  return titles.map((title) => {
    const bg = choiceColor(field, title) ?? '#E7E9F2';
    return <Pill key={`${field.id}-${title}`} label={title} bg={bg} fg={getContrastColor(bg)} size={size} />;
  });
}

function FactTile({ field, value, theme }) {
  let content;
  if (field.type === 'Rating') {
    const n = Math.max(0, Math.min(5, Math.round(Number(value) || 0)));
    content = (
      <Text style={[t(17, 'medium'), styles.stars]} accessibilityLabel={`${n} z 5`}>
        <Text style={{ color: theme.star }}>{'★'.repeat(n)}</Text>
        <Text style={{ color: theme.starOff }}>{'★'.repeat(5 - n)}</Text>
      </Text>
    );
  } else if (field.type === 'Percent' && value !== null && value !== undefined && value !== '') {
    const p = Math.max(0, Math.min(100, Number(value) || 0));
    content = (
      <View style={styles.progressRow}>
        <Text style={[t(16, 'extrabold'), { color: theme.text }]}>{formatValue(field, value)}</Text>
        <View style={[styles.progress, { backgroundColor: theme.segment }]}>
          <View style={[styles.progressFill, { width: `${p}%`, backgroundColor: theme.accent }]} />
        </View>
      </View>
    );
  } else if (field.type === 'Checkbox') {
    content = (
      <View style={styles.inline}>
        <Icon name={value ? 'check-circle' : 'circle'} size={18} color={value ? theme.successIcon : theme.textFaint} />
        <Text style={[t(16, 'extrabold'), { color: theme.text }]}>{value ? 'Tak' : 'Nie'}</Text>
      </View>
    );
  } else if (field.type === 'SingleSelect' && value) {
    content = <View style={styles.pills}>{choicePills(field, value)}</View>;
  } else {
    content = <Text style={[t(16, 'extrabold'), { color: theme.text, fontVariant: ['tabular-nums'] }]} numberOfLines={2}>{formatValue(field, value) || '—'}</Text>;
  }
  return (
    <View style={[styles.tile, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text style={[t(12, 'bold'), { color: theme.textMuted }]} numberOfLines={1}>{field.title}</Text>
      {content}
    </View>
  );
}

function FieldBlock({ field, value, theme }) {
  let body;
  if ((field.type === 'MultiSelect' || field.type === 'SingleSelect') && value) {
    body = <View style={styles.pills}>{choicePills(field, value)}</View>;
  } else {
    const text = field.type === 'JSON' && value && typeof value === 'object' ? JSON.stringify(value, null, 2) : formatValue(field, value);
    body = <Text style={[t(15, 'medium'), { color: text ? theme.text : theme.textFaint, lineHeight: 22 }]} selectable>{text || '—'}</Text>;
  }
  return (
    <View style={styles.block}>
      <SectionLabel theme={theme}>{field.title}</SectionLabel>
      {body}
    </View>
  );
}

function LinkSection({ field, value, onOpen, theme }) {
  const linked = linkedRecordsOf(value);
  const count = typeof value === 'number' ? value : linked.length;
  return (
    <View style={styles.block}>
      <SectionLabel theme={theme}>{field.title} · {count}</SectionLabel>
      {linked.length ? (
        <Card theme={theme}>
          {linked.map((r, i) => {
            const label = linkedLabel(r);
            return (
              <TouchableOpacity
                key={String(r.id)}
                onPress={() => onOpen(field, r)}
                style={[styles.linkRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.borderLight }]}
                accessibilityRole="button"
                accessibilityLabel={`Otwórz ${label}`}
              >
                <Avatar text={label} size={32} />
                <Text style={[t(15, 'bold'), styles.flex, { color: theme.text }]} numberOfLines={1}>{label}</Text>
                <Icon name="chevron-right" size={18} color={theme.textFaint} />
              </TouchableOpacity>
            );
          })}
        </Card>
      ) : (
        <Text style={[t(14, 'medium'), { color: theme.textFaint }]}>Brak powiązań</Text>
      )}
    </View>
  );
}

/** Treść rekordu. Bez onEdit/onDelete – tryb tylko do odczytu (rekord z tabeli powiązanej). */
function DetailContent({ record, fields, titleField, statusField, backLabel, baseId, onClose, onEdit, onDelete, theme }) {
  const insets = useSafeAreaInsets();
  const [deleting, setDeleting] = useState(false);
  const [openLink, setOpenLink] = useState(null); // { field, record, label }

  const title = recordTitle(record, titleField);
  const v = (f) => record.fields?.[f.title];

  const statusF = fields.find((f) => f.title === statusField && f.type === 'SingleSelect');
  const tagsF = fields.find((f) => f.type === 'MultiSelect');
  const used = new Set([titleField, statusF?.title, tagsF?.title].filter(Boolean));
  const facts = fields.filter((f) => !used.has(f.title) && FACT_TYPES.includes(f.type)).slice(0, 4);
  facts.forEach((f) => used.add(f.title));
  const links = fields.filter((f) => isLinkField(f));
  const system = fields.filter((f) => SYSTEM_TYPES.includes(f.type) && v(f));
  const rest = fields.filter((f) => !used.has(f.title) && !isLinkField(f) && !SYSTEM_TYPES.includes(f.type));
  const created = system.find((f) => f.type === 'CreatedTime');

  const confirmDelete = () => {
    Alert.alert('Usuń rekord', `Czy na pewno usunąć „${title}”?\nTej operacji nie można cofnąć.`, [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń',
        style: 'destructive',
        onPress: async () => {
          setDeleting(true);
          try { await onDelete(record); } catch (e) { Alert.alert('Nie udało się usunąć', e.message); } finally { setDeleting(false); }
        },
      },
    ]);
  };

  const openMore = () => Alert.alert(title, undefined, [
    { text: 'Usuń rekord', style: 'destructive', onPress: confirmDelete },
    { text: 'Anuluj', style: 'cancel' },
  ]);

  const hasPills = (statusF && v(statusF)) || (tagsF && v(tagsF));

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <TopBar onBack={onClose} backLabel={backLabel} theme={theme} />
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.titleBlock}>
          <Text style={[t(26, 'extrabold'), { color: theme.text, lineHeight: 32, letterSpacing: -0.5 }]} selectable>{title}</Text>
          {hasPills ? (
            <View style={styles.pills}>
              {statusF && v(statusF) ? choicePills(statusF, v(statusF)) : null}
              {tagsF && v(tagsF) ? choicePills(tagsF, v(tagsF)) : null}
            </View>
          ) : null}
        </View>

        {facts.length ? (
          <View style={styles.facts}>
            {facts.map((f) => <FactTile key={f.id} field={f} value={v(f)} theme={theme} />)}
          </View>
        ) : null}

        {rest.map((f) => <FieldBlock key={f.id} field={f} value={v(f)} theme={theme} />)}

        {links.map((f) => (
          <LinkSection
            key={f.id}
            field={f}
            value={v(f)}
            onOpen={(field, r) => setOpenLink({ field, record: r, label: linkedLabel(r) })}
            theme={theme}
          />
        ))}

        <Text style={[t(12, 'medium'), { color: theme.textMuted }]}>
          {created ? `Utworzono ${formatValue(created, v(created))} · ` : ''}ID rekordu {String(record.id)}
        </Text>
      </ScrollView>

      {onEdit ? (
        <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 12, backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <IconButton icon="more-horizontal" label="Więcej akcji" onPress={openMore} theme={theme} variant="bordered" style={styles.moreBtn} disabled={deleting} />
          {deleting
            ? <View style={styles.deleting}><ActivityIndicator color={theme.error} /><Text style={[t(14, 'bold'), { color: theme.error }]}>Usuwanie…</Text></View>
            : <PrimaryButton label="Edytuj" icon="edit-2" onPress={() => onEdit(record)} theme={theme} style={styles.flex} />}
        </View>
      ) : null}

      <LinkedRecordModal baseId={baseId} link={openLink} onClose={() => setOpenLink(null)} theme={theme} />
    </View>
  );
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
    <Modal visible animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      {table && record ? (
        <DetailContent
          record={record}
          fields={visibleFields(table)}
          titleField={titleFieldName(table, null)}
          statusField={settings.statusField}
          backLabel="Wróć"
          baseId={baseId}
          onClose={onClose}
          theme={theme}
        />
      ) : (
        <View style={[styles.flex, { backgroundColor: theme.bg }]}>
          <TopBar onBack={onClose} backLabel="Wróć" theme={theme} />
          <View style={styles.center}>
            {loading
              ? <ActivityIndicator size="large" color={theme.accent} />
              : <Text style={[t(14, 'semibold'), styles.centerText, { color: theme.error }]}>{error}</Text>}
          </View>
        </View>
      )}
    </Modal>
  );
}

function RecordDetailModal({ record, fields, titleField, statusField, backLabel, baseId, visible, onClose, onEdit, onDelete, theme }) {
  if (!record) return null;
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <DetailContent
        record={record}
        fields={fields}
        titleField={titleField}
        statusField={statusField}
        backLabel={backLabel}
        baseId={baseId}
        onClose={onClose}
        onEdit={onEdit}
        onDelete={onDelete}
        theme={theme}
      />
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  centerText: { textAlign: 'center' },
  content: { paddingHorizontal: 20, paddingTop: 6, paddingBottom: 32, gap: 20 },
  titleBlock: { gap: 12 },
  pills: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: { flexGrow: 1, flexBasis: '45%', gap: 4, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  stars: { letterSpacing: 2 },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  progress: { flex: 1, height: 6, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: 6, borderRadius: 3 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  block: { gap: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingHorizontal: 14 },
  bottomBar: { flexDirection: 'row', gap: 10, paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1 },
  moreBtn: { width: 52, height: 52, borderRadius: 16 },
  deleting: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
});

export default memo(RecordDetailModal);
