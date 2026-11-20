import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { DRIVER_FAMILY, resolveDriver } from '../src/database/database.types';

// Runs against the real DB from apps/api/.env (needs `npm run db:seed:inventory` once).
// Uses the T-shirt (stock 50) so the 1-left sneaker scenario stays untouched.
const onSql = DRIVER_FAMILY[resolveDriver()] === 'typeorm';

(onSql ? describe : describe.skip)('Inventory orders (e2e)', () => {
  let app: INestApplication;
  const SKU = 'TSHIRT-BASIC-001';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(() => app.close());

  const http = () => request(app.getHttpServer());
  const tshirt = async () =>
    (await http().get('/api/inventory/products').expect(200)).body.find((p: { sku: string }) => p.sku === SKU);

  it('creates an order and decrements stock in the same transaction', async () => {
    const before = await tshirt();
    const res = await http()
      .post('/api/inventory/orders')
      .set('X-User-Id', '1')
      .send({ productId: before.id, quantity: 2 })
      .expect(201);

    expect(res.body).toMatchObject({ userId: 1, status: 'CONFIRMED', totalAmount: '30.00' });
    expect(res.body.items).toEqual([expect.objectContaining({ productId: before.id, quantity: 2, unitPrice: '15.00' })]);
    expect((await tshirt()).stock).toBe(before.stock - 2);
  });

  it('replays the same order for the same idempotency key', async () => {
    const { id } = await tshirt();
    const key = `e2e-${Date.now()}`;
    const body = { productId: id, quantity: 1, idempotencyKey: key };
    const first = await http().post('/api/inventory/orders').set('X-User-Id', '1').send(body).expect(201);
    const stockAfterFirst = (await tshirt()).stock;
    const second = await http().post('/api/inventory/orders').set('X-User-Id', '1').send(body).expect(200);
    expect(second.body.id).toBe(first.body.id);
    expect((await tshirt()).stock).toBe(stockAfterFirst);
  });

  it('rejects buying more than is in stock with 409', async () => {
    const { id, stock } = await tshirt();
    await http()
      .post('/api/inventory/orders')
      .set('X-User-Id', '2')
      .send({ productId: id, quantity: Math.min(stock + 1, 100) })
      .expect(stock + 1 <= 100 ? 409 : 400);
  });

  it('attaches an X-Lab-Trace header with the real path (miss → write, then hit → no write)', async () => {
    const { id } = await tshirt();
    const body = { productId: id, quantity: 1, idempotencyKey: `trace-${Date.now()}` };
    const decode = (h: string) => JSON.parse(Buffer.from(h, 'base64').toString('utf8'));
    const names = (t: { spans: { name: string }[] }) => t.spans.map((s) => s.name);

    const first = decode((await http().post('/api/inventory/orders').set('X-User-Id', '1').send(body).expect(201)).headers['x-lab-trace']);
    expect(names(first)).toEqual([
      'db.transaction', 'db.user.find', 'db.idempotency.lookup', 'db.product.read',
      'app.stock.check', 'db.product.update', 'db.order.insert', 'db.orderItem.insert',
    ]);
    expect(first.spans[2].detail).toMatchObject({ hit: false });

    const replay = decode((await http().post('/api/inventory/orders').set('X-User-Id', '1').send(body).expect(200)).headers['x-lab-trace']);
    expect(names(replay)).toEqual(['db.transaction', 'db.user.find', 'db.idempotency.lookup']);
    expect(replay.spans[2].detail).toMatchObject({ hit: true });
  });

  it('401 without X-User-Id, 400 on invalid body', async () => {
    await http().post('/api/inventory/orders').send({ productId: 1, quantity: 1 }).expect(401);
    await http().post('/api/inventory/orders').set('X-User-Id', '1').send({ productId: 'x', quantity: 0 }).expect(400);
  });
});
