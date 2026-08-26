import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './admin-dashboard.component.html',
})
export class AdminDashboardComponent implements OnInit {
  tickets: any[] = [];
  users: any[] = [];
  statuses: any[] = [];
  cses: any[] = [];
  user: any;
  isAdmin = false;
  loading = true;

  stats = { total: 0, pending: 0, resolved: 0, unallocated: 0 };
  logisticsStats = { total: 0, pending: 0, resolved: 0 };
  statusBreakdown: { name: string; color: string; count: number; pct: number }[] = [];
  logisticBreakdown: { name: string; count: number; pct: number }[] = [];
  csePerformance: any[] = [];
  lePerformance: any[] = [];
  
  activities: any[] = [];
  analytics: any = null;

  private http = inject(HttpClient);
  public authService = inject(AuthService);
  private apiUrl = '/api';

  ngOnInit() {
    this.user = this.authService.getUserData();
    this.isAdmin = this.user?.role === 'admin';
    this.loadData();
  }

  loadData() {
    this.loading = true;

    this.http.get<any[]>(`${this.apiUrl}/tickets`).subscribe({
      next: (data) => {
        this.tickets = data;
        this.loading = false;

        const isResolved = (t: any) => {
          const name = t.status?.name?.toLowerCase() || '';
          return name.includes('resolv') || name.includes('close') || name.includes('complete');
        };

        const total = data.length;
        this.stats.total = total;
        this.stats.unallocated = data.filter(t => !t.is_allocated).length;
        this.stats.resolved = data.filter(t => isResolved(t)).length;
        this.stats.pending = total - this.stats.resolved;

        // Logistics stats
        let logTotal = 0;
        let logResolved = 0;
        const isLogResolved = (status: string) => {
          if (!status) return false;
          const s = status.toLowerCase();
          return s.includes('delivered') || s.includes('complete') || s.includes('closed') || s.includes('resolved') || s.includes('approved');
        };

        data.forEach(t => {
          if (t.replacement && t.replacement.status) {
            logTotal++;
            if (isLogResolved(t.replacement.status)) logResolved++;
          }
          if (t.ticket_return && t.ticket_return.status) {
            logTotal++;
            if (isLogResolved(t.ticket_return.status)) logResolved++;
          }
        });

        this.logisticsStats.total = logTotal;
        this.logisticsStats.resolved = logResolved;
        this.logisticsStats.pending = logTotal - logResolved;

        this.computeStatusBreakdown(data);
      },
      error: (err) => {
        this.loading = false;
        console.error('Failed to load tickets:', err);
      }
    });

    this.http.get<any[]>(`${this.apiUrl}/statuses?type=general`).subscribe({
      next: (d) => {
        this.statuses = d;
        // Re-compute after statuses are loaded
        if (this.tickets.length) this.computeStatusBreakdown(this.tickets);
      },
      error: (err) => {
        console.error('Failed to load statuses:', err);
      }
    });

    if (this.isAdmin) {
      this.http.get<any[]>(`${this.apiUrl}/users`).subscribe({
        next: (d) => this.users = d,
        error: (err) => console.error('Failed to load users:', err)
      });
      
      this.http.get<any[]>(`${this.apiUrl}/reports/admin-stats`).subscribe({
        next: (d) => {
          this.csePerformance = d.map((cse: any) => {
              const initials = cse.name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
              let resolved = 0;
              cse.tickets_by_status.forEach((ts: any) => {
                  const name = ts.status?.name?.toLowerCase() || '';
                  if (name.includes('resolv') || name.includes('close') || name.includes('complete')) {
                      resolved += ts.count;
                  }
              });
              return {
                  ...cse,
                  initials,
                  resolved,
                  total: cse.total_tickets
              };
          }).sort((a: any, b: any) => b.total - a.total);
        },
        error: (err) => console.error('Failed to load CSE performance stats:', err)
      });

      this.http.get<any[]>(`${this.apiUrl}/reports/le-stats`).subscribe({
        next: (d) => {
          this.lePerformance = d.map((le: any) => {
              const initials = le.name.split(' ').map((n: string) => n[0]).join('').toUpperCase();
              return {
                  ...le,
                  initials,
                  resolved: le.resolved_tickets,
                  total: le.total_tickets
              };
          }).sort((a: any, b: any) => b.total - a.total);
        },
        error: (err) => console.error('Failed to load LE performance stats:', err)
      });

      this.http.get<any>(`${this.apiUrl}/user-activities`).subscribe({
        next: (d) => this.activities = d.data, // paginated response
        error: (err) => console.error('Failed to load user activities:', err)
      });

      this.http.get<any>(`${this.apiUrl}/user-activities/analytics`).subscribe({
        next: (d) => this.analytics = d,
        error: (err) => console.error('Failed to load analytics:', err)
      });
    }
  }

  computeStatusBreakdown(tickets: any[]) {
    const total = tickets.length || 1;
    const map = new Map<number, { name: string; color: string; count: number }>();
    
    // For logistics
    let logisticsTotal = 0;
    const logMap = new Map<string, { count: number }>();

    tickets.forEach(t => {
      // General
      if (t.status) {
        const id = t.status_id;
        if (!map.has(id)) {
          map.set(id, { name: t.status.name, color: t.status.color || '#545cd8', count: 0 });
        }
        map.get(id)!.count++;
      }
      
      // Logistics
      const normalize = (status: string) => {
        return status.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
      };

      if (t.replacement && t.replacement.status) {
        logisticsTotal++;
        const s = normalize(t.replacement.status);
        logMap.set(s, { count: (logMap.get(s)?.count || 0) + 1 });
      }
      if (t.ticket_return && t.ticket_return.status) {
        logisticsTotal++;
        const s = normalize(t.ticket_return.status);
        logMap.set(s, { count: (logMap.get(s)?.count || 0) + 1 });
      }
    });

    this.statusBreakdown = Array.from(map.values())
      .sort((a, b) => b.count - a.count)
      .map(s => ({ ...s, pct: Math.round((s.count / total) * 100) }));
      
    this.logisticBreakdown = Array.from(logMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .map(([name, data]) => ({ name, count: data.count, pct: Math.round((data.count / (logisticsTotal || 1)) * 100) }));
  }



  get recentTickets() {
    return this.tickets.slice(0, 5);
  }

  getStatusStyle(status: { color: string }): { [key: string]: string } {
    const c = status?.color || '#545cd8';
    return { background: c + '22', color: c, border: '1px solid ' + c + '55' };
  }

  resolvedPct(cse: { total: number; resolved: number }): number {
    if (!cse.total) return 0;
    return Math.round((cse.resolved / cse.total) * 100);
  }

  getTimeAgo(date: any): string {
    if (!date) return 'Never';
    const now = new Date();
    const seen = new Date(date);
    const diffInMins = Math.floor((now.getTime() - seen.getTime()) / 60000);
    
    if (diffInMins < 1) return 'Just now';
    if (diffInMins < 60) return `${diffInMins}m ago`;
    const hours = Math.floor(diffInMins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  }
}
