/**
 * Wspólne elementy interfejsu NocoPocket (wg projektu „nowy layout i UX”).
 */
import React from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet,
} from 'react-native';
import Feather from '@expo/vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../theme/typography';

export function Icon({ name, size = 20, color }) {
  return <Feather name={name} size={size} color={color} />;
}

/** Pasek górny: link „‹ Wstecz” (backLabel) lub sama strzałka, tytuł i akcje po prawej */
export function TopBar({ onBack, backLabel, title, subtitle, right, theme, inset = true }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.topBar, { paddingTop: (inset ? insets.top : 0) + 8 }]}>
      {onBack && (backLabel ? (
        <TouchableOpacity onPress={onBack} style={styles.backLink} accessibilityRole="button" accessibilityLabel={`Wróć: ${backLabel}`}>
          <Icon name="chevron-left" size={24} color={theme.accent} />
          <Text style={[t(15, 'bold'), { color: theme.accent }]}>{backLabel}</Text>
        </TouchableOpacity>
      ) : (
        <IconButton icon="chevron-left" label="Wróć" onPress={onBack} theme={theme} size={24} />
      ))}
      {title ? (
        <View style={styles.topBarTitle}>
          <Text style={[t(20, 'extrabold'), { color: theme.text }]} numberOfLines={1}>{title}</Text>
          {subtitle ? <Text style={[t(13, 'medium'), { color: theme.textSecondary, marginTop: 1 }]} numberOfLines={1}>{subtitle}</Text> : null}
        </View>
      ) : <View style={styles.flex} />}
      {right}
    </View>
  );
}

/** Pasek formularza/modala: tekstowe „Anuluj” po lewej, tytuł na środku */
export function SheetBar({ onCancel, cancelLabel = 'Anuluj', title, subtitle, right, theme, disabled }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.sheetBar, { paddingTop: insets.top + 8, borderBottomColor: theme.borderLight }]}>
      <TouchableOpacity onPress={onCancel} disabled={disabled} style={styles.sheetSide} accessibilityRole="button">
        <Text style={[t(15, 'bold'), { color: theme.textSecondary }]}>{cancelLabel}</Text>
      </TouchableOpacity>
      <View style={styles.sheetTitle}>
        <Text style={[t(17, 'extrabold'), { color: theme.text }]} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={[t(12, 'medium'), { color: theme.textMuted, marginTop: 1 }]} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      <View style={[styles.sheetSide, styles.sheetRight]}>{right}</View>
    </View>
  );
}

export function IconButton({ icon, label, onPress, theme, size = 22, variant = 'plain', color, disabled, style }) {
  const bordered = variant === 'bordered';
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={4}
      style={[
        styles.iconBtn,
        bordered && { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
        variant === 'soft' && { backgroundColor: theme.surface },
        disabled && { opacity: 0.4 },
        style,
      ]}
    >
      <Icon name={icon} size={size} color={color ?? theme.text} />
    </TouchableOpacity>
  );
}

export function SearchField({ value, onChangeText, placeholder, theme, autoFocus, active, height = 48 }) {
  return (
    <View style={[styles.search, {
      height,
      backgroundColor: active ? theme.surfaceAlt : theme.surface,
      borderColor: active ? theme.accent : theme.border,
      borderWidth: active ? 1.5 : 1,
    }]}
    >
      <Icon name="search" size={19} color={theme.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.textMuted}
        autoFocus={autoFocus}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        accessibilityLabel={placeholder}
        style={[styles.searchInput, t(15, 'medium'), { color: theme.text }]}
      />
      {value ? (
        <IconButton icon="x" label="Wyczyść wyszukiwanie" onPress={() => onChangeText('')} theme={theme} size={18} color={theme.textSecondary} style={styles.searchClear} />
      ) : null}
    </View>
  );
}

