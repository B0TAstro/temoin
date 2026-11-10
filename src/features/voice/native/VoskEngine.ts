import type { EventSubscription } from 'react-native';
import * as Vosk from 'react-native-vosk';

import type { SpeechEngine, SpeechHooks } from './SpeechEngine';

/** Folder name inside the app bundle, placed there by the react-native-vosk config plugin. */
const MODEL = 'vosk-model-small-fr-0.22';

let modelLoaded: Promise<void> | null = null;

/**
 * Vosk is one recognizer for the whole app. Every start and stop, from every engine, waits for the
 * previous one: a stale engine finishing its start late can then never stop its successor.
 */
let transitions: Promise<void> = Promise.resolve();
function serially(task: () => Promise<void>): Promise<void> {
  const next = transitions.then(task);
  transitions = next.catch(() => undefined);
  return next;
}

/**
 * On-device French speech to text, constrained to a grammar (from the voice POC).
 *
 * Vosk restarts to change its grammar, which costs a beat of deafness: callers change it only at
 * game boundaries.
 */
export class VoskEngine implements SpeechEngine {
  #grammar: string[];
  #hooks: SpeechHooks;
  #subscriptions: EventSubscription[] = [];
  /** What the caller asked for last. Each transition brings the recognizer in line with it. */
  #wanted = false;
  #running = false;
  /** The grammar changed while running: the next transition restarts the recognizer. */
  #stale = false;

  constructor(grammar: string[], hooks: SpeechHooks) {
    this.#grammar = grammar;
    this.#hooks = hooks;
  }

  start(): Promise<void> {
    this.#wanted = true;
    return serially(() => this.#sync());
  }

  stop(): Promise<void> {
    this.#wanted = false;
    return serially(() => this.#sync());
  }

  setGrammar(grammar: string[]): Promise<void> {
    if (grammar.join('\u0000') === this.#grammar.join('\u0000')) return Promise.resolve();
    this.#grammar = grammar;
    this.#stale = true;
    return serially(() => this.#sync());
  }

  async #sync(): Promise<void> {
    if (this.#running && (!this.#wanted || this.#stale)) this.#halt();
    if (this.#wanted && !this.#running) await this.#begin();
  }

  async #begin(): Promise<void> {
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
    this.#stale = false;
    // Deliberately no timeout: it stops the recognizer, and we listen for a whole game. The native
    // tap keeps running and emits onResult after every detected silence.
    try {
      await Vosk.start({ grammar: this.#grammar });
    } catch (error) {
      this.#unsubscribe();
      throw error;
    }
    this.#running = true;
  }

  #halt(): void {
    Vosk.stop();
    this.#unsubscribe();
    this.#running = false;
  }

  #unsubscribe(): void {
    for (const subscription of this.#subscriptions) subscription.remove();
    this.#subscriptions = [];
  }
}
