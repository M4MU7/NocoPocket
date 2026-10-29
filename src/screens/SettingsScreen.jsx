import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, Alert,
  KeyboardAvoidingView, Platform, Linking, ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { usePins } from '../context/PinsContext';
import { useTheme } from '../theme/ThemeContext';
import { fetchBases } from '../services/nocodbApi';
import {
  Icon, IconButton, TopBar, Segmented, SectionLabel, Card, PrimaryButton, plural,
} from '../components/ui';
import { t } from '../theme/typography';
import pkg from '../../package.json';

const KEYS = ['baseUrl', 'apiToken', 'workspaceId', 'statusField', 'titleField', 'descriptionField', 'descriptionMaxChars', 'pageSize'];
const REPO_URL = 'https://github.com/M4MU7/NocoPocket';

function InputRow({ label, hint, value, onChangeText, placeholder, first, secure, keyboardType, right, theme }) {
  return (
    <View style={[styles.inputRow, !first && { borderTopWidth: 1, borderTopColor: theme.borderLight }]}>
      <View style={styles.flex}>
        <Text style={[t(12, 'bold'), { color: theme.textMuted }]}>{label}</Text>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={theme.textFaint}
          secureTextEntry={secure}
          keyboardType={keyboardType}
          autoCapitalize="none"
          autoCorrect={false}
          accessibilityLabel={label}
          style={[styles.rowInput, t(15, 'semibold'), { color: theme.text }]}
        />
        {hint ? <Text style={[t(12, 'medium'), { color: theme.textMuted }]}>{hint}</Text> : null}
      </View>
      {right}
    </View>
  );
}

