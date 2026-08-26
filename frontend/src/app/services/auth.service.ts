import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { map, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = '/api';

  private inactivityTimer: any;
  private readonly INACTIVITY_LIMIT = 60 * 60 * 1000; // 5 minutes

  login(credentials: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/login`, credentials).pipe(
      map((res: any) => {
        localStorage.setItem('auth_token', res.token);
        localStorage.setItem('user_role', res.user.role);
        localStorage.setItem('user_data', JSON.stringify(res.user));
        this.initInactivityTimer();
        return res;
      })
    );
  }

  requestPasswordReset(email: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/password-reset-request`, { email });
  }

  initInactivityTimer() {
    if (this.getRole() === 'admin' || !this.isAuthenticated()) return;

    this.resetTimer();
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    events.forEach(event => {
      document.addEventListener(event, () => this.resetTimer());
    });
  }

  private resetTimer() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    this.inactivityTimer = setTimeout(() => {
      if (this.isAuthenticated() && this.getRole() !== 'admin') {
        console.log('Logging out due to inactivity');
        this.logout();
        alert('Your session has expired due to 5 minutes of inactivity.');
      }
    }, this.INACTIVITY_LIMIT);
  }

  logout() {
    this.http.post(`${this.apiUrl}/logout`, {}).subscribe({
      next: () => this.clearSession(),
      error: () => this.clearSession()
    });
  }

  clearSession() {
    if (this.inactivityTimer) clearTimeout(this.inactivityTimer);
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_role');
    localStorage.removeItem('user_data');
    this.router.navigate(['/login']);
  }

  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  getRole(): string | null {
    return localStorage.getItem('user_role');
  }

  getUserData(): any {
    const data = localStorage.getItem('user_data');
    return data ? JSON.parse(data) : null;
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return !!token && token !== 'undefined' && token !== 'null';
  }
}