/** Przełącznik segmentowy: options = [{ key, label, icon }] */
export function Segmented({ options, value, onChange, theme, compact }) {
  return (
    <View style={[styles.segment, { backgroundColor: theme.segment }]} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <TouchableOpacity
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={o.a11y ?? o.label}
            style={[
              styles.segmentItem,
              compact ? styles.segmentCompact : styles.segmentWide,
              on && [styles.segmentOn, { backgroundColor: theme.surface, shadowColor: theme.shadow }],
            ]}
          >
            {o.icon ? <Icon name={o.icon} size={17} color={on ? theme.text : theme.textSecondary} /> : null}
            {o.label && !compact ? <Text style={[t(14, 'bold'), { color: on ? theme.text : theme.textSecondary }]}>{o.label}</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function Chip({ label, icon, active, onPress, onRemove, theme, disabled }) {
  return (
    <TouchableOpacity
      onPress={onRemove ?? onPress}
      disabled={disabled || (!onPress && !onRemove)}
      accessibilityRole="button"
      accessibilityLabel={onRemove ? `Usuń: ${label}` : label}
      style={[styles.chip, active
        ? { backgroundColor: theme.accentSoft }
        : { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.borderStrong }]}
    >
      {icon ? <Icon name={icon} size={15} color={active ? theme.accentStrong : theme.text} /> : null}
      <Text style={[t(13, 'bold'), { color: active ? theme.accentStrong : theme.text }]}>{label}</Text>
      {onRemove ? <Icon name="x" size={15} color={theme.accentStrong} /> : null}
    </TouchableOpacity>
  );
}

export function Pill({ label, bg, fg, size = 12 }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[t(size, 'extrabold'), { color: fg }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export function SectionLabel({ children, theme, style }) {
  return <Text style={[styles.sectionLabel, t(12, 'extrabold'), { color: theme.textMuted }, style]}>{children}</Text>;
}

export function Card({ children, theme, style }) {
  return <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }, style]}>{children}</View>;
}

export function PrimaryButton({ label, icon, onPress, loading, disabled, theme, style, height = 52 }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      style={[styles.primary, { height, backgroundColor: theme.accent, opacity: disabled ? 0.45 : 1 }, style]}
      activeOpacity={0.85}
    >
      {loading ? <ActivityIndicator color={theme.accentText} /> : (
        <>
          {icon ? <Icon name={icon} size={19} color={theme.accentText} /> : null}
          <Text style={[t(16, 'extrabold'), { color: theme.accentText }]}>{label}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}

// ── Awatary z inicjałami (kolor zależny od tekstu) ──
const AVATAR_COLORS = [
  ['#ECEEFE', '#2A33A8'], ['#E2F4EF', '#0B5F4E'], ['#FDECF2', '#A3174A'],
  ['#FDF0E2', '#8A4200'], ['#F1E9FB', '#5E2D9C'], ['#E6F2FD', '#0B4F8A'],
];

export function initialsOf(text) {
  const words = String(text ?? '').split(/[\s,.;:()[\]{}"'#@&+\-_/]+/).filter(Boolean);
  if (!words.length) return '#';
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase();
}

export function Avatar({ text, size = 32 }) {
  let h = 0;
  for (const ch of String(text ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const [bg, fg] = AVATAR_COLORS[h % AVATAR_COLORS.length];
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={[t(Math.round(size * 0.36), 'extrabold'), { color: fg }]}>{initialsOf(text)}</Text>
    </View>
  );
}

/** Polska odmiana: plural(2, 'rekord', 'rekordy', 'rekordów') → 'rekordy' */
export function plural(n, one, few, many) {
  if (n === 1) return one;
  const d = n % 10; const dd = n % 100;
  return d >= 2 && d <= 4 && !(dd >= 12 && dd <= 14) ? few : many;
}

/** Kolor z NocoDB (#RRGGBB) jako jasne tło kafelka */
export function tint(hex, alpha = '22') {
  return /^#[0-9a-f]{6}$/i.test(hex ?? '') ? `${hex}${alpha}` : null;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingBottom: 4 },
  backLink: { flexDirection: 'row', alignItems: 'center', height: 44, paddingRight: 10, paddingLeft: 2 },
  topBarTitle: { flex: 1, minWidth: 0, paddingLeft: 2 },
  sheetBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 8, borderBottomWidth: 1 },
  sheetSide: { minWidth: 84, height: 44, justifyContent: 'center', paddingHorizontal: 10 },
  sheetRight: { alignItems: 'flex-end' },
  sheetTitle: { flex: 1, alignItems: 'center' },
  iconBtn: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 14, paddingRight: 4, borderRadius: 14 },
  searchInput: { flex: 1, minWidth: 0, paddingVertical: 0 },
  searchClear: { width: 40, height: 40 },
  segment: { flexDirection: 'row', padding: 3, gap: 3, borderRadius: 12 },
  segmentItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 38, borderRadius: 10 },
  segmentWide: { flex: 1 },
  segmentCompact: { width: 42, height: 36 },
  segmentOn: { shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.12, shadowRadius: 2, elevation: 1 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 999 },
  pill: { alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999, maxWidth: 220 },
  sectionLabel: { letterSpacing: 1, textTransform: 'uppercase' },
  card: { borderWidth: 1, borderRadius: 16, overflow: 'hidden' },
  primary: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 16, paddingHorizontal: 24 },
});
