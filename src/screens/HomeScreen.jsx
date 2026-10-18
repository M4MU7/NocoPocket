import React from 'react';
import {
  View, Text, FlatList, TouchableOpacity,
  ActivityIndicator, StyleSheet, SafeAreaView,
} from 'react-native';
import { useBases } from '../hooks/useNocoDB';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../theme/ThemeContext';

export default function HomeScreen({ navigation }) {
  const { bases, loading, error, reload } = useBases();
  const { settings, loaded } = useSettings();
  const { theme } = useTheme();

  const goToSettings = () => navigation.navigate('Settings');
  const isConfigured = !!(settings.baseUrl && settings.apiToken);
  const domain = settings.baseUrl.replace(/^https?:\/\//, '') || 'Nie skonfigurowano';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.bg }]}>

      {/* HEADER – zawsze widoczny */}
      <View style={[styles.header, { backgroundColor: theme.header }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: theme.headerText }]}>NocoPocket</Text>
          <Text style={[styles.headerSub, { color: theme.headerSub }]} numberOfLines={1}>{domain}</Text>
        </View>
        <TouchableOpacity style={styles.settingsBtn} onPress={goToSettings}>
          <Text style={styles.settingsIcon}>⚙️</Text>
        </TouchableOpacity>
      </View>

      {/* STAN: czekanie na wczytanie ustawień */}
      {!loaded && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
        </View>
      )}

      {/* STAN: brak konfiguracji */}
      {loaded && !isConfigured && (
        <View style={styles.center}>
          <Text style={styles.emoji}>🔌</Text>
          <Text style={[styles.bigLabel, { color: theme.text }]}>Nie skonfigurowano</Text>
          <Text style={[styles.subLabel, { color: theme.textMuted }]}>
            Podaj adres serwera i klucz API żeby zacząć.
          </Text>
          <TouchableOpacity
            style={[styles.primaryBtn, { backgroundColor: theme.accent }]}
            onPress={goToSettings}
          >
            <Text style={[styles.primaryBtnText, { color: theme.accentText }]}>⚙️ Otwórz ustawienia</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STAN: ładowanie */}
      {loaded && isConfigured && loading && (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={theme.accent} />
          <Text style={[styles.loadingText, { color: theme.textMuted }]}>Łączenie z NocoDB…</Text>
        </View>
      )}

      {/* STAN: błąd */}
      {loaded && isConfigured && !loading && error && (
        <View style={styles.center}>
          <Text style={styles.emoji}>⚠️</Text>
          <Text style={[styles.bigLabel, { color: theme.error }]}>Błąd połączenia</Text>
          <Text style={[styles.subLabel, { color: theme.textSecondary }]}>{error}</Text>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: theme.accent }]} onPress={reload}>
            <Text style={[styles.primaryBtnText, { color: theme.accentText }]}>Spróbuj ponownie</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.secondaryBtn, { borderColor: theme.border }]} onPress={goToSettings}>
            <Text style={[styles.secondaryBtnText, { color: theme.accent }]}>⚙️ Sprawdź ustawienia</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* STAN: dane */}
      {loaded && isConfigured && !loading && !error && (
        <>
          <Text style={[styles.sectionLabel, { color: theme.sectionLabel }]}>TWOJE BAZY DANYCH</Text>
          <FlatList
            data={bases}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.list}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={[styles.item, { backgroundColor: theme.surface }]}
                onPress={() => navigation.navigate('TableSelect', { baseId: item.id, baseName: item.title })}
                activeOpacity={0.75}
              >
                <View style={styles.itemContent}>
                  <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
                  {item.description
                    ? <Text style={[styles.itemDesc, { color: theme.textMuted }]} numberOfLines={1}>{item.description}</Text>
                    : null}
                </View>
                <Text style={[styles.arrow, { color: theme.border }]}>›</Text>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={[styles.subLabel, { color: theme.textMuted }]}>Brak baz danych.</Text>
              </View>
            }
          />
        </>
      )}

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, paddingTop: 20, paddingBottom: 24,
  },
  headerTitle: { fontSize: 24, fontWeight: '800' },
  headerSub: { fontSize: 12, marginTop: 4 },
  settingsBtn: { padding: 8 },
  settingsIcon: { fontSize: 26 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 12 },
  emoji: { fontSize: 52 },
  bigLabel: { fontSize: 20, fontWeight: '700', textAlign: 'center' },
  subLabel: { fontSize: 14, textAlign: 'center', lineHeight: 21 },
  loadingText: { fontSize: 14 },
  primaryBtn: { borderRadius: 12, paddingHorizontal: 28, paddingVertical: 13, marginTop: 4 },
  primaryBtnText: { fontWeight: '700', fontSize: 15 },
  secondaryBtn: { borderRadius: 12, borderWidth: 1, paddingHorizontal: 28, paddingVertical: 12 },
  secondaryBtnText: { fontWeight: '600', fontSize: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8 },
  list: { paddingBottom: 32 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 16, fontWeight: '600' },
  itemDesc: { fontSize: 12, marginTop: 2 },
  arrow: { fontSize: 24 },
});
