import { ComponentFixture, TestBed } from '@angular/core/testing';
import { AuthModule, AuthService } from '@auth0/auth0-angular';

import { environment, getEnv } from 'src/environments/environment';

import { LandingComponent } from './landing.component';

describe('LandingComponent', () => {
  let component: LandingComponent;
  let fixture: ComponentFixture<LandingComponent>;
  let authService: AuthService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      providers: [
        AuthService
      ],
      imports: [AuthModule.forRoot(environment.auth0[getEnv()]), LandingComponent]
    })
      .compileComponents();

    fixture = TestBed.createComponent(LandingComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
    fixture.detectChanges();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should have as title \'angular-template\'', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    const app = fixture.componentInstance;
    expect(app.title).toEqual('angular-template');
  });

  it('should render title', () => {
    const fixture = TestBed.createComponent(LandingComponent);
    fixture.detectChanges();
    const compiled = fixture.nativeElement as HTMLElement;
    expect(compiled.querySelector('.content span')?.textContent).toContain('angular-template app is running!');
  });

  it('should logout when method called',() => {
    const spy = spyOn(authService,'logout');
    component.logout();
    expect(spy).toHaveBeenCalled();
  });
});
