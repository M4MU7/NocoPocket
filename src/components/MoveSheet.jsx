import React from 'react';
import { Modal, View, Text, TouchableOpacity, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getContrastColor } from '../utils/fieldTypes';
import { Icon } from './ui';
import { t } from '../theme/typography';

/** Arkusz „Przenieś do kolumny” – zmiana statusu karty po przytrzymaniu */
export default function MoveSheet({ visible, title, columns, current, moving, onMove, onClose, theme }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Zamknij" />
      <View style={[styles.sheet, { backgroundColor: theme.surface, paddingBottom: insets.bottom + 16 }]}>
        <View style={[styles.grabber, { backgroundColor: theme.borderStrong }]} />
        <Text style={[t(13, 'bold'), { color: theme.textMuted }]} numberOfLines={1}>{title}</Text>
        <Text style={[t(18, 'extrabold'), { color: theme.text, marginBottom: 6 }]}>Przenieś do kolumny</Text>
        {columns.map((c) => {
          const isCurrent = c.title === current;
          const bg = c.color ?? theme.sunken;
          return (
            <TouchableOpacity
              key={c.title}
              onPress={() => !isCurrent && onMove(c.title)}
              disabled={moving}
              style={[styles.option, { borderColor: isCurrent ? theme.accent : theme.border, backgroundColor: isCurrent ? theme.accentSoft : theme.surface }]}
              accessibilityRole="button"
              accessibilityState={{ selected: isCurrent }}
            >
              <View style={[styles.pill, { backgroundColor: bg }]}>
                <Text style={[t(14, 'extrabold'), { color: getContrastColor(bg) }]} numberOfLines={1}>{c.title}</Text>
              </View>
              <View style={styles.flex} />
              {isCurrent ? <Text style={[t(13, 'bold'), { color: theme.accentStrong }]}>obecna</Text> : null}
              {moving === c.title ? <ActivityIndicator size="small" color={theme.accent} /> : null}
              {isCurrent ? <Icon name="check" size={18} color={theme.accentStrong} /> : null}
            </TouchableOpacity>
          );
        })}
        <TouchableOpacity onPress={onClose} style={styles.cancel} accessibilityRole="button">
          <Text style={[t(15, 'bold'), { color: theme.textSecondary }]}>Anuluj</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { flex: 1, backgroundColor: 'rgba(15,17,23,0.45)' },
  sheet: { paddingHorizontal: 16, paddingTop: 10, borderTopLeftRadius: 24, borderTopRightRadius: 24, gap: 8 },
  grabber: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, marginBottom: 8 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 56, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  pill: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999, flexShrink: 1 },
  cancel: { height: 48, alignItems: 'center', justifyContent: 'center' },
});
