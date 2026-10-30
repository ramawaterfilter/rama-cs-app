import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, Router, RouterStateSnapshot } from '@angular/router';

import { AuthGuard } from './auth.guard';
import { AuthService } from '../services/auth.service';

describe('AuthGuard', () => {
  let auth: jasmine.SpyObj<AuthService>;
  let router: jasmine.SpyObj<Router>;

  function executeGuard(role?: string) {
    return TestBed.runInInjectionContext(() => AuthGuard(
      { data: { role } } as unknown as ActivatedRouteSnapshot,
      {} as RouterStateSnapshot,
    ));
  }

  beforeEach(() => {
    auth = jasmine.createSpyObj<AuthService>('AuthService', ['isAuthenticated', 'getRole']);
    router = jasmine.createSpyObj<Router>('Router', ['navigate']);
    TestBed.configureTestingModule({ providers: [
      { provide: AuthService, useValue: auth },
      { provide: Router, useValue: router },
    ] });
  });

  it('denies unauthenticated access and redirects to login', () => {
    auth.isAuthenticated.and.returnValue(false);
    expect(executeGuard()).toBe(false);
    expect(router.navigate).toHaveBeenCalledOnceWith(['/login']);
  });

  it('allows the required role without redirecting', () => {
    auth.isAuthenticated.and.returnValue(true);
    auth.getRole.and.returnValue('admin');
    expect(executeGuard('admin')).toBe(true);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('allows authenticated routes without a role requirement', () => {
    auth.isAuthenticated.and.returnValue(true);
    auth.getRole.and.returnValue('cse');
    expect(executeGuard()).toBe(true);
  });

  for (const [role, destination] of [
    ['admin', '/dashboard/overview'],
    ['le', '/dashboard/logistics'],
    ['cse', '/dashboard/cse'],
  ]) {
    it(`denies a different role and redirects ${role} to its dashboard`, () => {
      auth.isAuthenticated.and.returnValue(true);
      auth.getRole.and.returnValue(role);
      expect(executeGuard('other-role')).toBe(false);
      expect(router.navigate).toHaveBeenCalledOnceWith([destination]);
    });
  }
});
