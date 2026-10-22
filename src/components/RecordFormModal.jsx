import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, TextInput, ScrollView, Switch, TouchableOpacity,
  ActivityIndicator, StyleSheet, SafeAreaView, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSettings } from '../context/SettingsContext';
import {
  createRecord, updateRecord, fetchRecord, fetchLinkedRecords, saveLinkChanges,
} from '../services/nocodbApi';
import {
  isEditable, isLinkField, toFormValue, fromFormValue, formatValue, nowFormValue, getContrastColor,
} from '../utils/fieldTypes';
import { LinkFieldInput } from './LinkFields';

const idsOf = (records) => (records ?? []).map((r) => String(r.id));
const sameIds = (a, b) => idsOf(a).sort().join('|') === idsOf(b).sort().join('|');

const KEYBOARDS = {
  Number: 'number-pad', Year: 'number-pad',
  Decimal: 'decimal-pad', Currency: 'decimal-pad', Percent: 'decimal-pad',
  Email: 'email-address', URL: 'url', PhoneNumber: 'phone-pad',
};

const FORMAT_HINTS = {
  Date: 'RRRR-MM-DD', DateTime: 'RRRR-MM-DD GG:MM', Time: 'GG:MM', JSON: '{ "klucz": "wartość" }',
};

function Chips({ field, value, multi, onChange, theme }) {
  const choices = field.options?.choices ?? [];
  const selected = multi ? value ?? [] : value ? [value] : [];
  const toggle = (title) => {
    if (multi) {
      onChange(selected.includes(title) ? selected.filter((t) => t !== title) : [...selected, title]);
    } else {
      onChange(selected.includes(title) ? null : title);
    }
  };
  if (!choices.length) return <Text style={{ color: theme.textMuted }}>Brak zdefiniowanych opcji.</Text>;
  return (
    <View style={styles.chips}>
      {choices.map((c) => {
        const active = selected.includes(c.title);
        const bg = active ? (c.color ?? theme.accent) : theme.inputBg;
        return (
          <TouchableOpacity
            key={c.id ?? c.title}
            onPress={() => toggle(c.title)}
            style={[styles.chip, { backgroundColor: bg, borderColor: active ? bg : theme.inputBorder }]}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, { color: active ? getContrastColor(bg) : theme.textSecondary }]}>
              {active ? '✓ ' : ''}{c.title}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Stars({ field, value, onChange }) {
  const max = Number(field.options?.max_value) || 5;
  return (
    <View style={styles.stars}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <TouchableOpacity key={n} onPress={() => onChange(n === value ? 0 : n)} hitSlop={6}>
          <Text style={[styles.star, { color: n <= value ? '#f6ad55' : '#cbd5e0' }]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function FieldInput({ field, value, onChange, theme }) {
  switch (field.type) {
    case 'Checkbox':
      return (
        <Switch
          value={!!value}
          onValueChange={onChange}
          trackColor={{ true: theme.switchTrackTrue, false: theme.switchTrackFalse }}
          thumbColor={theme.switchThumb}
          style={styles.switch}
        />
      );
    case 'SingleSelect':
      return <Chips field={field} value={value} onChange={onChange} theme={theme} />;
    case 'MultiSelect':
      return <Chips field={field} value={value} multi onChange={onChange} theme={theme} />;
    case 'Rating':
      return <Stars field={field} value={value} onChange={onChange} />;
    default: {
      const multiline = field.type === 'LongText' || field.type === 'JSON';
      const isDate = field.type === 'Date' || field.type === 'DateTime' || field.type === 'Time';
      const dv = field.default_value;
      const placeholder = dv !== undefined && dv !== null && dv !== '' ? `domyślnie: ${dv}` : FORMAT_HINTS[field.type] ?? '';
      return (
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.input,
              multiline && styles.multiline,
              field.type === 'JSON' && styles.mono,
              { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.inputText },
            ]}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={theme.inputPlaceholder}
            keyboardType={KEYBOARDS[field.type] ?? 'default'}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            autoCapitalize={['Email', 'URL', 'JSON'].includes(field.type) || isDate ? 'none' : 'sentences'}
            autoCorrect={!isDate && !['Email', 'URL', 'JSON', 'PhoneNumber'].includes(field.type)}
          />
          {isDate && (
            <TouchableOpacity
              style={[styles.sideBtn, { borderColor: theme.inputBorder }]}
              onPress={() => onChange(value ? '' : nowFormValue(field))}
            >
              <Text style={[styles.sideBtnText, { color: theme.accent }]}>{value ? '✕' : field.type === 'Date' ? 'Dziś' : 'Teraz'}</Text>
            </TouchableOpacity>
          )}
        </View>
      );
    }
  }
}

/**
 * Formularz dodawania (mode = 'create') lub edycji (mode = 'edit') rekordu.
 * Przy edycji wysyłane są tylko zmienione pola. Powiązania z innymi tabelami
 * zapisywane są osobno (endpoint /links) – tylko dodane i usunięte.
 */
export default function RecordFormModal({
  visible, mode, record, fields, baseId, tableId, onClose, onSaved, theme,
}) {
  const { settings } = useSettings();
  const isEdit = mode === 'edit';
  const editable = useMemo(() => fields.filter(isEditable), [fields]);
  const linkFields = useMemo(() => fields.filter(isLinkField), [fields]);
  const formFields = useMemo(() => fields.filter((f) => isEditable(f) || isLinkField(f)), [fields]);
  const readOnly = useMemo(() => fields.filter((f) => !isEditable(f) && !isLinkField(f)), [fields]);

  const initial = useMemo(() => {
    const values = {};
    editable.forEach((f) => { values[f.title] = toFormValue(f, isEdit ? record?.fields?.[f.title] : null); });
    return values;
  }, [editable, record, isEdit]);

  const [form, setForm] = useState(initial);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Powiązania: { [fieldId]: [{ id, fields }] } – stan początkowy (z serwera) i bieżący
  const [linksInitial, setLinksInitial] = useState({});
  const [links, setLinks] = useState({});
  const [linksLoading, setLinksLoading] = useState(false);

  useEffect(() => {
    if (visible) { setForm(initial); setErrors({}); }
  }, [visible, initial]);

  useEffect(() => {
    if (!visible || !linkFields.length) return undefined;
    const empty = Object.fromEntries(linkFields.map((f) => [f.id, []]));
    setLinksInitial(empty); setLinks(empty);
    if (!isEdit || !record) return undefined;
    let cancelled = false;
    setLinksLoading(true);
    Promise.all(linkFields.map((f) => fetchLinkedRecords(settings, baseId, tableId, f.id, record.id)))
      .then((lists) => {
        if (cancelled) return;
        const loaded = Object.fromEntries(linkFields.map((f, i) => [f.id, lists[i]]));
        setLinksInitial(loaded); setLinks(loaded);
      })
      .catch((e) => { if (!cancelled) Alert.alert('Nie udało się wczytać powiązań', e.message); })
      .finally(() => { if (!cancelled) setLinksLoading(false); });
    return () => { cancelled = true; };
  }, [visible, isEdit, record, linkFields, settings, baseId, tableId]);

  const setValue = (title) => (val) => {
    setForm((f) => ({ ...f, [title]: val }));
    if (errors[title]) setErrors((e) => ({ ...e, [title]: undefined }));
  };

  const handleSave = async () => {
    const payload = {};
    const errs = {};
    editable.forEach((f) => {
      if (JSON.stringify(form[f.title]) === JSON.stringify(initial[f.title])) return;
      try { payload[f.title] = fromFormValue(f, form[f.title]); }
      catch (e) { errs[f.title] = e.message; }
    });
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const changedLinks = linkFields.filter((f) => !sameIds(linksInitial[f.id], links[f.id]));
    if (!Object.keys(payload).length && !changedLinks.length) {
      if (isEdit) onClose();
      else Alert.alert('Pusty rekord', 'Wypełnij przynajmniej jedno pole.');
      return;
    }

    setSaving(true);
    let recordId = isEdit ? record.id : undefined;
    try {
      if (isEdit) {
        if (Object.keys(payload).length) await updateRecord(settings, baseId, tableId, record.id, payload);
      } else {
        const created = await createRecord(settings, baseId, tableId, payload);
        recordId = created?.id;
      }
      for (const f of changedLinks) {
        await saveLinkChanges(settings, baseId, tableId, f.id, recordId, idsOf(linksInitial[f.id]), idsOf(links[f.id]));
      }
      const fresh = recordId !== undefined ? await fetchRecord(settings, baseId, tableId, recordId) : null;
      onSaved(fresh?.id !== undefined ? fresh : { ...record, id: recordId, fields: { ...record?.fields, ...payload } }, isEdit ? 'edit' : 'create');
    } catch (e) {
      // Rekord mógł się zapisać, a nie udały się dopiero powiązania – odśwież listę mimo błędu
      if (!isEdit && recordId !== undefined) {
        Alert.alert('Rekord zapisany częściowo', `Rekord został utworzony, ale nie udało się zapisać powiązań:
${e.message}`);
        onSaved({ id: recordId, fields: payload }, 'create');
      } else {
        Alert.alert('Nie udało się zapisać', e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={[styles.safe, { backgroundColor: theme.surface }]}>
        <View style={[styles.topBar, { borderBottomColor: theme.border }]}>
          <TouchableOpacity onPress={onClose} disabled={saving} style={styles.topBtn}>
            <Text style={[styles.cancelText, { color: theme.textSecondary }]}>Anuluj</Text>
          </TouchableOpacity>
          <Text style={[styles.modalTitle, { color: theme.text }]} numberOfLines={1}>
            {isEdit ? 'Edytuj rekord' : 'Nowy rekord'}
          </Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: theme.accent, opacity: saving ? 0.6 : 1 }]}
          >
            {saving
              ? <ActivityIndicator size="small" color={theme.accentText} />
              : <Text style={[styles.saveText, { color: theme.accentText }]}>Zapisz</Text>}
          </TouchableOpacity>
        </View>

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {formFields.map((f) => (
              <View key={f.id} style={styles.field}>
                <Text style={[styles.label, { color: theme.textMuted }]}>{f.title}</Text>
                {isLinkField(f)
                  ? (
                    <LinkFieldInput
                      field={f}
                      value={links[f.id] ?? []}
                      onChange={(recs) => setLinks((l) => ({ ...l, [f.id]: recs }))}
                      baseId={baseId}
                      loading={linksLoading}
                      theme={theme}
                    />
                  )
                  : <FieldInput field={f} value={form[f.title]} onChange={setValue(f.title)} theme={theme} />}
                {f.description ? <Text style={[styles.help, { color: theme.textMuted }]}>{f.description}</Text> : null}
                {errors[f.title] ? <Text style={[styles.error, { color: theme.error }]}>{f.title}: {errors[f.title]}</Text> : null}
              </View>
            ))}

            {isEdit && readOnly.length > 0 && (
              <View style={[styles.readOnlyBox, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
                <Text style={[styles.readOnlyHeader, { color: theme.sectionLabel }]}>POLA TYLKO DO ODCZYTU</Text>
                {readOnly.map((f) => (
                  <View key={f.id} style={styles.readOnlyRow}>
                    <Text style={[styles.readOnlyKey, { color: theme.textMuted }]}>{f.title}</Text>
                    <Text style={[styles.readOnlyVal, { color: theme.textSecondary }]} numberOfLines={2}>
                      {formatValue(f, record?.fields?.[f.title]) || '—'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  topBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, gap: 8,
  },
  topBtn: { paddingVertical: 6, paddingRight: 8 },
  cancelText: { fontSize: 15, fontWeight: '600' },
  modalTitle: { fontSize: 17, fontWeight: '700', flex: 1, textAlign: 'center' },
  saveBtn: { borderRadius: 16, paddingHorizontal: 16, height: 34, minWidth: 80, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 15, fontWeight: '700' },
  content: { padding: 16, paddingBottom: 48, gap: 18 },
  field: { gap: 6 },
  label: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  help: { fontSize: 12 },
  error: { fontSize: 12, fontWeight: '600' },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  input: { flex: 1, borderRadius: 8, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 9, fontSize: 15 },
  multiline: { minHeight: 110 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 },
  sideBtn: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 12, height: 42, justifyContent: 'center' },
  sideBtnText: { fontSize: 14, fontWeight: '700' },
  switch: { alignSelf: 'flex-start' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderRadius: 16, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 6 },
  chipText: { fontSize: 13, fontWeight: '600' },
  stars: { flexDirection: 'row', gap: 6 },
  star: { fontSize: 30 },
  readOnlyBox: { borderWidth: 1, borderRadius: 12, padding: 14, gap: 10, marginTop: 8 },
  readOnlyHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  readOnlyRow: { gap: 2 },
  readOnlyKey: { fontSize: 11, fontWeight: '600' },
  readOnlyVal: { fontSize: 13 },
});
