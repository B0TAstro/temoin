import { useEffect, useState, useSyncExternalStore } from 'react';

import { VoskEngine } from './native/VoskEngine';
import { type VoiceInput, VoiceListener, type VoiceState } from './VoiceListener';

/** The voice for the match screen, on Vosk. The listener does the work; this only wires it to React. */
export function useVoice(input: VoiceInput): VoiceState {
  const [listener] = useState(
    () => new VoiceListener((grammar, hooks) => new VoskEngine(grammar, hooks)),
  );
  // Every render: the listener keeps the latest score and callback, and only acts on a change.
  useEffect(() => listener.update(input));
  useEffect(() => () => listener.stop(), [listener]);
  return useSyncExternalStore(listener.store.subscribe, listener.store.get);
}
