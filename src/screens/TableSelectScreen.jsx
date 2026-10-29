import React, { useState, useMemo } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator, RefreshControl, StyleSheet,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTables, useCount } from '../hooks/useNocoDB';
import { usePins } from '../context/PinsContext';
import { useTheme } from '../theme/ThemeContext';
import {
  Icon, IconButton, TopBar, SearchField, Card, PrimaryButton, plural,
} from '../components/ui';
import { t } from '../theme/typography';

function TableRow({ table, baseId, baseName, first, onOpen, theme }) {
  const count = useCount(baseId, table.id);
  const { isPinned, togglePin } = usePins();
  const pinned = isPinned(table.id);
  return (
    <View style={[styles.row, !first && { borderTopWidth: 1, borderTopColor: theme.borderLight }]}>
      <TouchableOpacity onPress={onOpen} style={styles.rowMain} activeOpacity={0.6}>
        <View style={[styles.tile, { backgroundColor: theme.surfaceAlt }]}>
          <Icon name="grid" size={19} color={theme.accent} />
        </View>
        <View style={styles.rowText}>
          <Text style={[t(16, 'bold'), { color: theme.text }]} numberOfLines={1}>{table.title}</Text>
          <Text style={[t(13, 'medium'), { color: theme.textMuted }]} numberOfLines={1}>
            {count === null ? '…' : `${count} ${plural(count, 'rekord', 'rekordy', 'rekordów')}`}
            {table.description ? ` · ${table.description}` : ''}
          </Text>
        </View>
      </TouchableOpacity>
      <IconButton
        icon="bookmark"
        label={`${pinned ? 'Odepnij' : 'Przypnij'} tabelę ${table.title}`}
        onPress={() => togglePin({ baseId, baseTitle: baseName, tableId: table.id, title: table.title })}
        theme={theme}
        size={20}
        color={pinned ? theme.accent : theme.textFaint}
        style={[styles.pinBtn, pinned && { backgroundColor: theme.accentSoft }]}
      />
    </View>
  );
}

export default function TableSelectScreen({ route, navigation }) {
  const { baseId, baseName } = route.params;
  const { tables, loading, error, reload } = useTables(baseId);
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');

  const q = query.trim().toLowerCase();
  const shown = useMemo(() => tables.filter((tb) => !q || String(tb.title).toLowerCase().includes(q)), [tables, q]);

  return (
    <View style={[styles.flex, { backgroundColor: theme.bg }]}>
      <TopBar onBack={() => navigation.goBack()} backLabel="Bazy" theme={theme} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={<RefreshControl refreshing={loading && tables.length > 0} onRefresh={reload} tintColor={theme.accent} colors={[theme.accent]} />}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={[styles.headTile, { backgroundColor: theme.accentSoft }]}>
            <Icon name="database" size={24} color={theme.accent} />
          </View>
          <View style={styles.flex}>
            <Text style={[t(26, 'extrabold'), { color: theme.text, letterSpacing: -0.5 }]} numberOfLines={1}>{baseName}</Text>
            <Text style={[t(14, 'medium'), { color: theme.textSecondary }]}>
              {loading && !tables.length ? 'Wczytywanie…' : `${tables.length} ${plural(tables.length, 'tabela', 'tabele', 'tabel')}`}
            </Text>
          </View>
        </View>

        <SearchField value={query} onChangeText={setQuery} placeholder="Szukaj tabeli" theme={theme} />

        {loading && !tables.length ? (
          <ActivityIndicator style={styles.loading} color={theme.accent} />
        ) : error ? (
          <Card theme={theme} style={styles.errorCard}>
            <Text style={[t(15, 'bold'), { color: theme.error }]}>Nie udało się wczytać tabel</Text>
            <Text style={[t(14, 'medium'), { color: theme.textSecondary }]}>{error}</Text>
            <PrimaryButton label="Spróbuj ponownie" onPress={reload} theme={theme} height={46} />
          </Card>
        ) : shown.length === 0 ? (
          <Text style={[t(14, 'medium'), { color: theme.textMuted }]}>{q ? `Brak tabel pasujących do „${query}”.` : 'Ta baza nie ma tabel.'}</Text>
        ) : (
          <Card theme={theme}>
            {shown.map((tb, i) => (
              <TableRow
                key={tb.id}
                table={tb}
                baseId={baseId}
                baseName={baseName}
                first={i === 0}
                onOpen={() => navigation.navigate('Table', { baseId, baseName, tableId: tb.id, tableName: tb.title })}
                theme={theme}
              />
            ))}
          </Card>
        )}

        <Text style={[t(13, 'medium'), styles.hint, { color: theme.textMuted }]}>Przypięte tabele pojawiają się na ekranie startowym.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingHorizontal: 20, gap: 16 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4 },
  headTile: { width: 48, height: 48, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowMain: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: 72, paddingLeft: 16, paddingRight: 4 },
  rowText: { flex: 1, minWidth: 0, gap: 3 },
  tile: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pinBtn: { marginRight: 8 },
  loading: { paddingVertical: 32 },
  errorCard: { padding: 16, gap: 10 },
  hint: { paddingHorizontal: 4 },
});
