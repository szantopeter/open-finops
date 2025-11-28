import { RiPortfolioDataService } from './ri-portfolio-data.service';

describe('RiDataService', () => {
  let svc: RiPortfolioDataService;
  beforeEach(() => svc = new RiPortfolioDataService());

  it('initially null and can set/clear', () => {
    const emissions: Array<any> = [];
    const sub = svc.riPortfolio$.subscribe(v => emissions.push(v));

    // initial emission from BehaviorSubject
    expect(emissions[0]).toBeNull();

    svc.setRiPortfolio({ metadata: { source: 't', importedAt: new Date().toISOString(), projectionStartDate: new Date(2025,0,1), projectionEndDate: new Date() }, rows: [] });
    expect(emissions[1]).toBeDefined();

    svc.clear();
    expect(emissions[2]).toBeNull();

    sub.unsubscribe();
  });
});
