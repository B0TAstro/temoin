import type { EventSubscription } from 'react-native';
import * as Vosk from 'react-native-vosk';

/** Folder name inside the app bundle, placed there by the react-native-vosk config plugin. */
const MODEL = 'model-fr-fr';

let modelLoaded: Promise<void> | null = null;

export type VoskHooks = {
  onResult: (text: string) => void;
  onPartial?: (text: string) => void;
  onError?: (message: string) => void;
};

/**
 * On-device French speech to text, constrained to a grammar (from the voice POC).
 *
 * Vosk restarts to change its grammar, which costs a beat of deafness: callers change it only at
 * game boundaries.
 */
export class VoskEngine {
  #grammar: string[];
  #hooks: VoskHooks;
  #subscriptions: EventSubscription[] = [];
  #running = false;

  constructor(grammar: string[], hooks: VoskHooks) {
    this.#grammar = grammar;
    this.#hooks = hooks;
  }

  async start(): Promise<void> {
    if (this.#running) return;
    // Loaded once for the whole app: about a second for the 65 MB model.
    modelLoaded ??= Vosk.loadModel(MODEL).catch((error: unknown) => {
      modelLoaded = null;
      throw error;
    });
    await modelLoaded;

    this.#subscriptions = [
      Vosk.onResult((text) => {
        const trimmed = text.trim();
        if (trimmed.length > 0) this.#hooks.onResult(trimmed);
      }),
      Vosk.onPartialResult((text) => this.#hooks.onPartial?.(text)),
      Vosk.onError((error: unknown) => this.#hooks.onError?.(String(error))),
    ];
    // Deliberately no timeout: it stops the recognizer, and we listen for a whole game. The native
    // tap keeps running and emits onResult after every detected silence.
    try {
      await Vosk.start({ grammar: this.#grammar });
    } catch (error) {
      for (const subscription of this.#subscriptions) subscription.remove();
      this.#subscriptions = [];
      throw error;
    }
    this.#running = true;
  }

  stop(): void {
    if (!this.#running) return;
    Vosk.stop();
    for (const subscription of this.#subscriptions) subscription.remove();
    this.#subscriptions = [];
    this.#running = false;
  }

  async setGrammar(grammar: string[]): Promise<void> {
    if (grammar.join('\u0000') === this.#grammar.join('\u0000')) return;
    this.#grammar = grammar;
    if (this.#running) {
      this.stop();
      await this.start();
    }
  }
}
