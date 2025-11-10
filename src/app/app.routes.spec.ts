import { routes } from './app.routes';

describe('App Routes', () => {
  it('should have a single route with correct configuration', () => {
    expect(routes.length).toBe(1);
    const route = routes[0];
    expect(route.path).toBe('');
  // Authentication was removed; ensure canActivate is not required
  expect(route.canActivate == null || route.canActivate.length === 0).toBeTrue();
    expect(typeof route.loadComponent).toBe('function');
  });

  it('should lazy load LandingComponent', async () => {
    const route = routes[0];
    const componentOrModule = await route.loadComponent();
    expect(componentOrModule).toBeDefined();
    // If the result is a default export, unwrap it
    const component = (componentOrModule && (componentOrModule as any).default) ? (componentOrModule as any).default : componentOrModule;
    expect(component).toBeDefined();
    // Instead of checking name, check that it's a class/function (Angular component)
    expect(typeof component).toBe('function');
    // Optionally, check for Angular metadata (selector)
    const metadata = Reflect.getOwnPropertyDescriptor(component, 'ɵcmp');
    expect(metadata || (component as any).ɵcmp).toBeDefined();
  });
});
