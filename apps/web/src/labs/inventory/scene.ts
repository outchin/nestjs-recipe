import type { Scene } from '../../stage/types';

/** Who talks to whom in this lab. Coordinates are in a 1200 × 600 space (the stage keeps this ratio). */
export const inventoryScene: Scene = {
  width: 1200,
  height: 600,
  groups: [{ id: 'mysql', label: 'MySQL · one transaction', x: 880, y: 24, w: 290, h: 552 }],
  nodes: [
    { id: 'alice', kind: 'client', x: 150, y: 220, title: 'Alice', subtitle: 'X-User-Id: 1', labelSide: 'left' },
    { id: 'bob', kind: 'client', x: 150, y: 430, title: 'Bob', subtitle: 'X-User-Id: 2', labelSide: 'left' },
    { id: 'api', kind: 'server', x: 560, y: 300, title: 'NestJS API', subtitle: 'POST /inventory/orders' },
    { id: 'users', kind: 'db', x: 1025, y: 85, title: 'users', subtitle: 'who is buying', labelSide: 'right' },
    { id: 'orders', kind: 'db', x: 1025, y: 272, title: 'orders', subtitle: 'UNIQUE(user_id, key)', labelSide: 'right' },
    { id: 'products', kind: 'db', x: 1025, y: 458, title: 'products', subtitle: 'stock · version', labelSide: 'right' },
  ],
  links: [
    { id: 'alice-api', from: 'alice', to: 'api' },
    { id: 'bob-api', from: 'bob', to: 'api' },
    { id: 'api-users', from: 'api', to: 'users' },
    { id: 'api-orders', from: 'api', to: 'orders' },
    { id: 'api-products', from: 'api', to: 'products' },
  ],
};
