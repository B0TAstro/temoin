/** Identifies one side of the net. Always two, in singles as in doubles. */
export type SideId = string;

/** A side holds 1..n players, so doubles needs no change here. */
export interface Player {
  id: string;
  name: string;
}

export interface Side {
  id: SideId;
  players: Player[];
}

/** 'AD' = advantage. There is no 45: tennis goes from 40 to advantage. */
export type Point = 0 | 15 | 30 | 40 | 'AD';

export interface MatchConfig {
  sides: [Side, Side];
  gamesToWinSet: number;
  /** true = sudden death at 40-40, no advantage. */
  noAd: boolean;
  /** Sets needed to take the match. 2 = best of three. */
  setsToWinMatch: number;
  /** Games each at which a tie-break starts. */
  tieBreakAt: number;
  /** Points needed to take a tie-break, still with two clear. */
  tieBreakTarget: number;
  /**
   * Points needed to take the match tie-break that replaces the deciding set (usually 10), or null
   * to play the deciding set in full.
   */
  superTieBreakTarget: number | null;
}

export interface MatchState {
  config: MatchConfig;
  server: SideId;
  points: Record<SideId, Point>;
  games: Record<SideId, number>;
  sets: Record<SideId, number>;
  /** Games played since the start of the match, all sets together: decides the changes of ends. */
  gamesPlayed: number;
  /** Present only while a tie-break is being played. */
  tieBreak?: TieBreak;
  /** Set once a side takes the match. Nothing moves after that. */
  matchWonBy?: SideId;
}

export interface TieBreak {
  points: Record<SideId, number>;
  /** Who served the first point. Decides the rotation, and who serves next set. */
  starter: SideId;
  /** Points needed to take it, with two clear. */
  target: number;
  /** A match tie-break: it replaces the deciding set and wins it on its own. */
  isSuper: boolean;
}
