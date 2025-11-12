import { Provider } from '@angular/core';

import { RiDataService } from './services/ri-data.service';
import { getEnv } from '../../environments/environment';

// Minimal RiImport shape used by RiDataService and components for demo purposes
const demoImport = {
  metadata: { source: 'demo', importedAt: new Date().toISOString() },
  rows: [
    {
      instanceClass: 'db.t3.medium',
      region: 'us-east-1',
      multiAz: false,
      engine: 'mysql',
      edition: 'standard',
      upfrontPayment: 'no-upfront',
      durationMonths: 12,
      startDate: '2025-10-15',
      endDate: '2026-10-14',
      count: 2
    },
    {
      instanceClass: 'db.t3.medium',
      region: 'us-east-1',
      multiAz: true,
      engine: 'mysql',
      edition: 'standard',
      upfrontPayment: 'no-upfront',
      durationMonths: 12,
      startDate: '2025-11-01',
      endDate: '2026-10-31',
      count: 1
    }
  ]
};

export const DEV_SEED_PROVIDER: Provider = {
  provide: 'APP_INIT_RI_SEED',
  useFactory: (ds: RiDataService) => {
    return () => {

      console.debug('[DEV_SEED] Initializer called, environment:', getEnv());
      if (getEnv() === 'dev') {

        console.debug('[DEV_SEED] Loading demo import with', demoImport.rows.length, 'rows');
        ds.setImport(demoImport as any);

        console.debug('[DEV_SEED] Demo import loaded successfully');
      } else {

        console.debug('[DEV_SEED] Not in dev environment, skipping seed data');
      }
    };
  },
  deps: [RiDataService],
  multi: true as any
};
