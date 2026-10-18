import React from 'react';
import { View, Text, FlatList, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { useTables } from '../hooks/useNocoDB';
import { useTheme } from '../theme/ThemeContext';

export default function TableSelectScreen({ route, navigation }) {
  const { baseId, baseName } = route.params;
  const { tables, loading, error, reload } = useTables(baseId);
  const { theme } = useTheme();

  React.useLayoutEffect(() => {
    navigation.setOptions({
      title: baseName ?? 'Wybierz tabelę',
      headerStyle: { backgroundColor: theme.header },
      headerTintColor: theme.headerText,
    });
  }, [navigation, baseName, theme]);

  if (loading) return (
    <View style={[styles.center, { backgroundColor: theme.bg }]}>
      <ActivityIndicator size="large" color={theme.accent} />
      <Text style={[styles.loadingText, { color: theme.textMuted }]}>Ładowanie tabel…</Text>
    </View>
  );

  if (error) return (
    <View style={[styles.center, { backgroundColor: theme.bg }]}>
      <Text style={[styles.errorText, { color: theme.error }]}>⚠️ {error}</Text>
      <TouchableOpacity style={[styles.retryBtn, { backgroundColor: theme.accent }]} onPress={reload}>
        <Text style={[styles.retryText, { color: theme.accentText }]}>Spróbuj ponownie</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>
        Wybierz tabelę do wyświetlenia
      </Text>
      <FlatList
        data={tables}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.item, { backgroundColor: theme.surface }]}
            onPress={() => navigation.navigate('Table', { baseId, tableId: item.id, tableName: item.title })}
            activeOpacity={0.75}
          >
            <View style={styles.itemContent}>
              <Text style={[styles.itemTitle, { color: theme.text }]}>{item.title}</Text>
            </View>
            <Text style={[styles.arrow, { color: theme.border }]}>›</Text>
          </TouchableOpacity>
        )}
        ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: theme.border }} />}
        ListEmptyComponent={<Text style={[styles.empty, { color: theme.textMuted }]}>Brak tabel.</Text>}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  subtitle: { fontSize: 13, paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 },
  list: { paddingBottom: 32 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14 },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 15, fontWeight: '600' },
  arrow: { fontSize: 22 },
  empty: { textAlign: 'center', marginTop: 40 },
  loadingText: { fontSize: 14, marginTop: 8 },
  errorText: { fontSize: 14, textAlign: 'center' },
  retryBtn: { borderRadius: 8, paddingHorizontal: 20, paddingVertical: 10 },
  retryText: { color: '#fff', fontWeight: '600', fontSize: 14 },
});
