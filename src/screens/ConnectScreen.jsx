import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Image, StyleSheet,
  KeyboardAvoidingView, Platform, Linking,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../theme/ThemeContext';
import { fetchBases } from '../services/nocodbApi';
import { Icon, IconButton, PrimaryButton } from '../components/ui';
import { t } from '../theme/typography';

const TOKEN_DOCS = 'https://docs.nocodb.com/account-settings/api-tokens/';

/** Pierwsze uruchomienie: adres serwera + token, sprawdzane przed zapisaniem */
export default function ConnectScreen() {
  const { settings, save } = useSettings();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();

  const [baseUrl, setBaseUrl] = useState(settings.baseUrl);
  const [apiToken, setApiToken] = useState(settings.apiToken);
  const [workspaceId, setWorkspaceId] = useState(settings.workspaceId || 'default');
  const [showToken, setShowToken] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [focused, setFocused] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    const url = baseUrl.trim();
    if (!/^https?:\/\/.+/i.test(url)) { setError('Podaj pełny adres zaczynający się od http:// lub https://'); return; }
    if (!apiToken.trim()) { setError('Podaj token API.'); return; }
    const next = { baseUrl: url, apiToken: apiToken.trim(), workspaceId: workspaceId.trim() || 'default' };
    setConnecting(true); setError(null);
    try {
      await fetchBases({ ...settings, ...next });
      await save(next); // ekran startowy przełączy się sam na listę baz
    } catch (e) {
      setError(e.message);
    } finally {
      setConnecting(false);
    }
  };

  const inputStyle = (name) => [
    styles.input, t(16, 'medium'),
    { color: theme.text, backgroundColor: theme.inputBg, borderColor: focused === name ? theme.accent : theme.borderStrong, borderWidth: focused === name ? 1.5 : 1 },
  ];

  return (
    <KeyboardAvoidingView style={[styles.flex, { backgroundColor: theme.surface }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.intro}>
          <Image source={require('../../assets/logo.webp')} style={styles.logo} accessibilityLabel="Logo NocoPocket" />
          <Text style={[t(30, 'extrabold'), styles.title, { color: theme.text }]}>Połącz z NocoDB</Text>
          <Text style={[t(16, 'medium'), styles.lead, { color: theme.textSecondary }]}>
            Podaj adres swojego serwera i token API. Dane logowania zostaną zapisane tylko na tym telefonie.
          </Text>
        </View>

        <View style={styles.form}>
          <View style={styles.field}>
            <Text style={[t(14, 'bold'), { color: theme.text }]}>Adres serwera</Text>
            <TextInput
              style={inputStyle('url')}
              value={baseUrl}
              onChangeText={setBaseUrl}
              onFocus={() => setFocused('url')}
              onBlur={() => setFocused(null)}
              placeholder="https://nocodb.example.com"
              placeholderTextColor={theme.textMuted}
              keyboardType="url"
              autoCapitalize="none"
              autoCorrect={false}
              accessibilityLabel="Adres serwera"
            />
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={[t(14, 'bold'), { color: theme.text }]}>Token API</Text>
              <TouchableOpacity onPress={() => Linking.openURL(TOKEN_DOCS)} accessibilityRole="link" hitSlop={8}>
                <Text style={[t(14, 'bold'), { color: theme.accent }]}>Jak go utworzyć?</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.inputRow, { backgroundColor: theme.inputBg, borderColor: focused === 'token' ? theme.accent : theme.borderStrong, borderWidth: focused === 'token' ? 1.5 : 1 }]}>
              <TextInput
                style={[styles.inputInner, t(16, 'medium'), { color: theme.text }]}
                value={apiToken}
                onChangeText={setApiToken}
                onFocus={() => setFocused('token')}
                onBlur={() => setFocused(null)}
                placeholder="xc-token"
                placeholderTextColor={theme.textMuted}
                secureTextEntry={!showToken}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Token API"
              />
              <IconButton icon={showToken ? 'eye-off' : 'eye'} label={showToken ? 'Ukryj token' : 'Pokaż token'} onPress={() => setShowToken((v) => !v)} theme={theme} size={20} color={theme.textSecondary} />
            </View>
            <Text style={[t(13, 'medium'), { color: theme.textMuted }]}>Najlepiej użyj tokena z dostępem tylko do potrzebnych baz.</Text>
          </View>

          <TouchableOpacity
            onPress={() => setAdvanced((v) => !v)}
            style={[styles.advanced, { borderColor: theme.borderLight }]}
            accessibilityRole="button"
            accessibilityState={{ expanded: advanced }}
          >
            <Text style={[t(15, 'semibold'), { color: theme.text }]}>Ustawienia zaawansowane</Text>
            <View style={styles.advancedRight}>
              <Text style={[t(14, 'medium'), { color: theme.textMuted }]}>
                Workspace: {workspaceId && workspaceId !== 'default' ? workspaceId : 'wszystkie'}
              </Text>
              <Icon name={advanced ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textMuted} />
            </View>
          </TouchableOpacity>
          {advanced && (
            <View style={styles.field}>
              <Text style={[t(14, 'bold'), { color: theme.text }]}>Workspace ID</Text>
              <TextInput
                style={inputStyle('ws')}
                value={workspaceId}
                onChangeText={setWorkspaceId}
                onFocus={() => setFocused('ws')}
                onBlur={() => setFocused(null)}
                placeholder="default"
                placeholderTextColor={theme.textMuted}
                autoCapitalize="none"
                autoCorrect={false}
                accessibilityLabel="Workspace ID"
              />
              <Text style={[t(13, 'medium'), { color: theme.textMuted }]}>„default” pobiera bazy ze wszystkich dostępnych workspace'ów.</Text>
            </View>
          )}

          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.errorSoft }]} accessibilityLiveRegion="polite">
              <Icon name="alert-circle" size={18} color={theme.error} />
              <Text style={[t(14, 'semibold'), styles.flex, { color: theme.error }]}>{error}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.flex} />

        <View style={styles.footer}>
          <PrimaryButton label="Połącz" icon="arrow-right" onPress={handleConnect} loading={connecting} theme={theme} height={54} />
          <Text style={[t(13, 'medium'), styles.center, { color: theme.textMuted }]}>
            NocoPocket łączy się tylko z Twoim serwerem.{'\n'}Bez analityki i zewnętrznych usług.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, gap: 28 },
  intro: { gap: 16 },
  logo: { width: 72, height: 72 },
  title: { letterSpacing: -0.5, lineHeight: 36 },
  lead: { lineHeight: 24 },
  form: { gap: 18 },
  field: { gap: 8 },
  labelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  input: { height: 52, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 0 },
  inputRow: { flexDirection: 'row', alignItems: 'center', height: 52, borderRadius: 14, paddingLeft: 16, paddingRight: 4 },
  inputInner: { flex: 1, minWidth: 0, paddingVertical: 0 },
  advanced: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', height: 52, borderTopWidth: 1, borderBottomWidth: 1, paddingHorizontal: 4 },
  advancedRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  errorBox: { flexDirection: 'row', gap: 10, padding: 12, borderRadius: 12, alignItems: 'flex-start' },
  footer: { gap: 14 },
  center: { textAlign: 'center', lineHeight: 19 },
});
