/**
 * A value that tells its subscribers when it changes (observer pattern). Long-lived objects (the
 * voice, the recorder) keep their state here, and React reads it with useSyncExternalStore:
 * `subscribe` and `get` are stable, and `get` returns the same object until the value changes.
 */
export class Store<T extends object> {
  private value: T;
  private readonly listeners = new Set<() => void>();

  constructor(initial: T) {
    this.value = initial;
  }

  readonly get = (): T => this.value;

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Merges `changes` into the value. Nothing happens, and nobody is told, if nothing changed. */
  set(changes: Partial<T>) {
    const next = { ...this.value, ...changes };
    const keys = Object.keys(next) as (keyof T)[];
    if (keys.every((key) => Object.is(next[key], this.value[key]))) return;
    this.value = next;
    for (const listener of this.listeners) listener();
  }
}
