import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LandingComponent } from './landing.component';
import { RiImportPreviewComponent } from '../../ri-analytics/components/ri-import-preview/ri-import-preview.component';
import { RiImportUploadComponent } from '../../ri-analytics/components/ri-import-upload/ri-import-upload.component';
import { HttpClientTestingModule } from '@angular/common/http/testing';

describe('LandingComponent', () => {
  let fixture: ComponentFixture<LandingComponent>;
  // Auth removed: no AuthService used in tests

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LandingComponent, RiImportUploadComponent, RiImportPreviewComponent, HttpClientTestingModule]
    })
      .compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have as title \'aws-rds-ri-portfolio-optimiser\'', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('aws-rds-ri-portfolio-optimiser');
  });

  it('should render main heading', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('h1')?.textContent).toContain('RDS Reserved Instances');
  });

  // Auth removed: no logout test
});
