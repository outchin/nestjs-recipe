import type { Scene } from '../../stage/types';

/*
 * Lab 02: you → API → MySQL (one server: parses, plans with EXPLAIN) → table orders_archive.
 * The table is one InnoDB file holding two B-trees: the secondary index (email → id) and the
 * PRIMARY clustered index, which *is* the rows (id → full row). A seek walks email → id → row.
 * 1200 × 600 space.
 */
export const indexesScene: Scene = {
  width: 1200,
  height: 600,
  groups: [{ id: 'ibd', label: 'table orders_archive · one .ibd file', x: 820, y: 24, w: 290, h: 552 }],
  nodes: [
    { id: 'you', kind: 'client', x: 140, y: 300, title: 'You', subtitle: 'POST /api/indexes/*', labelSide: 'left' },
    { id: 'api', kind: 'server', x: 400, y: 300, title: 'NestJS API', subtitle: 'IndexesService' },
    { id: 'mysql', kind: 'db', x: 630, y: 380, title: 'MySQL 8', subtitle: 'parser · optimizer', labelSide: 'bottom' },
    { id: 'index', kind: 'index', x: 965, y: 140, title: 'idx_email', subtitle: 'secondary · email → id', labelSide: 'right' },
    { id: 'table', kind: 'rows', x: 965, y: 450, title: 'PRIMARY', subtitle: 'clustered · id → row', labelSide: 'right' },
  ],
  links: [
    { id: 'you-api', from: 'you', to: 'api' },
    { id: 'api-mysql', from: 'api', to: 'mysql' },
    { id: 'mysql-index', from: 'mysql', to: 'index' },
    { id: 'mysql-table', from: 'mysql', to: 'table' },
    { id: 'index-table', from: 'index', to: 'table' },
  ],
};
