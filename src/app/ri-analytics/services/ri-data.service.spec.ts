import { RiDataService } from './ri-data.service';

describe('RiDataService', () => {
  let svc: RiDataService;
  beforeEach(() => svc = new RiDataService());

  it('initially null and can set/clear', () => {
    const emissions: Array<any> = [];
    const sub = svc.currentImport$.subscribe(v => emissions.push(v));

    // initial emission from BehaviorSubject
    expect(emissions[0]).toBeNull();

    svc.setImport({ metadata: { source: 't', importedAt: new Date().toISOString(), columns: [], rowsCount: 0 }, rows: [] });
    expect(emissions[1]).toBeDefined();

    svc.clear();
    expect(emissions[2]).toBeNull();

    sub.unsubscribe();
  });
});
