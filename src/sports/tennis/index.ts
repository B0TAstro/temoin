export { expectedPhrasings, fullScorePhrasings } from './announce';
export { pointText, roleLabel, scoreLabel, sideName } from './labels';
export type { MatchSetup, SetupForm } from './matchSetup';
export { DEFAULT_FORM, toMatchSetup } from './matchSetup';
export type { Candidate } from './stateMachine';
export {
  applyPoint,
  createMatch,
  isNearJump,
  nextCandidates,
  plausibleStates,
  stateKey,
} from './stateMachine';
export type { MatchConfig, MatchState, Side, SideId } from './types';
