import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { RouterLink, Router } from '@angular/router';

@Component({
  selector: 'app-cse-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './cse-dashboard.component.html',
})
export class CseDashboardComponent implements OnInit {
  tickets: any[] = [];
  filteredTickets: any[] = [];
  statuses: any[] = [];
  user: any;
  loading = true;
  stats = { total: 0, pending: 0, resolved: 0, claimed: 0 };
  logisticsStats = { total: 0, pending: 0, resolved: 0 };

  private http = inject(HttpClient);
  public authService = inject(AuthService);
  private router = inject(Router);
  private apiUrl = '/api';

  ngOnInit() {
    this.user = this.authService.getUserData();
    if (this.user?.role === 'le') {
      this.router.navigate(['/dashboard/logistics']);
      return;
    }
    this.loadAll();
  }

  loadAll() {
    this.loading = true;
    this.http.get<any[]>(`${this.apiUrl}/tickets`).subscribe({
      next: (data) => {
        this.tickets = data;
        this.computeStats();
        this.applyFilter();
        this.loading = false;
      },
      error: () => this.loading = false
    });
    this.http.get<any[]>(`${this.apiUrl}/statuses?type=general`).subscribe(d => this.statuses = d);
  }

  computeStats() {
    this.stats.total = this.tickets.length;
    
    const isResolved = (t: any) => {
      const name = t.status?.name?.toLowerCase() || '';
      return name.includes('resolv') || name.includes('close') || name.includes('complete');
    };

    this.stats.pending = this.tickets.filter(t => !isResolved(t)).length;

    // Logistics stats
    let logTotal = 0;
    let logResolved = 0;
    const isLogResolved = (status: string) => {
      if (!status) return false;
      const s = status.toLowerCase();
      return s.includes('delivered') || s.includes('complete') || s.includes('closed') || s.includes('resolved') || s.includes('approved');
    };

    this.tickets.forEach(t => {
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
  }

  applyFilter() {
    let list = [...this.tickets];
    
    // Sort by newest submission first
    list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    
    // Show only the 10 most recent tickets
    this.filteredTickets = list.slice(0, 10);
  }

  getStatusStyle(ticket: any): { [key: string]: string } {
    const color = ticket.status?.color;
    if (!color) return { background: '#f0f1f3', color: '#495057' };
    return { background: color + '22', color: color, border: '1px solid ' + color + '55', fontWeight: 'bold', padding: '4px 10px', borderRadius: '20px' };
  }
}
