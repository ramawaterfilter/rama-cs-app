import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

export const AuthGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  const isAuthenticated = authService.isAuthenticated();
  const userRole = authService.getRole();
  console.log('AuthGuard checking. Authenticated:', isAuthenticated, 'Role:', userRole);

  if (isAuthenticated) {
    const requiredRole = route.data['role'];
    
    if (requiredRole && requiredRole !== userRole) {
      console.warn('Role mismatch. Required:', requiredRole, 'Actual:', userRole);
      if (userRole === 'admin') router.navigate(['/dashboard/overview']);
      else if (userRole === 'le') router.navigate(['/dashboard/logistics']);
      else router.navigate(['/dashboard/cse']);
      return false;
    }
    return true;
  }

  console.warn('Not authenticated, redirecting to login');
  router.navigate(['/login']);
  return false;
};
