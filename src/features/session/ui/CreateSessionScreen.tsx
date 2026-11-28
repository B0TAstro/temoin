import { router } from 'expo-router';
import { type ReactNode, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/ui/Button';
import { Chip } from '@/shared/ui/Chip';
import { IconButton } from '@/shared/ui/IconButton';
import { ScreenTitle } from '@/shared/ui/ScreenTitle';
import { TextField } from '@/shared/ui/TextField';
import { colors, fonts, space, type } from '@/shared/ui/theme';
import { DEFAULT_FORM, type SetupForm } from '@/sports/tennis';

import { newSession } from '../newSession';
import { encodeForm } from '../setup';
import { DEFAULT_DOUBLES, type DoublesDraft, DoublesTeams } from './DoublesTeams';

const STEPS = ['Type de match', 'Le terrain', 'Les joueurs'] as const;

/** UI only: the format is shown as in the mockup, the score knows singles in 3 sets */
type Format = { doubles: boolean; bestOf: 3 | 5 };

/** Three short steps, everything prefilled: the first point is filmed in under a minute */
export function CreateSessionScreen() {
  const [form, setForm] = useState<SetupForm>(DEFAULT_FORM);
  const [step, setStep] = useState(0);
  const [format, setFormat] = useState<Format>({ doubles: false, bestOf: 3 });
  const [doubles, setDoubles] = useState<DoublesDraft>(DEFAULT_DOUBLES);
  const update = (patch: Partial<SetupForm>) => setForm((previous) => ({ ...previous, ...patch }));
  const last = step === STEPS.length - 1;
  // The key is worked out from the phrase: a fraction of a second, during which « Créer » waits
  const [creating, setCreating] = useState(false);

  const back = () => (step > 0 ? setStep(step - 1) : router.back());
  const create = async () => {
    setCreating(true);
    const { phrase, sessionId, key } = await newSession();
    router.replace({
      pathname: '/match',
      params: {
        role: 'host',
        s: sessionId,
        k: key,
        p: phrase,
        form: encodeForm(toForm(form, format, doubles)),
      },
    });
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <IconButton icon="back" label="Retour" variant="plain" onPress={back} />
        <IconButton icon="close" label="Fermer" variant="plain" onPress={() => router.back()} />
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ScreenTitle
          section={`Nouvelle session · ${step + 1}/${STEPS.length}`}
          title={step === 2 && format.doubles ? 'Les équipes' : (STEPS[step] ?? '')}
        />

        {step === 0 && (
          <View style={styles.fields}>
            <Field label="Format">
              <Choice
                options={[
                  { value: false, label: 'Simple' },
                  { value: true, label: 'Double' },
                ]}
                value={format.doubles}
                onChange={(doubles) => setFormat({ ...format, doubles })}
              />
            </Field>
            <Field label="Nombre de sets">
              <Choice
                options={[
                  { value: '3', label: '3 sets' },
                  { value: '5', label: '5 sets' },
                ]}
                value={String(format.bestOf)}
                onChange={(bestOf) => setFormat({ ...format, bestOf: bestOf === '5' ? 5 : 3 })}
              />
            </Field>
            <Field label="Dernier set">
              <Choice
                options={[
                  { value: true, label: 'Super tie-break' },
                  { value: false, label: 'Set normal' },
                ]}
                value={form.superTieBreak}
                onChange={(superTieBreak) => update({ superTieBreak })}
              />
            </Field>
            <Field label="À 40-40">
              <Choice
                options={[
                  { value: false, label: 'Avantage' },
                  { value: true, label: 'Point décisif' },
                ]}
                value={form.noAd}
                onChange={(noAd) => update({ noAd })}
              />
            </Field>
          </View>
        )}

        {step === 1 && (
          <View style={styles.fields}>
            <Field label="Lieu">
              <Choice
                options={[
                  { value: 'indoor', label: 'Intérieur' },
                  { value: 'outdoor', label: 'Extérieur' },
                ]}
                value={form.court.place}
                onChange={(place) => update({ court: { ...form.court, place } })}
              />
            </Field>
            <Field label="Surface">
              <Choice
                options={[
                  { value: 'grass', label: 'Gazon' },
                  { value: 'hard', label: 'Dur' },
                  { value: 'dirt', label: 'Terre battue' },
                ]}
                value={form.court.surface}
                onChange={(surface) => update({ court: { ...form.court, surface } })}
              />
            </Field>
            <Text style={styles.hint}>
              Ces informations aident l&apos;app à régler la détection selon la lumière et la
              couleur du sol.
            </Text>
          </View>
        )}

        {step === 2 && format.doubles && <DoublesTeams draft={doubles} onChange={setDoubles} />}

        {step === 2 && !format.doubles && (
          <View style={styles.fields}>
            <Field label="Joueurs">
              <View style={styles.names}>
                <TextField
                  value={form.nameA}
                  onChangeText={(nameA) => update({ nameA })}
                  placeholder="Prénom ou initiales"
                  maxLength={16}
                />
                <TextField
                  value={form.nameB}
                  onChangeText={(nameB) => update({ nameB })}
                  placeholder="Prénom ou initiales"
                  maxLength={16}
                />
              </View>
            </Field>
            <Field label="Premier serveur">
              <Choice
                options={[
                  { value: 'A', label: form.nameA || 'Joueur A' },
                  { value: 'B', label: form.nameB || 'Joueur B' },
                ]}
                value={form.firstServer}
                onChange={(firstServer) => update({ firstServer })}
              />
            </Field>
            <Text style={styles.hint}>
              Prénoms ou initiales uniquement. Rien n&apos;est enregistré après le match.
            </Text>
          </View>
        )}
      </ScrollView>

      <View style={styles.footer}>
        <Steps count={STEPS.length} current={step} />
        <View style={styles.buttons}>
          {step > 0 && (
            <Button label="Retour" variant="ghost" onPress={back} style={styles.backButton} />
          )}
          <Button
            label={last ? (creating ? '…' : 'Créer') : 'Suivant'}
            disabled={creating}
            onPress={last ? () => void create() : () => setStep(step + 1)}
            style={styles.nextButton}
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

/**
 * UI only: 5 sets and doubles are not scored yet. In doubles, the match is played between the two
 * team names, and the first server's team serves first
 */
function toForm(form: SetupForm, format: Format, doubles: DoublesDraft): SetupForm {
  if (!format.doubles) return form;
  const server = doubles.players[doubles.firstServer];
  return {
    ...form,
    nameA: doubles.teams.A || 'Équipe A',
    nameB: doubles.teams.B || 'Équipe B',
    firstServer: server?.team ?? 'A',
    teams: {
      A: doubles.players
        .filter((p) => p.team === 'A')
        .map((p) => p.name)
        .filter(Boolean),
      B: doubles.players
        .filter((p) => p.team === 'B')
        .map((p) => p.name)
        .filter(Boolean),
    },
  };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      {children}
    </View>
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
  // Three choices in a row: tighter, smaller text (Figma)
  const compact = options.length > 2;
  return (
    <View style={[styles.choice, compact && styles.choiceCompact]}>
      {options.map((option) => (
        <Chip
          key={String(option.value)}
          label={option.label}
          selected={option.value === value}
          compact={compact}
          onPress={() => onChange(option.value)}
        />
      ))}
    </View>
  );
}

/** Where we are: the current step is a lemon bar, the steps done are brighter than the ones to come */
function Steps({ count, current }: { count: number; current: number }) {
  return (
    <View style={styles.steps}>
      {Array.from({ length: count }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i < current && styles.dotDone, i === current && styles.dotCurrent]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 12 },
  content: { paddingHorizontal: space.l, paddingTop: space.l, gap: 32 },
  fields: { gap: space.l },
  field: { gap: 12 },
  label: { ...type.section, color: colors.textDim },
  names: { gap: 12 },
  choice: { flexDirection: 'row', gap: 12 },
  choiceCompact: { gap: space.s },
  hint: { fontFamily: fonts.light, fontSize: 14, lineHeight: 21, color: colors.textSoft },
  footer: { paddingHorizontal: space.l, paddingBottom: space.l, gap: 32 },
  steps: { flexDirection: 'row', justifyContent: 'center', gap: space.s },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.25)' },
  dotDone: { backgroundColor: colors.textSoft },
  dotCurrent: { width: 20, backgroundColor: colors.accent },
  buttons: { flexDirection: 'row', gap: 12 },
  backButton: { width: 112 },
  nextButton: { flex: 1 },
});
