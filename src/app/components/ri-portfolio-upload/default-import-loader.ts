import { Provider } from '@angular/core';

import { RiImportService } from './ri-portfolio-import.service';

export const DEFAULT_IMPORT_PROVIDER: Provider = {
  provide: 'APP_INIT_DEFAULT_IMPORT',
  useFactory: (riImportService: RiImportService) => {
    return async () => riImportService.loadDefaultRiPortfolioIfMissing();
  },
  deps: [RiImportService],
  multi: true as any
};
