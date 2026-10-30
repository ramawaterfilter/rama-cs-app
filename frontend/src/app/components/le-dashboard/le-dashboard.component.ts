import { LucideAngularModule } from 'lucide-angular';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { RouterLink, Router } from '@angular/router';

@Component({
  selector: 'app-le-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, LucideAngularModule],
  templateUrl: './le-dashboard.component.html',
})
export class LeDashboardComponent implements OnInit {
  tickets: any[] = [];
  user: any;
  loading = true;
  stats = { total: 0, pending: 0, resolved: 0 };

  private http = inject(HttpClient);
  public authService = inject(AuthService);
  private router = inject(Router);
  private apiUrl = '/api';

  ngOnInit() {
    this.user = this.authService.getUserData();
    this.loadAll();
  }

  loadAll() {
    this.loading = true;
    this.http.get<any>(`${this.apiUrl}/logistics?export=true`).subscribe({
      next: (data) => {
        // Handle paginated or non-paginated gracefully.
        const items = data.data ? data.data : data;
        this.tickets = Array.isArray(items) ? items : [];
        this.computeStats();
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  computeStats() {
    this.stats = { total: 0, pending: 0, resolved: 0 };
    this.stats.total = this.tickets.length;
    this.tickets.forEach(t => {
      // Find logistics status
      const status = t.replacement ? t.replacement.status : (t.ticket_return ? t.ticket_return.status : 'PENDING');
      const isResolved = status === 'DELIVERED' || status === 'COMPLETED' || status === 'RESOLVED' || status === 'RETURN COMPLETED';
      if (isResolved) {
        this.stats.resolved++;
      } else {
        this.stats.pending++;
      }
    });
  }

  getLogisticsStatusStyle(status: string) {
    if (!status) return { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' };
    const s = status.toUpperCase();
    if (s.includes('PROGRESS')) return { background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d' };
    if (s.includes('APPROVED')) return { background: '#d1fae5', color: '#065f46', border: '1px solid #6ee7b7' };
    if (s.includes('DELIVERED') || s.includes('COMPLETED')) return { background: '#dbeafe', color: '#1e40af', border: '1px solid #93c5fd' };
    if (s.includes('REJECTED') || s.includes('FAILED')) return { background: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5' };
    return { background: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1' };
  }
}
