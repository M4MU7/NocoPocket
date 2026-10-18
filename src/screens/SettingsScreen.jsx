import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView,
  Switch, StyleSheet, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { useSettings } from '../context/SettingsContext';
import { useTheme } from '../theme/ThemeContext';

function SectionHeader({ label, theme }) {
  return <Text style={[styles.sectionHeader, { color: theme.sectionLabel }]}>{label}</Text>;
}

function SettingInput({ label, value, onChangeText, placeholder, secureTextEntry, keyboardType, theme }) {
  return (
    <View style={[styles.inputGroup, { borderBottomColor: theme.borderLight }]}>
      <Text style={[styles.inputLabel, { color: theme.textMuted }]}>{label}</Text>
      <TextInput
        style={[styles.input, {
          backgroundColor: theme.inputBg,
          borderColor: theme.inputBorder,
          color: theme.inputText,
        }]}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={theme.inputPlaceholder}
        secureTextEntry={secureTextEntry}
        keyboardType={keyboardType}
        autoCapitalize="none"
        autoCorrect={false}
      />
    </View>
  );
}

export default function SettingsScreen() {
  const { settings, save, reset } = useSettings();
  const { theme, isDark, toggle } = useTheme();

  const [form, setForm] = useState({ ...settings });

  useEffect(() => { setForm({ ...settings }); }, [settings]);

  const set = (key) => (val) => setForm((f) => ({ ...f, [key]: val }));

  const handleSave = async () => {
    if (!form.baseUrl || !form.apiToken) {
      Alert.alert('Błąd', 'URL serwera i klucz API są wymagane.');
      return;
    }
    await save(form);
    Alert.alert('Zapisano', 'Ustawienia zostały zapisane.');
  };

  const handleReset = () => {
    Alert.alert(
      'Resetuj ustawienia',
      'Przywrócić ustawienia domyślne? Adres serwera i token zostaną usunięte z telefonu.',
      [
        { text: 'Anuluj', style: 'cancel' },
        { text: 'Resetuj', style: 'destructive', onPress: reset },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.flex, { backgroundColor: theme.bg }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>

        {/* WYGLĄD */}
        <SectionHeader label="WYGLĄD" theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.settingGroupBg, borderColor: theme.border }]}>
          <View style={styles.switchRow}>
            <View>
              <Text style={[styles.switchLabel, { color: theme.text }]}>Ciemny motyw</Text>
              <Text style={[styles.switchSub, { color: theme.textMuted }]}>
                {isDark ? 'Włączony' : 'Wyłączony'}
              </Text>
            </View>
            <Switch
              value={isDark}
              onValueChange={toggle}
              trackColor={{ true: theme.switchTrackTrue, false: theme.switchTrackFalse }}
              thumbColor={theme.switchThumb}
            />
          </View>
        </View>

        {/* POŁĄCZENIE */}
        <SectionHeader label="POŁĄCZENIE Z NOCODB" theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.settingGroupBg, borderColor: theme.border }]}>
          <SettingInput
            label="URL serwera"
            value={form.baseUrl}
            onChangeText={set('baseUrl')}
            placeholder="https://twoja-instancja.com"
            theme={theme}
          />
          <SettingInput
            label="Klucz API (xc-token)"
            value={form.apiToken}
            onChangeText={set('apiToken')}
            placeholder="Twój token API"
            secureTextEntry
            theme={theme}
          />
          <SettingInput
            label="Workspace ID (default = wszystkie dostępne)"
            value={form.workspaceId}
            onChangeText={set('workspaceId')}
            placeholder="default"
            theme={theme}
          />
        </View>

        {/* POLA */}
        <SectionHeader label="POLA TABEL" theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.settingGroupBg, borderColor: theme.border }]}>
          <SettingInput
            label="Nazwa pola Status (SingleSelect – włącza widok Kanban)"
            value={form.statusField}
            onChangeText={set('statusField')}
            placeholder="Status"
            theme={theme}
          />
          <SettingInput
            label="Nazwa pola Tytuł (gdy brak – pole główne tabeli)"
            value={form.titleField}
            onChangeText={set('titleField')}
            placeholder="Title"
            theme={theme}
          />
          <SettingInput
            label="Nazwa pola Opis"
            value={form.descriptionField}
            onChangeText={set('descriptionField')}
            placeholder="Description"
            theme={theme}
          />
        </View>

        {/* WYŚWIETLANIE */}
        <SectionHeader label="WYŚWIETLANIE" theme={theme} />
        <View style={[styles.card, { backgroundColor: theme.settingGroupBg, borderColor: theme.border }]}>
          <SettingInput
            label="Max. znaków opisu na karcie"
            value={form.descriptionMaxChars}
            onChangeText={set('descriptionMaxChars')}
            placeholder="120"
            keyboardType="numeric"
            theme={theme}
          />
          <SettingInput
            label="Rekordów na stronę"
            value={form.pageSize}
            onChangeText={set('pageSize')}
            placeholder="50"
            keyboardType="numeric"
            theme={theme}
          />
        </View>

        {/* ZAPISZ */}
        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: theme.accent }]}
          onPress={handleSave}
          activeOpacity={0.85}
        >
          <Text style={[styles.saveBtnText, { color: theme.accentText }]}>Zapisz ustawienia</Text>
        </TouchableOpacity>

        {/* RESET */}
        <TouchableOpacity
          style={[styles.resetBtn, { backgroundColor: theme.danger, borderColor: theme.dangerBorder }]}
          onPress={handleReset}
          activeOpacity={0.85}
        >
          <Text style={[styles.resetBtnText, { color: theme.dangerText }]}>Przywróć domyślne</Text>
        </TouchableOpacity>

        <View style={styles.bottomSpace} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 48 },
  sectionHeader: {
    fontSize: 11, fontWeight: '700', letterSpacing: 1,
    marginTop: 24, marginBottom: 8, marginLeft: 4,
  },
  card: {
    borderRadius: 14, borderWidth: 1,
    overflow: 'hidden',
  },
  switchRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16, paddingVertical: 14,
  },
  switchLabel: { fontSize: 15, fontWeight: '600' },
  switchSub: { fontSize: 12, marginTop: 2 },
  inputGroup: {
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: 1,
  },
  inputLabel: { fontSize: 11, fontWeight: '600', letterSpacing: 0.4, marginBottom: 6 },
  input: {
    borderRadius: 8, borderWidth: 1,
    paddingHorizontal: 12, paddingVertical: 9,
    fontSize: 14,
  },
  saveBtn: {
    marginTop: 28, borderRadius: 12,
    paddingVertical: 15, alignItems: 'center',
  },
  saveBtnText: { fontSize: 15, fontWeight: '700' },
  resetBtn: {
    marginTop: 12, borderRadius: 12, borderWidth: 1,
    paddingVertical: 13, alignItems: 'center',
  },
  resetBtnText: { fontSize: 14, fontWeight: '600' },
  bottomSpace: { height: 32 },
});
