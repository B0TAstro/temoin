/** A point on the court's ground, in cm: x across from the left doubles sideline, y from the near baseline */
export type CourtPoint = { x: number; y: number };
export type CourtLine = { from: CourtPoint; to: CourtPoint };

/** The ITF court, as the POC's configs/court.yaml (scale 1) */
const LENGTH = 2377;
const DOUBLES_WIDTH = 1097;
const SINGLES_WIDTH = 823;
const SERVICE_FROM_NET = 640;

const ALLEY = (DOUBLES_WIDTH - SINGLES_WIDTH) / 2;
const NET = LENGTH / 2;
const SINGLES_LEFT = ALLEY;
const SINGLES_RIGHT = DOUBLES_WIDTH - ALLEY;
const SERVICE_NEAR = NET - SERVICE_FROM_NET;
const SERVICE_FAR = NET + SERVICE_FROM_NET;
const CENTRE = DOUBLES_WIDTH / 2;

const line = (x1: number, y1: number, x2: number, y2: number): CourtLine => ({
  from: { x: x1, y: y1 },
  to: { x: x2, y: y2 },
});

/**
 * The lines drawn over the picture (POC's court_model.py): baselines, doubles and singles
 * sidelines, service lines, centre service line, and the net where it meets the ground
 */
export const COURT_LINES: readonly CourtLine[] = [
  line(0, 0, DOUBLES_WIDTH, 0),
  line(0, LENGTH, DOUBLES_WIDTH, LENGTH),
  line(0, 0, 0, LENGTH),
  line(DOUBLES_WIDTH, 0, DOUBLES_WIDTH, LENGTH),
  line(SINGLES_LEFT, 0, SINGLES_LEFT, LENGTH),
  line(SINGLES_RIGHT, 0, SINGLES_RIGHT, LENGTH),
  line(SINGLES_LEFT, SERVICE_NEAR, SINGLES_RIGHT, SERVICE_NEAR),
  line(SINGLES_LEFT, SERVICE_FAR, SINGLES_RIGHT, SERVICE_FAR),
  line(CENTRE, SERVICE_NEAR, CENTRE, SERVICE_FAR),
  line(0, NET, DOUBLES_WIDTH, NET),
];

/** Which rectangle of the court the 4 points are placed on */
export type Reference = 'doubles' | 'singles' | 'service';

/**
 * Its corners, in the order the picture's corners come (top left, top right, bottom right,
 * bottom left) for a camera behind the near baseline: far left, far right, near right, near left.
 * The service rectangle is for when the outer corners are out of the picture (POC's README)
 */
export const REFERENCE_CORNERS: Record<Reference, readonly CourtPoint[]> = {
  doubles: [
    { x: 0, y: LENGTH },
    { x: DOUBLES_WIDTH, y: LENGTH },
    { x: DOUBLES_WIDTH, y: 0 },
    { x: 0, y: 0 },
  ],
  singles: [
    { x: SINGLES_LEFT, y: LENGTH },
    { x: SINGLES_RIGHT, y: LENGTH },
    { x: SINGLES_RIGHT, y: 0 },
    { x: SINGLES_LEFT, y: 0 },
  ],
  service: [
    { x: SINGLES_LEFT, y: SERVICE_FAR },
    { x: SINGLES_RIGHT, y: SERVICE_FAR },
    { x: SINGLES_RIGHT, y: SERVICE_NEAR },
    { x: SINGLES_LEFT, y: SERVICE_NEAR },
  ],
};

/** The doubles court's corners, the same order: the court's outline in the picture */
export const COURT_CORNERS = REFERENCE_CORNERS.doubles;
