import { Store } from '@/shared/lib/Store';
import { type MatchState, scoreLabel, type SideId, sideName } from '@/sports/tennis';

import { staticGrammar } from './logic/grammar';
import { decide, pointsBetween } from './logic/match';
import type { CreateSpeechEngine, SpeechEngine } from './native/SpeechEngine';

export type VoiceStatus = 'off' | 'starting' | 'listening' | 'error';

/** What was heard last, and what the app did with it, shown under the score. */
export type Heard = { text: string; result: string };

export type VoiceState = {
  status: VoiceStatus;
  error: string | undefined;
  /** What the recognizer is hearing right now, before the call ends. */
  partial: string;
  heard: Heard | undefined;
};

/** What the match tells the voice at every render. */
export type VoiceInput = {
  state: MatchState;
  enabled: boolean;
  /** Called with the winners of the points the call ends, in order (1, or 2 after a missed call). */
  onPoints: (winners: SideId[]) => void;
};

const OFF: VoiceState = { status: 'off', error: undefined, partial: '', heard: undefined };

/**
 * Listens to the server's call and turns it into points (chain from the voice POC): the engine
 * turns the voice into text against a grammar derived from the score, then `decide` compares the
 * text with the two possible next scores. Nothing changes when the call is unclear: the tap stays
 * available.
 *
 * It outlives renders: `update` hands it the latest score and callback, and it starts, stops or
 * re-tunes the engine to match. Its state is in `store`, for the screen.
 */
export class VoiceListener {
  readonly store = new Store<VoiceState>(OFF);
  private engine: SpeechEngine | null = null;
  private input: VoiceInput | undefined;
  private grammarKey = '';

  constructor(private readonly createEngine: CreateSpeechEngine) {}

  update(input: VoiceInput) {
    this.input = input;
    if (!input.enabled) return this.stop();
    // Stable within a game, so the recognizer restarts once per game rather than once per point.
    const grammar = staticGrammar(input.state);
    const key = grammar.join('\u0000');
    if (this.engine === null) return this.start(grammar, key);
    if (key === this.grammarKey) return;
    this.grammarKey = key;
    const engine = this.engine;
    // Changing the grammar restarts the recognizer, which can fail like the first start.
    engine.setGrammar(grammar).catch((reason: unknown) => this.fail(engine, String(reason)));
  }

  stop() {
    const engine = this.engine;
    if (engine === null) return;
    this.engine = null;
    void engine.stop();
    this.store.set({ status: 'off', partial: '' });
  }

  private start(grammar: string[], key: string) {
    this.grammarKey = key;
    this.store.set({ status: 'starting' });
    const engine = this.createEngine(grammar, {
      // A stop is serialised behind a pending start: a stopped engine may still answer briefly.
      onResult: (text) => {
        if (this.engine === engine) this.onResult(text);
      },
      onPartial: (partial) => {
        if (this.engine === engine) this.store.set({ partial });
      },
      onError: (message) => this.fail(engine, message),
    });
    this.engine = engine;
    engine.start().then(
      () => {
        if (this.engine === engine) this.store.set({ status: 'listening' });
      },
      (reason: unknown) => this.fail(engine, String(reason)),
    );
  }

  private fail(engine: SpeechEngine, error: string) {
    if (this.engine === engine) this.store.set({ status: 'error', error });
  }

  private onResult(text: string) {
    if (!this.input) return;
    const current = this.input.state;
    const decision = decide(current, text);
    let winners: SideId[] | null = null;
    if (decision.type === 'accepted') winners = [decision.candidate.winner];
    if (decision.type === 'resync') winners = pointsBetween(current, decision.state);

    let result: string;
    if (winners !== null && winners.length > 0) {
      this.input.onPoints(winners);
      result = `Point ${sideName(current, winners.at(-1) as SideId)}`;
    } else if (decision.type === 'unchanged') {
      result = `Score inchangé (${scoreLabel(current)})`;
    } else if (decision.type === 'resync') {
      result = 'Score annoncé non appliqué : corrigez au tap';
    } else {
      result = 'Pas compris, rien ne change';
    }
    this.store.set({ partial: '', heard: { text, result } });
  }
}
