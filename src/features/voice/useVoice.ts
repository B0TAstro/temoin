import { useEffect, useRef, useState } from 'react';

import { VoskEngine } from '@/adapters/voice/VoskEngine';
import { type MatchState, scoreLabel, type SideId, sideName } from '@/sports/tennis';
import { staticGrammar } from '@/core/voice/grammar';
import { decide, pointsBetween } from '@/core/voice/match';

export type VoiceStatus = 'off' | 'starting' | 'listening' | 'error';

/** What was heard last, and what the app did with it, shown under the score. */
export type Heard = { text: string; result: string };

/**
 * Listens to the server's call and turns it into points (chain from the voice POC): Vosk turns the
 * voice into text against a grammar derived from the score, then `decide` compares the text with
 * the two possible next scores. Nothing changes when the call is unclear: the tap stays available.
 */
export function useVoice({
  state,
  enabled,
  onPoints,
}: {
  state: MatchState;
  enabled: boolean;
  /** Called with the winners of the points the call ends, in order (1, or 2 after a missed call). */
  onPoints: (winners: SideId[]) => void;
}) {
  /** Set once the engine answered: until then, an enabled engine is starting. */
  const [started, setStarted] = useState<'listening' | 'error'>();
  const [error, setError] = useState<string>();
  const [partial, setPartial] = useState('');
  const [heard, setHeard] = useState<Heard>();

  // The engine outlives renders: it reads the latest score and callback through refs.
  const stateRef = useRef(state);
  const onPointsRef = useRef(onPoints);
  useEffect(() => {
    stateRef.current = state;
    onPointsRef.current = onPoints;
  });

  // Stable within a game, so the recogniser restarts once per game rather than once per point.
  const grammar = staticGrammar(state);
  const grammarKey = grammar.join('\u0000');
  const grammarRef = useRef(grammar);
  useEffect(() => {
    grammarRef.current = grammar;
  });

  const engineRef = useRef<VoskEngine | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const onResult = (text: string) => {
      // A stop is serialised behind a pending start: the recognizer may still answer briefly.
      if (cancelled) return;
      setPartial('');
      const current = stateRef.current;
      const decision = decide(current, text);
      let winners: SideId[] | null = null;
      if (decision.type === 'accepted') winners = [decision.candidate.winner];
      if (decision.type === 'resync') winners = pointsBetween(current, decision.state);

      if (winners !== null && winners.length > 0) {
        onPointsRef.current(winners);
        const last = winners.at(-1) as SideId;
        setHeard({ text, result: `Point ${sideName(current, last)}` });
      } else if (decision.type === 'unchanged') {
        setHeard({ text, result: `Score inchangé (${scoreLabel(current)})` });
      } else if (decision.type === 'resync') {
        setHeard({ text, result: 'Score annoncé non appliqué : corrigez au tap' });
      } else {
        setHeard({ text, result: 'Pas compris, rien ne change' });
      }
    };

    const engine = new VoskEngine(grammarRef.current, {
      onResult,
      onPartial: setPartial,
      onError: (message) => {
        setStarted('error');
        setError(message);
      },
    });
    engineRef.current = engine;
    engine.start().then(
      () => {
        if (!cancelled) setStarted('listening');
      },
      (reason: unknown) => {
        if (cancelled) return;
        setStarted('error');
        setError(String(reason));
      },
    );

    return () => {
      cancelled = true;
      void engine.stop();
      engineRef.current = null;
      setStarted(undefined);
      setPartial('');
    };
  }, [enabled]);

  // Keep the running recogniser in step with the current game.
  useEffect(() => {
    const engine = engineRef.current;
    // Changing the grammar restarts the recognizer, which can fail like the first start.
    void engine?.setGrammar(grammarRef.current).catch((reason: unknown) => {
      if (engineRef.current !== engine) return;
      setStarted('error');
      setError(String(reason));
    });
  }, [grammarKey]);

  const status: VoiceStatus = enabled ? (started ?? 'starting') : 'off';
  return { status, error, partial, heard };
}
