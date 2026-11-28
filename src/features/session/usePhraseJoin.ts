import { useState } from 'react';

import type { Join } from './logic/joinLink';
import { readPhrase, sessionOfPhrase } from './logic/sessionPhrase';

/**
 * Joining by the session phrase, typed instead of scanning. The phrase stands for the session:
 * its code and key are worked out here, nothing is asked of the host. A wrong phrase finds no
 * session and stays on « Recherche de la session… »
 */
export function usePhraseJoin(join: (session: Join) => void) {
  const [phrase, setPhrase] = useState('');
  const [joining, setJoining] = useState(false);
  const typed = readPhrase(phrase);

  const submit = async () => {
    if (!typed || joining) return;
    setJoining(true);
    join({ ...(await sessionOfPhrase(typed)), wifi: [] });
  };

  return {
    phrase,
    setPhrase,
    /** 12 valid characters: the button can go */
    complete: typed !== null,
    joining,
    submit: () => void submit(),
  };
}
