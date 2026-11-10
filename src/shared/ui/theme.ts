/** Design tokens from docs/design.md §7. */
export const colors = {
  court: '#3E7A57',
  ball: '#E9B44C',
  ink: '#111111',
  line: '#FFFFFF',
  inkSoft: '#1E1E1E',
  lineDim: 'rgba(255,255,255,0.6)',
} as const;

export const space = { s: 8, m: 16, l: 24 } as const;
export const radius = 16;
/** Minimum touch target for a match action (design.md §7.3). */
export const touch = 64;
