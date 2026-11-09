/**
 * Words that mark a deliberate correction rather than a normal call.
 *
 * All three are in the Vosk French lexicon (checked against the model, not
 * assumed). Only the first is put in the grammar — one word keeps the grammar
 * small — so by voice that is the one to say. The others are there for typed
 * input and cost nothing.
 *
 * An explicit command is a second way to corroborate a long jump, next to the
 * spoken games count. It matters most during the FIRST game, where there is no
 * games count yet and a long jump would otherwise be impossible by voice.
 */
export const COMMAND_WORDS = ['correction', 'skip', 'score'] as const;

/** The one the grammar offers, and therefore the one to say out loud. */
export const COMMAND_SPOKEN = COMMAND_WORDS[0];

export interface Command {
  rest: string[];
}

export function splitCommand(tokens: string[]): Command | null {
  const first = tokens[0];
  if (first === undefined || !(COMMAND_WORDS as readonly string[]).includes(first)) return null;

  const rest = tokens.slice(1);
  // A command on its own says nothing about the score.
  if (rest.length === 0) return null;

  return { rest };
}
