/*
 * Where this build runs.
 * - dev / build / build:pages: the labs on their own (home at "/").
 * - build:labs (vite --mode labs): published inside the portfolio at zawwaisoe.dev/labs —
 *   files under /labs/, router at "/", Recorded mode only (there is no API behind it).
 */
export const PUBLISHED = import.meta.env.MODE === 'labs';
/** the labs list page */
export const LABS_HOME = PUBLISHED ? '/labs' : '/';
