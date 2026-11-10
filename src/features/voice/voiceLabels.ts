import type { Heard, VoiceStatus } from './VoiceListener';

export const VOICE_LABEL: Record<VoiceStatus, string> = {
  off: 'Voix coupée',
  starting: 'Chargement de la voix…',
  listening: 'À l’écoute de l’annonce',
  error: 'Voix indisponible',
};

/** What is being heard, or was heard last and what the app did with it. Null before any call. */
export function heardLine(voice: { partial: string; heard: Heard | undefined }): string | null {
  if (voice.partial.length > 0) return `« ${voice.partial} »`;
  if (voice.heard) return `« ${voice.heard.text} » · ${voice.heard.result}`;
  return null;
}
