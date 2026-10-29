import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Image, RefreshControl, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useBases, useCount } from '../hooks/useNocoDB';
import { useSettings } from '../context/SettingsContext';
import { usePins } from '../context/PinsContext';
import { useTheme } from '../theme/ThemeContext';
import ConnectScreen from './ConnectScreen';
import {
  Icon, IconButton, SearchField, SectionLabel, Card, PrimaryButton, plural, tint,
} from '../components/ui';
import { t } from '../theme/typography';

function PinnedCard({ pin, onPress, theme }) {
  const count = useCount(pin.baseId, pin.tableId);
  return (
    <TouchableOpacity onPress={onPress} style={[styles.pinCard, { backgroundColor: theme.surface, borderColor: theme.border }]} activeOpacity={0.7}>
      <View style={[styles.tile36, { backgroundColor: theme.accentSoft }]}>
        <Icon name="grid" size={19} color={theme.accent} />
      </View>
      <View style={styles.gap2}>
        <Text style={[t(15, 'bold'), { color: theme.text }]} numberOfLines={1}>{pin.title}</Text>
        <Text style={[t(12, 'medium'), { color: theme.textMuted }]} numberOfLines={1}>
          {pin.baseTitle}{count !== null ? ` · ${count}` : ''}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({ navigation }) {
  const { settings, loaded } = useSettings();
  const isConfigured = !!(settings.baseUrl && settings.apiToken);
  const { bases, loading, error, reload } = useBases();
  const { pins } = usePins();
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shownBases = useMemo(() => bases.filter((b) => !q || String(b.title).toLowerCase().includes(q)), [bases, q]);
  const shownPins = useMemo(() => pins.filter((p) => !q || `${p.title} ${p.baseTitle}`.toLowerCase().includes(q)), [pins, q]);

  if (!loaded) return <View style={[styles.center, { backgroundColor: theme.bg }]}><ActivityIndicator size="large" color={theme.accent} /></View>;
  if (!isConfigured) return <ConnectScreen />;

  const domain = settings.baseUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
  const status = loading
    ? { color: theme.textFaint, text: 'łączenie…' }
    : error ? { color: theme.errorBorder, text: 'błąd połączenia' } : { color: '#1F9D61', text: 'połączono' };

  const openTable = (pin) => navigation.navigate('Table', { baseId: pin.baseId, baseName: pin.baseTitle, tableId: pin.tableId, tableName: pin.title });

  return (
    <ScrollView
      style={{ backgroundColor: theme.bg }}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 }]}
      refreshControl={<RefreshControl refreshing={loading && bases.length > 0} onRefresh={reload} tintColor={theme.accent} colors={[theme.accent]} />}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Image source={require('../../assets/logo.webp')} style={styles.logo} accessibilityIgnoresInvertColors />
        <View style={styles.flex}>
          <Text style={[t(22, 'extrabold'), { color: theme.text, letterSpacing: -0.4 }]}>NocoPocket</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: status.color }]} />
            <Text style={[t(13, 'medium'), { color: theme.textSecondary }]} numberOfLines={1}>{domain} · {status.text}</Text>
          </View>
        </View>
        <IconButton icon="sliders" label="Ustawienia" onPress={() => navigation.navigate('Settings')} theme={theme} variant="bordered" size={20} />
      </View>

      <View style={styles.padded}>
        <SearchField value={query} onChangeText={setQuery} placeholder="Szukaj baz i przypiętych tabel" theme={theme} />
      </View>

      <View style={styles.section}>
        <View style={[styles.sectionHead, styles.padded]}>
          <SectionLabel theme={theme}>Przypięte</SectionLabel>
          {pins.length > 0 && <Text style={[t(13, 'medium'), { color: theme.textMuted }]}>{pins.length}</Text>}
        </View>
        {pins.length === 0 ? (
          <View style={styles.padded}>
            <View style={[styles.emptyPins, { borderColor: theme.borderStrong }]}>
              <Icon name="bookmark" size={18} color={theme.textMuted} />
              <Text style={[t(13, 'medium'), styles.flex, { color: theme.textSecondary }]}>
                Przypnij tabelę ikoną zakładki na liście tabel, żeby mieć ją tutaj pod ręką.
              </Text>
            </View>
          </View>
        ) : shownPins.length === 0 ? (
          <Text style={[t(13, 'medium'), styles.padded, { color: theme.textMuted }]}>Brak przypiętych tabel pasujących do „{query}”.</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pinRow}>
            {shownPins.map((p) => <PinnedCard key={p.tableId} pin={p} onPress={() => openTable(p)} theme={theme} />)}
          </ScrollView>
        )}
      </View>

      <View style={[styles.section, styles.padded]}>
        <SectionLabel theme={theme} style={styles.sectionLabelGap}>Bazy{bases.length ? ` · ${bases.length}` : ''}</SectionLabel>

        {loading && !bases.length ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator color={theme.accent} />
            <Text style={[t(14, 'medium'), { color: theme.textMuted }]}>Łączenie z NocoDB…</Text>
          </View>
        ) : error && !bases.length ? (
          <Card theme={theme} style={styles.errorCard}>
            <View style={styles.errorHead}>
              <Icon name="alert-circle" size={20} color={theme.error} />
              <Text style={[t(16, 'extrabold'), { color: theme.error }]}>Błąd połączenia</Text>
            </View>
            <Text style={[t(14, 'medium'), { color: theme.textSecondary, lineHeight: 20 }]}>{error}</Text>
            <View style={styles.errorActions}>
              <PrimaryButton label="Spróbuj ponownie" onPress={reload} theme={theme} height={46} style={styles.flex} />
              <IconButton icon="sliders" label="Sprawdź ustawienia" onPress={() => navigation.navigate('Settings')} theme={theme} variant="bordered" />
            </View>
          </Card>
        ) : shownBases.length === 0 ? (
          <Text style={[t(14, 'medium'), { color: theme.textMuted }]}>{q ? `Brak baz pasujących do „${query}”.` : 'Brak baz w tym workspace.'}</Text>
        ) : (
          <Card theme={theme}>
            {shownBases.map((b, i) => {
              const color = b.meta?.icon_color;
              return (
                <TouchableOpacity
                  key={b.id}
                  onPress={() => navigation.navigate('TableSelect', { baseId: b.id, baseName: b.title })}
                  style={[styles.baseRow, i > 0 && { borderTopWidth: 1, borderTopColor: theme.borderLight }]}
                  activeOpacity={0.6}
                >
                  <View style={[styles.tile40, { backgroundColor: tint(color) ?? theme.accentSoft }]}>
                    <Icon name="database" size={19} color={color ?? theme.accent} />
                  </View>
                  <View style={[styles.flex, styles.gap2]}>
                    <Text style={[t(16, 'bold'), { color: theme.text }]} numberOfLines={1}>{b.title}</Text>
                    {b.description ? <Text style={[t(13, 'medium'), { color: theme.textMuted }]} numberOfLines={1}>{b.description}</Text> : null}
                  </View>
                  <Icon name="chevron-right" size={18} color={theme.textFaint} />
                </TouchableOpacity>
              );
            })}
          </Card>
        )}
      </View>

      <View style={styles.flex} />
      <Text style={[t(13, 'medium'), styles.hint, { color: theme.textMuted }]}>Pociągnij w dół, aby odświeżyć</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { flexGrow: 1, gap: 4 },
  padded: { paddingHorizontal: 20 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingBottom: 12 },
  logo: { width: 44, height: 44 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  section: { paddingTop: 20 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  sectionLabelGap: { marginBottom: 10 },
  pinRow: { gap: 12, paddingHorizontal: 20 },
  pinCard: { width: 156, height: 116, padding: 14, borderRadius: 16, borderWidth: 1, justifyContent: 'space-between' },
  tile36: { width: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  tile40: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  gap2: { gap: 2 },
  emptyPins: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, borderWidth: 1, borderStyle: 'dashed' },
  baseRow: { flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 68, paddingHorizontal: 16 },
  loadingBox: { alignItems: 'center', gap: 10, paddingVertical: 32 },
  errorCard: { padding: 16, gap: 10 },
  errorHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  hint: { textAlign: 'center', paddingTop: 24 },
});
