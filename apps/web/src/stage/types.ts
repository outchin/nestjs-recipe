/*
 * Shared shapes for the lab visualizer.
 * Kept free of DOM/React imports: scripts/record-*.mts (Node) imports these too.
 */

// ── what the API reports (X-Lab-Trace, see apps/api/src/common/lab-trace) ──
export interface TraceSpan {
  name: string;
  at: number;
  ms: number;
  depth: number;
  detail?: Record<string, unknown>;
  error?: string;
}
export interface Trace {
  totalMs: number;
  spans: TraceSpan[];
}

// ── one real request, live or recorded ──
export interface RequestRecord {
  actor: string;
  userId: number;
  method: string;
  path: string;
  body?: unknown;
  status: number;
  response: unknown;
  /** round trip measured by the client, ms */
  clientMs: number;
  /** ms since the run started (shows real overlap of parallel requests) */
  startedAt: number;
  trace?: Trace;
}

// ── a scenario: declarative steps, same file for the web page and the recorder ──
export interface ScenarioStep {
  id: string;
  actor: string;
  userId: number;
  product: string;
  /** symbolic key name; the runner turns each name into one real UUID-ish key per run */
  key: string;
  /** send this many identical requests at the same instant */
  parallel?: number;
  /** what the theory predicts, one status per request */
  expect: number[];
}
export interface Scenario {
  id: string;
  title: string;
  steps: ScenarioStep[];
}
/** What is in the database right now (read back through the API after each step). */
export interface DbOrder {
  id: number;
  userId: number;
  sku: string;
  key: string | null;
}
export interface DbState {
  /** sku → stock */
  stock: Record<string, number>;
  /** every order, oldest first (optional: recordings made before this field existed) */
  orders?: DbOrder[];
}
export interface StepRun {
  stepId: string;
  requests: RequestRecord[];
  after: DbState;
}

// ── a saved real run (apps/web/src/recordings/<lab>/<scenario>.json) ──
export interface RecordingMeta {
  scenario: string;
  recordedAt: string;
  commit: string;
  dirty: boolean;
  node: string;
  dbDriver: string;
  platform: string;
  cpu?: string;
}
export interface Recording {
  meta: RecordingMeta;
  /** database right after the reset, before step one */
  initial?: DbState;
  runs: StepRun[];
}

// ── the stage: a scene (layout) + hops (what to animate) ──
export type Tone = 'neutral' | 'info' | 'ok' | 'replay' | 'error';

export interface SceneNode {
  id: string;
  x: number;
  y: number;
  title: string;
  subtitle?: string;
  kind: 'client' | 'server' | 'db';
  /** 3D view: where the flat label sits relative to the solid (default top) */
  labelSide?: 'top' | 'left' | 'right';
}
export interface SceneLink {
  id: string;
  from: string;
  to: string;
}
export interface SceneGroup {
  id: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}
export interface Scene {
  width: number;
  height: number;
  nodes: SceneNode[];
  links: SceneLink[];
  groups?: SceneGroup[];
}

export type Hop =
  | { kind: 'travel'; link: string; reverse?: boolean; tone: Tone; label?: string; quick?: boolean }
  | { kind: 'pulse'; node: string; tone: Tone; tag: string; ms?: number; event?: string };

/** A small live table pinned to a node (e.g. what a DB table holds now). */
export interface NodePanel {
  rows: { label: string; value?: string; changed?: boolean }[];
}
