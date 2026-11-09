import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { newSessionId } from '@/features/session/joinLink';
import { DEFAULT_FORM, encodeForm, type SetupForm } from '@/features/session/setup';
import { Button } from '@/ui/Button';
import { colors, radius, touch } from '@/ui/theme';

/** One screen, everything prefilled: the first point is filmed in under a minute. */
export default function Create() {
  const [form, setForm] = useState<SetupForm>(DEFAULT_FORM);
  const update = (patch: Partial<SetupForm>) => setForm((previous) => ({ ...previous, ...patch }));

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={styles.title}>Nouvelle session</Text>

        <Text style={styles.label}>Joueurs (prénoms ou initiales)</Text>
        <TextInput
          style={styles.input}
          value={form.nameA}
          onChangeText={(nameA) => update({ nameA })}
          placeholder="Joueur A"
          placeholderTextColor={colors.lineDim}
          maxLength={16}
        />
        <TextInput
          style={styles.input}
          value={form.nameB}
          onChangeText={(nameB) => update({ nameB })}
          placeholder="Joueur B"
          placeholderTextColor={colors.lineDim}
          maxLength={16}
        />

        <Text style={styles.label}>Premier serveur</Text>
        <Choice
          options={[
            { value: 'A', label: form.nameA || 'Joueur A' },
            { value: 'B', label: form.nameB || 'Joueur B' },
          ]}
          value={form.firstServer}
          onChange={(firstServer) => update({ firstServer })}
        />

        <Text style={styles.label}>Troisième set</Text>
        <Choice
          options={[
            { value: true, label: 'Super tie-break' },
            { value: false, label: 'Set complet' },
          ]}
          value={form.superTieBreak}
          onChange={(superTieBreak) => update({ superTieBreak })}
        />

        <Text style={styles.label}>À 40-40</Text>
        <Choice
          options={[
            { value: false, label: 'Avantage' },
            { value: true, label: 'Point décisif' },
          ]}
          value={form.noAd}
          onChange={(noAd) => update({ noAd })}
        />
      </ScrollView>

      <View style={styles.footer}>
        <Button
          label="Créer"
          onPress={() =>
            router.replace({
              pathname: '/match',
              params: { role: 'host', s: newSessionId(), form: encodeForm(form) },
            })
          }
        />
      </View>
    </SafeAreaView>
  );
}

function Choice<T extends string | boolean>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <View style={styles.choice}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            onPress={() => onChange(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.optionText, selected && styles.optionTextSelected]}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink },
  content: { padding: 24, gap: 12 },
  title: { color: colors.line, fontSize: 28, fontWeight: '800', marginBottom: 8 },
  label: { color: colors.lineDim, fontSize: 16, marginTop: 12 },
  input: {
    backgroundColor: colors.inkSoft,
    borderRadius: radius,
    minHeight: touch,
    paddingHorizontal: 16,
    color: colors.line,
    fontSize: 20,
  },
  choice: { flexDirection: 'row', gap: 16 },
  option: {
    flex: 1,
    minHeight: touch,
    borderRadius: radius,
    borderWidth: 2,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  optionSelected: { backgroundColor: colors.line },
  optionText: { color: colors.line, fontSize: 18, fontWeight: '700' },
  optionTextSelected: { color: colors.ink },
  footer: { padding: 24 },
});
