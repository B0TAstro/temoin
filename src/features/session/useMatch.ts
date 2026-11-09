import { useCallback, useMemo, useState } from 'react';

import {
  isValid,
  type LoggedEvent,
  type MatchEvent,
  type MatchSetup,
  replay,
} from '@/core/events/matchLog';

/**
 * The match on this phone: the event log and the score replayed from it. Every change goes
 * through `dispatch`, the same path the host will use for its guests' intents in v0.2.
 */
export function useMatch(setup: MatchSetup) {
  const [log, setLog] = useState<LoggedEvent[]>([]);
  const view = useMemo(() => replay(setup, log), [setup, log]);

  /**
   * Appends the event if it is valid. Checked against the latest log, so two events sent in a
   * row (propose then confirm) both count. Returns whether it was valid when sent.
   */
  const dispatch = useCallback(
    (event: MatchEvent): boolean => {
      setLog((previous) =>
        isValid(replay(setup, previous), event)
          ? [...previous, { ...event, seq: previous.length + 1 }]
          : previous,
      );
      return isValid(view, event);
    },
    [setup, view],
  );

  return { ...view, log, dispatch };
}
