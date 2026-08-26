import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, interval, switchMap, startWith, Subject, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { AuthService } from './auth.service';

export interface ToastMessage {
  title: string;
  message: string;
  type?: 'success' | 'warning' | 'info' | 'danger';
}

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = '/api';
  
  private notificationsSubject = new BehaviorSubject<any[]>([]);
  notifications$ = this.notificationsSubject.asObservable();
  
  private requestsSubject = new BehaviorSubject<any[]>([]);
  requests$ = this.requestsSubject.asObservable();

  private passwordRequestsSubject = new BehaviorSubject<any[]>([]);
  passwordRequests$ = this.passwordRequestsSubject.asObservable();

  private toasterSubject = new Subject<ToastMessage>();
  toaster$ = this.toasterSubject.asObservable();

  private allTicketsSubject = new BehaviorSubject<any[] | null>(null);
  allTickets$ = this.allTicketsSubject.asObservable();

  private refreshSubject = new Subject<void>();
  private seenRequestIds = new Set<string>();
  private seenStorageKey = 'phoenix_seen_notifs';
 
  constructor() {
    const savedSeen = localStorage.getItem(this.seenStorageKey);
    if (savedSeen) {
      try {
        const parsed = JSON.parse(savedSeen);
        if (Array.isArray(parsed)) {
          this.seenRequestIds = new Set(parsed);
        }
      } catch (e) {}
    }

    // Poll every 10 seconds for more responsive notifications
    this.refreshSubject.pipe(
      startWith(null),
      switchMap(() => interval(10000).pipe(startWith(0))),
      switchMap(() => {
        const user = this.authService.getUserData();
        const endpoint = user?.role === 'le' ? '/logistics' : '/tickets';
        return this.http.get<any[]>(`${this.apiUrl}${endpoint}?t=${new Date().getTime()}`).pipe(
          catchError(err => {
            console.error('Error fetching data for notification service:', err);
            return of([]);
          })
        );
      })
    ).subscribe(data => {
      this.allTicketsSubject.next(data);
      const user = this.authService.getUserData();
      const isAdmin = user?.role === 'admin';
      const isCse = user?.role === 'cse';

      // General notifications (latest 5)
      const sorted = [...data].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      this.notificationsSubject.next(sorted.slice(0, 5));

      // Edit requests notifications
      let requests: any[] = [];
      if (isAdmin) {
        requests = data.filter(t => (t.edit_requested && !t.edit_approved) || (t.profile_edit_requested && !t.profile_edit_approved));
      } else if (isCse) {
        requests = data.filter(t => t.edit_approved || t.profile_edit_approved);
      }
      
      const sortedRequests = requests.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
      this.requestsSubject.next(sortedRequests);

      // Check for new requests to trigger toaster
      let needsSave = false;
      requests.forEach(req => {
        const reqId = `${req.id}-${req.profile_edit_requested ? 'profile' : 'general'}-${isAdmin ? 'req' : 'app'}`;
        if (!this.seenRequestIds.has(reqId)) {
          this.seenRequestIds.add(reqId);
          needsSave = true;
          if (isAdmin) {
            this.showToast({
              title: req.profile_edit_requested ? 'New Profile Edit Request' : 'New General Edit Request',
              message: `Ticket #${req.id} by ${req.executive?.name || req.agent_name || 'Agent'} requires edit approval.`,
              type: 'warning'
            });
          } else if (isCse) {
            this.showToast({
              title: 'Edit Request Approved',
              message: `Ticket #${req.id} edit request has been approved!`,
              type: 'success'
            });
          }
        }
      });

      // LE toaster for new assignments
      if (user?.role === 'le') {
        const sortedLogistics = [...data].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
        sortedLogistics.forEach(log => {
          const logId = `logistics-${log.id}`;
          if (!this.seenRequestIds.has(logId)) {
            // Only toast if we've already loaded once (don't spam on startup)
            if (this.seenRequestIds.size > 0 || localStorage.getItem(this.seenStorageKey)) {
              this.showToast({
                title: log.replacement ? 'New Replacement Task' : 'New Return Task',
                message: `Ticket #${log.id} has been assigned to your logistics queue.`,
                type: 'info'
              });
            }
            this.seenRequestIds.add(logId);
            needsSave = true;
          }
        });
      }

      if (needsSave) {
        localStorage.setItem(this.seenStorageKey, JSON.stringify(Array.from(this.seenRequestIds)));
      }
    });

    // Password Reset Requests Polling for Admin
    const pollPasswordRequests = () => {
      const user = this.authService.getUserData();
      if (user?.role === 'admin') {
        this.http.get<any[]>(`${this.apiUrl}/password-reset-requests`).pipe(
          catchError(err => of([]))
        ).subscribe(requests => {
          const pending = requests.filter(r => r.status === 'Pending');
          this.passwordRequestsSubject.next(pending);
          
          let needsSavePw = false;
          requests.forEach(req => {
            const reqId = `pw-reset-${req.id}`;
            if (req.status === 'Pending' && !this.seenRequestIds.has(reqId)) {
              if (this.seenRequestIds.size > 0 || localStorage.getItem(this.seenStorageKey)) {
                this.showToast({
                  title: 'New Password Reset Request',
                  message: `User with email ${req.email} requested a password reset.`,
                  type: 'warning'
                });
              }
              this.seenRequestIds.add(reqId);
              needsSavePw = true;
            }
          });
          if (needsSavePw) {
            localStorage.setItem(this.seenStorageKey, JSON.stringify(Array.from(this.seenRequestIds)));
          }
        });
      }
    };

    pollPasswordRequests();
    interval(15000).subscribe(() => pollPasswordRequests());
  }
 
  refresh() {
    this.refreshSubject.next();
  }

  showToast(toast: ToastMessage) {
    this.toasterSubject.next(toast);
  }
}
