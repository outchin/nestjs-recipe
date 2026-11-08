import { Test } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { DB_DRIVER } from '../../database/database.types';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [HealthService, { provide: DB_DRIVER, useValue: 'memory' }],
    }).compile();

    controller = moduleRef.get(HealthController);
  });

  it('returns status ok', async () => {
    expect(await controller.check()).toMatchObject({ status: 'ok', dbDriver: 'memory', db: 'n/a' });
  });
});