export default function SettingsScreen({ navigation }) {
  const { settings, save, reset } = useSettings();
  const { clearPins } = usePins();
  const { theme, mode, setMode } = useTheme();
  const insets = useSafeAreaInsets();

  const [form, setForm] = useState({ ...settings });
  const [showToken, setShowToken] = useState(false);
  const [test, setTest] = useState({ state: 'idle' }); // idle | testing | ok | error
  const [saving, setSaving] = useState(false);

  useEffect(() => { setForm({ ...settings }); }, [settings]);

  const set = (key) => (val) => { setForm((f) => ({ ...f, [key]: val })); if (['baseUrl', 'apiToken', 'workspaceId'].includes(key)) setTest({ state: 'idle' }); };
  const dirty = KEYS.some((k) => String(form[k] ?? '') !== String(settings[k] ?? ''));

  const pageSize = Number(form.pageSize) || 50;
  const stepPageSize = (d) => set('pageSize')(String(Math.min(500, Math.max(25, pageSize + d))));

  const runTest = async () => {
    setTest({ state: 'testing' });
    try {
      const bases = await fetchBases({ ...settings, ...form, baseUrl: form.baseUrl.trim(), apiToken: form.apiToken.trim() });
      setTest({ state: 'ok', count: bases.length });
    } catch (e) {
      setTest({ state: 'error', message: e.message });
    }
  };

  const handleSave = async () => {
    if (!form.baseUrl.trim() || !form.apiToken.trim()) {
      Alert.alert('Brak danych', 'Adres serwera i token API są wymagane.');
      return;
    }
    setSaving(true);
    await save({ ...form, baseUrl: form.baseUrl.trim(), apiToken: form.apiToken.trim() });
    setSaving(false);
  };

  const handleReset = () => {
    Alert.alert(
      'Usunąć dane logowania?',
      'Adres serwera, token, przypięte tabele i ustawienia pól zostaną usunięte z telefonu. Dane w NocoDB pozostaną bez zmian.',
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Usuń', style: 'destructive', onPress: async () => { clearPins(); await reset(); navigation.popToTop(); } },
      ],
    );
  };

  const statusStrip = {
    idle: { bg: theme.surfaceAlt, border: theme.borderLight, icon: 'wifi', color: theme.textSecondary, text: 'Sprawdź połączenie z serwerem' },
    testing: { bg: theme.surfaceAlt, border: theme.borderLight, icon: null, color: theme.textSecondary, text: 'Sprawdzanie…' },
    ok: { bg: theme.successSoft, border: theme.successBorder, icon: 'check-circle', color: theme.success, text: `Połączono · ${test.count} ${plural(test.count ?? 0, 'baza', 'bazy', 'baz')}` },
    error: { bg: theme.errorSoft, border: theme.errorSoft, icon: 'alert-circle', color: theme.error, text: test.message },
  }[test.state];

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: theme.bg }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <TopBar onBack={() => navigation.goBack()} title="Ustawienia" theme={theme} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: (dirty ? 24 : insets.bottom + 24) }]} keyboardShouldPersistTaps="handled">

        <View style={styles.section}>
          <SectionLabel theme={theme} style={styles.label}>Połączenie</SectionLabel>
          <Card theme={theme}>
            <InputRow first label="Adres serwera" value={form.baseUrl} onChangeText={set('baseUrl')} placeholder="https://nocodb.example.com" keyboardType="url" theme={theme} />
            <InputRow
              label="Token API"
              value={form.apiToken}
              onChangeText={set('apiToken')}
              placeholder="xc-token"
              secure={!showToken}
              right={<IconButton icon={showToken ? 'eye-off' : 'eye'} label={showToken ? 'Ukryj token' : 'Pokaż token'} onPress={() => setShowToken((v) => !v)} theme={theme} size={19} color={theme.textSecondary} />}
              theme={theme}
            />
            <InputRow label="Workspace" hint="„default” = wszystkie dostępne" value={form.workspaceId} onChangeText={set('workspaceId')} placeholder="default" theme={theme} />
            <View style={[styles.strip, { backgroundColor: statusStrip.bg, borderTopColor: statusStrip.border }]} accessibilityLiveRegion="polite">
              {statusStrip.icon ? <Icon name={statusStrip.icon} size={19} color={statusStrip.color} /> : <ActivityIndicator size="small" color={theme.accent} />}
              <Text style={[t(14, 'bold'), styles.flex, { color: statusStrip.color }]} numberOfLines={3}>{statusStrip.text}</Text>
              <TouchableOpacity
                onPress={runTest}
                disabled={test.state === 'testing'}
                style={[styles.testBtn, { backgroundColor: theme.surface, borderColor: theme.borderStrong }]}
                accessibilityRole="button"
              >
                <Text style={[t(13, 'extrabold'), { color: theme.text }]}>Testuj</Text>
              </TouchableOpacity>
            </View>
          </Card>
        </View>

        <View style={styles.section}>
          <SectionLabel theme={theme} style={styles.label}>Motyw</SectionLabel>
          <Segmented
            options={[{ key: 'light', label: 'Jasny' }, { key: 'dark', label: 'Ciemny' }, { key: 'system', label: 'Systemowy' }]}
            value={mode}
            onChange={setMode}
            theme={theme}
          />
        </View>

        <View style={styles.section}>
          <SectionLabel theme={theme} style={styles.label}>Pola tabel</SectionLabel>
          <Card theme={theme}>
            <InputRow first label="Kolumny Kanbana" hint="Nazwa pola typu SingleSelect – włącza widok Kanban" value={form.statusField} onChangeText={set('statusField')} placeholder="Status" theme={theme} />
            <InputRow label="Tytuł rekordu" hint="Gdy tabela nie ma tego pola – pole główne tabeli" value={form.titleField} onChangeText={set('titleField')} placeholder="Automatycznie" theme={theme} />
            <InputRow label="Opis na karcie Kanbana" value={form.descriptionField} onChangeText={set('descriptionField')} placeholder="Opis" theme={theme} />
            <InputRow label="Długość opisu (znaki)" value={String(form.descriptionMaxChars ?? '')} onChangeText={set('descriptionMaxChars')} placeholder="120" keyboardType="number-pad" theme={theme} />
          </Card>
        </View>

        <View style={styles.section}>
          <SectionLabel theme={theme} style={styles.label}>Wyświetlanie</SectionLabel>
          <Card theme={theme} style={styles.stepperCard}>
            <Text style={[t(15, 'semibold'), styles.flex, { color: theme.text }]} nativeID="pagesize">Rekordów na stronę</Text>
            <View style={styles.stepper} accessibilityLabelledBy="pagesize">
              <IconButton icon="minus" label="Mniej rekordów na stronę" onPress={() => stepPageSize(-25)} disabled={pageSize <= 25} theme={theme} variant="bordered" size={18} style={styles.stepBtn} />
              <Text style={[t(16, 'extrabold'), styles.stepValue, { color: theme.text }]}>{pageSize}</Text>
              <IconButton icon="plus" label="Więcej rekordów na stronę" onPress={() => stepPageSize(25)} disabled={pageSize >= 500} theme={theme} variant="bordered" size={18} style={styles.stepBtn} />
            </View>
          </Card>
        </View>

        <TouchableOpacity onPress={handleReset} style={[styles.dangerBtn, { backgroundColor: theme.surface, borderColor: theme.errorSoft }]} accessibilityRole="button">
          <Text style={[t(15, 'extrabold'), { color: theme.error }]}>Usuń dane logowania z telefonu</Text>
        </TouchableOpacity>

        <View style={styles.footer}>
          <Text style={[t(13, 'medium'), { color: theme.textMuted }]}>NocoPocket {pkg.version} · </Text>
          <TouchableOpacity onPress={() => Linking.openURL(REPO_URL)} accessibilityRole="link" hitSlop={8}>
            <Text style={[t(13, 'bold'), { color: theme.accent }]}>Kod źródłowy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {dirty && (
        <View style={[styles.saveBar, { paddingBottom: insets.bottom + 12, backgroundColor: theme.surface, borderTopColor: theme.border }]}>
          <View style={styles.saveInfo}>
            <View style={[styles.dot, { backgroundColor: theme.changed }]} />
            <Text style={[t(14, 'extrabold'), { color: theme.text }]}>Niezapisane zmiany</Text>
          </View>
          <TouchableOpacity onPress={() => setForm({ ...settings })} style={styles.discard} accessibilityRole="button">
            <Text style={[t(14, 'bold'), { color: theme.textSecondary }]}>Cofnij</Text>
          </TouchableOpacity>
          <PrimaryButton label="Zapisz" onPress={handleSave} loading={saving} theme={theme} height={48} />
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 16, paddingTop: 8, gap: 20 },
  section: { gap: 8 },
  label: { marginHorizontal: 4 },
  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingLeft: 16, paddingRight: 6, paddingVertical: 10 },
  rowInput: { paddingVertical: 2, marginTop: 2 },
  strip: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, paddingLeft: 16, paddingRight: 10, borderTopWidth: 1 },
  testBtn: { height: 36, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, justifyContent: 'center' },
  stepperCard: { flexDirection: 'row', alignItems: 'center', minHeight: 60, paddingLeft: 16, paddingRight: 8 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stepBtn: { width: 40, height: 40, borderRadius: 10 },
  stepValue: { minWidth: 44, textAlign: 'center' },
  dangerBtn: { height: 50, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  saveBar: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 12, paddingHorizontal: 16, borderTopWidth: 1 },
  saveInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  discard: { height: 44, paddingHorizontal: 10, justifyContent: 'center' },
});
