/**
 * What the voice needs from a speech-to-text engine: Vosk on the phone, a fake one in tests.
 * The engine only turns sound into text against a grammar; what the text means is decided above.
 */
export interface SpeechEngine {
  start(): Promise<void>;
  /** Takes effect even while a start is still pending: that start then ends stopped. */
  stop(): Promise<void>;
  /** Restarts the recognizer when the grammar really changes: a beat of deafness. */
  setGrammar(grammar: string[]): Promise<void>;
}

export type SpeechHooks = {
  onResult: (text: string) => void;
  onPartial?: (text: string) => void;
  onError?: (message: string) => void;
};

/** Builds an engine (factory): the voice creates one each time listening starts. */
export type CreateSpeechEngine = (grammar: string[], hooks: SpeechHooks) => SpeechEngine;
