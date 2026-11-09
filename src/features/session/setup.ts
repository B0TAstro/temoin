import type { MatchSetup } from '@/core/events/matchLog';
import type { MatchConfig } from '@/core/score/types';

export type SetupForm = {
  nameA: string;
  nameB: string;
  /** Match tie-break to 10 instead of a third set. */
  superTieBreak: boolean;
  /** Sudden death at 40-40. */
  noAd: boolean;
  firstServer: 'A' | 'B';
};

export const DEFAULT_FORM: SetupForm = {
  nameA: 'Joueur A',
  nameB: 'Joueur B',
  superTieBreak: true,
  noAd: false,
  firstServer: 'A',
};

/** Singles for now: a side holds one player, doubles will add the second one. */
export function toSetup(form: SetupForm): MatchSetup {
  const config: MatchConfig = {
    sides: [
      { id: 'A', players: [{ id: 'a1', name: form.nameA.trim() || 'Joueur A' }] },
      { id: 'B', players: [{ id: 'b1', name: form.nameB.trim() || 'Joueur B' }] },
    ],
    gamesToWinSet: 6,
    noAd: form.noAd,
    setsToWinMatch: 2,
    tieBreakAt: 6,
    tieBreakTarget: 7,
    superTieBreakTarget: form.superTieBreak ? 10 : null,
  };
  return { config, firstServer: form.firstServer };
}

/** The setup travels to the match screen as a route parameter. */
export const encodeForm = (form: SetupForm) => JSON.stringify(form);

export function decodeForm(raw: string | undefined): SetupForm {
  if (raw == null) return DEFAULT_FORM;
  try {
    return { ...DEFAULT_FORM, ...(JSON.parse(raw) as Partial<SetupForm>) };
  } catch {
    return DEFAULT_FORM;
  }
}
