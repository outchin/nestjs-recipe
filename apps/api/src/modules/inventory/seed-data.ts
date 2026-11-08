/**
 * Demo data for the "2 users, 1 item left" scenario. Keep in sync with sql/seed.sql
 * (the SQL file is for the CLI; this is for POST /api/inventory/dev/reset).
 * Both users' password: password123
 */
const PASSWORD_HASH =
  'scrypt$5f2f8c9060ba4f183b8e1d6004d4c8f6$adbddfed910ef81d653784f9c0e83d6b389786abfc181a3f2cc92b067a6ac641913cd311b74f03b70d8266c9ad6b6635971245bc29cdc5ea88924b19e4fa86d8';

export const SEED_USERS = [
  { email: 'alice@lab.local', displayName: 'Alice', passwordHash: PASSWORD_HASH },
  { email: 'bob@lab.local', displayName: 'Bob', passwordHash: PASSWORD_HASH },
];

export const SEED_PRODUCTS = [
  { sku: 'SNEAKER-LTD-001', name: 'Limited Edition Sneaker', price: '199.00', stock: 1 }, // the contended one
  { sku: 'TSHIRT-BASIC-001', name: 'Basic T-Shirt', price: '15.00', stock: 50 },
];
