import React, { useState, useEffect, useMemo } from 'react';
import {
  Modal, View, Text, TextInput, ScrollView, Switch, TouchableOpacity,
  StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import {
  createRecord, updateRecord, fetchRecord, fetchLinkedRecords, saveLinkChanges,
} from '../services/nocodbApi';
import {
  isEditable, isLinkField, toFormValue, fromFormValue, formatValue, nowFormValue, getContrastColor,
} from '../utils/fieldTypes';
import { LinkFieldInput } from './LinkFields';
import { Icon, SheetBar, PrimaryButton, SectionLabel, plural } from './ui';
import { t } from '../theme/typography';

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
    if (multi) onChange(selected.includes(title) ? selected.filter((x) => x !== title) : [...selected, title]);
    else onChange(selected.includes(title) ? null : title);
  };
  if (!choices.length) return <Text style={[t(14, 'medium'), { color: theme.textMuted }]}>Brak zdefiniowanych opcji.</Text>;
  return (
    <View style={styles.chips}>
      {choices.map((c) => {
        const on = selected.includes(c.title);
        const bg = c.color ?? theme.accentSoft;
        const fg = getContrastColor(bg);
        return (
          <TouchableOpacity
            key={c.id ?? c.title}
            onPress={() => toggle(c.title)}
            accessibilityRole={multi ? 'checkbox' : 'radio'}
            accessibilityState={{ checked: on }}
            style={[styles.chip, on
              ? { backgroundColor: bg, borderColor: fg, borderWidth: 2, paddingLeft: 10 }
              : { backgroundColor: theme.surface, borderColor: theme.borderStrong, borderWidth: 1 }]}
            activeOpacity={0.7}
          >
            {on ? <Icon name="check" size={15} color={fg} /> : null}
            <Text style={[t(14, on ? 'extrabold' : 'bold'), { color: on ? fg : theme.textSecondary }]}>{c.title}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function Stars({ field, value, onChange, theme }) {
  const max = Number(field.options?.max_value) || 5;
  return (
    <View style={styles.stars}>
      {Array.from({ length: max }, (_, i) => i + 1).map((n) => (
        <TouchableOpacity
          key={n}
          onPress={() => onChange(n === value ? 0 : n)}
          style={styles.starBtn}
          accessibilityRole="button"
          accessibilityLabel={`${field.title}: ${n} z ${max}`}
          accessibilityState={{ selected: n === value }}
        >
          <Text style={[styles.star, { color: n <= value ? theme.star : theme.starOff }]}>★</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

function FieldInput({ field, value, onChange, error, theme }) {
  switch (field.type) {
    case 'SingleSelect':
      return <Chips field={field} value={value} onChange={onChange} theme={theme} />;
    case 'MultiSelect':
      return <Chips field={field} value={value} multi onChange={onChange} theme={theme} />;
    case 'Rating':
      return <Stars field={field} value={value} onChange={onChange} theme={theme} />;
    default: {
      const multiline = field.type === 'LongText' || field.type === 'JSON';
      const isDate = field.type === 'Date' || field.type === 'DateTime' || field.type === 'Time';
      const dv = field.default_value;
      const placeholder = dv !== undefined && dv !== null && dv !== '' ? `domyślnie: ${dv}` : FORMAT_HINTS[field.type] ?? '';
      return (
        <View style={styles.inputRow}>
          <TextInput
            style={[
              styles.input, t(16, 'medium'),
              multiline && styles.multiline,
              field.type === 'JSON' && styles.mono,
              {
                backgroundColor: theme.inputBg, color: theme.text,
                borderColor: error ? theme.errorBorder : theme.borderStrong, borderWidth: error ? 2 : 1,
              },
            ]}
            value={value}
            onChangeText={onChange}
            placeholder={placeholder}
            placeholderTextColor={theme.textFaint}
            keyboardType={KEYBOARDS[field.type] ?? 'default'}
            multiline={multiline}
            textAlignVertical={multiline ? 'top' : 'center'}
            autoCapitalize={['Email', 'URL', 'JSON'].includes(field.type) || isDate ? 'none' : 'sentences'}
            autoCorrect={!isDate && !['Email', 'URL', 'JSON', 'PhoneNumber'].includes(field.type)}
            accessibilityLabel={field.title}
          />
          {isDate && (
            <TouchableOpacity
              style={[styles.sideBtn, { borderColor: theme.borderStrong, backgroundColor: theme.surface }]}
              onPress={() => onChange(value ? '' : nowFormValue(field))}
              accessibilityRole="button"
              accessibilityLabel={value ? `Wyczyść ${field.title}` : field.type === 'Date' ? 'Wstaw dzisiejszą datę' : 'Wstaw bieżący czas'}
            >
              {value
                ? <Icon name="x" size={18} color={theme.textSecondary} />
                : <Text style={[t(14, 'bold'), { color: theme.accent }]}>{field.type === 'Date' ? 'Dziś' : 'Teraz'}</Text>}
            </TouchableOpacity>
          )}
        </View>
      );
    }
  }
}

function ChangedMark({ theme }) {
  return (
    <View style={styles.changed}>
      <View style={[styles.dot6, { backgroundColor: theme.changed }]} />
      <Text style={[t(12, 'bold'), { color: theme.changed }]}>zmieniono</Text>
    </View>
  );
}

/**
 * Formularz dodawania (mode = 'create') lub edycji (mode = 'edit') rekordu.
 * Przy edycji wysyłane są tylko zmienione pola. Powiązania z innymi tabelami
 * zapisywane są osobno (endpoint /links) – tylko dodane i usunięte.
 * preset (tylko create): wartości startowe, np. status kolumny Kanbana.
 */
export default function RecordFormModal({
  visible, mode, record, preset, fields, baseId, tableId, onClose, onSaved, theme,
}) {
  const { settings } = useSettings();
  const insets = useSafeAreaInsets();
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

  const startValues = useMemo(() => {
    if (isEdit || !preset) return initial;
    const values = { ...initial };
    editable.forEach((f) => { if (preset[f.title] !== undefined) values[f.title] = toFormValue(f, preset[f.title]); });
    return values;
  }, [initial, preset, isEdit, editable]);

  const [form, setForm] = useState(startValues);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  // Powiązania: { [fieldId]: [{ id, fields }] } – stan początkowy (z serwera) i bieżący
  const [linksInitial, setLinksInitial] = useState({});
  const [links, setLinks] = useState({});
  const [linksLoading, setLinksLoading] = useState(false);

  useEffect(() => {
    if (visible) { setForm(startValues); setErrors({}); }
  }, [visible, startValues]);

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

  const isChanged = (f) => (isLinkField(f)
    ? !sameIds(linksInitial[f.id], links[f.id])
    : JSON.stringify(form[f.title]) !== JSON.stringify(initial[f.title]));
  const changedCount = formFields.filter(isChanged).length;
  const errorCount = Object.values(errors).filter(Boolean).length;

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
        Alert.alert('Rekord zapisany częściowo', `Rekord został utworzony, ale nie udało się zapisać powiązań:\n${e.message}`);
        onSaved({ id: recordId, fields: payload }, 'create');
      } else {
        Alert.alert('Nie udało się zapisać', e.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const footerText = changedCount
    ? `${changedCount} ${plural(changedCount, 'zmiana', 'zmiany', 'zmian')}`
    : isEdit ? 'Brak zmian' : 'Nowy rekord';

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent navigationBarTranslucent>
      <View style={[styles.flex, { backgroundColor: theme.surface }]}>
        <SheetBar onCancel={onClose} disabled={saving} title={isEdit ? 'Edytuj rekord' : 'Nowy rekord'} theme={theme} />

        <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
            {formFields.map((f) => {
              const changed = isChanged(f);
              if (f.type === 'Checkbox') {
                return (
                  <View key={f.id} style={styles.switchRow}>
                    <View style={styles.labelRow}>
                      <Text style={[t(13, 'extrabold'), { color: theme.text }]}>{f.title}</Text>
                      {changed ? <ChangedMark theme={theme} /> : null}
                    </View>
                    <Switch
                      value={!!form[f.title]}
                      onValueChange={setValue(f.title)}
                      trackColor={{ true: theme.switchTrackTrue, false: theme.switchTrackFalse }}
                      thumbColor={theme.switchThumb}
                      accessibilityLabel={f.title}
                    />
                  </View>
                );
              }
              return (
                <View key={f.id} style={styles.field}>
                  <View style={styles.labelRow}>
                    <Text style={[t(13, 'extrabold'), { color: theme.text }]}>{f.title}</Text>
                    {changed ? <ChangedMark theme={theme} /> : null}
                  </View>
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
                    : <FieldInput field={f} value={form[f.title]} onChange={setValue(f.title)} error={errors[f.title]} theme={theme} />}
                  {f.description ? <Text style={[t(12, 'medium'), { color: theme.textMuted }]}>{f.description}</Text> : null}
                  {errors[f.title] ? (
                    <View style={styles.errorRow}>
                      <Icon name="alert-circle" size={15} color={theme.error} />
                      <Text style={[t(13, 'bold'), styles.flex, { color: theme.error }]}>{errors[f.title]}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}

            {isEdit && readOnly.length > 0 && (
              <View style={[styles.readOnlyBox, { borderColor: theme.border, backgroundColor: theme.surfaceAlt }]}>
                <SectionLabel theme={theme}>Pola tylko do odczytu</SectionLabel>
                {readOnly.map((f) => (
                  <View key={f.id} style={styles.readOnlyRow}>
                    <Text style={[t(12, 'bold'), { color: theme.textMuted }]}>{f.title}</Text>
                    <Text style={[t(14, 'medium'), { color: theme.textSecondary }]} numberOfLines={2}>
                      {formatValue(f, record?.fields?.[f.title]) || '—'}
                    </Text>
                  </View>
                ))}
              </View>
            )}
          </ScrollView>
        </KeyboardAvoidingView>

        <View style={[styles.saveBar, { paddingBottom: insets.bottom + 12, borderTopColor: theme.border, backgroundColor: theme.surface }]}>
          <View style={styles.flex}>
            <View style={styles.inline}>
              {changedCount ? <View style={[styles.dot8, { backgroundColor: theme.changed }]} /> : null}
              <Text style={[t(14, 'extrabold'), { color: theme.text }]}>{footerText}</Text>
            </View>
            {errorCount ? (
              <Text style={[t(12, 'bold'), { color: theme.error }]}>
                {errorCount} {plural(errorCount, 'pole', 'pola', 'pól')} do poprawy
              </Text>
            ) : null}
          </View>
          <PrimaryButton label="Zapisz" onPress={handleSave} loading={saving} theme={theme} height={52} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  inline: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  content: { padding: 20, paddingBottom: 40, gap: 22 },
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  changed: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  dot6: { width: 6, height: 6, borderRadius: 3 },
  dot8: { width: 8, height: 8, borderRadius: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 48 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  input: { flex: 1, minHeight: 48, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  multiline: { minHeight: 110 },
  mono: { fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', fontSize: 13 },
  sideBtn: { minWidth: 56, height: 48, paddingHorizontal: 12, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 40, paddingHorizontal: 14, borderRadius: 999 },
  stars: { flexDirection: 'row', marginLeft: -8 },
  starBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  star: { fontSize: 30, lineHeight: 36 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  readOnlyBox: { borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  readOnlyRow: { gap: 2 },
  saveBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1 },
});
