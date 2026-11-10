import type { Session } from './Session';

/** The state of the link, always on screen: Bluetooth, guests, or lost. */
export function linkLabel(session: Session): string {
  if (session.role === 'host') {
    if (session.link === 'off') return 'Bluetooth coupé · seul';
    return session.guests === 0
      ? 'Bluetooth ✓ · aucun invité'
      : `Bluetooth ✓ · ${session.guests} invité(s)`;
  }
  switch (session.link) {
    case 'connected':
      return 'Bluetooth ✓ · relié à l’hôte';
    case 'lost':
      return 'Lien perdu, l’enregistrement continue';
    default:
      return 'Recherche de l’hôte…';
  }
}
