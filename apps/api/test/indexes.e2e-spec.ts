import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { resolveDriver } from '../src/database/database.types';

// Lab 02 on the real MySQL from apps/api/.env. First run seeds ~1M rows (≈10 s).
const onMysql = resolveDriver() === 'mysql';
jest.setTimeout(120_000);

(onMysql ? describe : describe.skip)('Indexes lab (e2e)', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  const query = (kind: 'equals' | 'lower') =>
    http().post('/api/indexes/query').send({ kind, email: 'user4242@shop.test' }).expect(200);
  const trace = (res: request.Response) =>
    JSON.parse(Buffer.from(res.headers['x-lab-trace'], 'base64').toString('utf8')) as { spans: { name: string }[] };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await http().post('/api/indexes/dev/reset').expect(200); // leave the lab at its starting point
    await app.close();
  });

  it('reset → 1M rows, no secondary index', async () => {
    const { body } = await http().post('/api/indexes/dev/reset').expect(200);
    expect(body).toMatchObject({ rows: 1_000_000, indexes: [] });
  });

  it('without an index the lookup is a full scan', async () => {
    const res = await query('equals');
    expect(res.body.explain).toMatchObject({ type: 'ALL', key: null });
    expect(res.body.rowsReturned).toBe(10);
    expect(res.body.rowsRead).toBeGreaterThanOrEqual(1_000_000);
    expect(trace(res).spans.map((s) => s.name)).toEqual(['db.explain', 'db.select', 'db.rows.read', 'db.select.repeat']);
  });

  it('with the index it is a ref lookup that reads ~the matching rows only', async () => {
    const created = await http().post('/api/indexes/index').expect(200);
    expect(created.body.state.indexes).toEqual(['idx_email']);
    // the page shows this exact statement under "The code behind this step"
    expect(created.body.sql).toBe('CREATE INDEX idx_email ON orders_archive (customer_email)');
    const res = await query('equals');
    expect(res.body.explain).toMatchObject({ type: 'ref', key: 'idx_email' });
    expect(res.body.rowsReturned).toBe(10);
    expect(res.body.rowsRead).toBeLessThan(100);
  });

  it('LOWER(column) cannot use the index', async () => {
    const res = await query('lower');
    expect(res.body.explain.type).toBe('ALL');
    expect(res.body.rowsRead).toBeGreaterThanOrEqual(1_000_000);
  });

  it('inserts report their cost and the indexes they had to maintain', async () => {
    const { body } = await http().post('/api/indexes/insert').send({ count: 1000 }).expect(200);
    expect(body).toMatchObject({ rows: 1000, indexes: ['idx_email'] });
    expect(body.ms).toBeGreaterThan(0);
  });

  it('rejects unknown query kinds', async () => {
    await http().post('/api/indexes/query').send({ kind: 'drop table', email: 'x@y.z' }).expect(400);
  });
});
