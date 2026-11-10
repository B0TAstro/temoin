import type { MatchState, Point, SideId } from './types';

const POINT: Record<string, string> = { '0': '0', '15': '15', '30': '30', '40': '40', AD: 'AV' };

/** What the points column shows for one side: normal game or tie-break. */
export function pointText(state: MatchState, side: SideId): string {
  if (state.tieBreak !== undefined) return String(state.tieBreak.points[side]);
  return POINT[String(state.points[side] as Point)] ?? '';
}

export function sideName(state: MatchState, side: SideId): string {
  const players = state.config.sides.find((s) => s.id === side)?.players ?? [];
  return players.map((player) => player.name).join(' / ') || side;
}

/** Follows the service: roles swap every game, so a fixed label would turn wrong. */
export function roleLabel(state: MatchState, side: SideId): string {
  return state.server === side ? 'Serveur' : 'Relanceur';
}

/** Where the match stands, e.g. "Set 1 · Jeu 4 · 30-15" or "Set 2 · Tie-break · 3-2". */
export function scoreLabel(state: MatchState): string {
  const [a, b] = state.config.sides;
  const set = (state.sets[a.id] ?? 0) + (state.sets[b.id] ?? 0) + 1;
  const points = `${pointText(state, a.id)}-${pointText(state, b.id)}`;
  if (state.tieBreak?.isSuper) return `Super tie-break · ${points}`;
  if (state.tieBreak !== undefined) return `Set ${set} · Tie-break · ${points}`;
  const game = (state.games[a.id] ?? 0) + (state.games[b.id] ?? 0) + 1;
  return `Set ${set} · Jeu ${game} · ${points}`;
}
