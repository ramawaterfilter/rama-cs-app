import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-logistics-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './logistics-dashboard.component.html',
  styleUrls: ['./logistics-dashboard.component.scss']
})
export class LogisticsDashboardComponent implements OnInit {
  currentPage = 1;
  pageSize = 10;
  Math = Math;
  tickets: any[] = [];
  filteredTickets: any[] = [];
  loading = true;
  user: any;
  statuses: any[] = [];
  
  // Filter states
  searchTerm = '';
  filterOrderId = '';
  filterLogisticsStatus = '';
  fromDate = '';
  toDate = '';
  sortDate = 'desc';
  
  // Modal State
  showModal = false;
  selectedTicket: any = null;
  saving = false;
  updateForm = {
    status_id: '',
    remarks: '',
    tracking_id: ''
  };

  private http = inject(HttpClient);
  private notifService = inject(NotificationService);
  private authService = inject(AuthService);
  private apiUrl = '/api';

  ngOnInit() {
    this.user = this.authService.getUserData();
    this.loadData();
  }

  loadData() {
    this.loading = true;
    this.http.get<any[]>(`${this.apiUrl}/logistics`).subscribe({
      next: (data) => {
        this.tickets = data;
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching logistics tickets', err);
        this.loading = false;
      }
    });

    this.http.get<any[]>(`${this.apiUrl}/statuses?type=logistics`).subscribe({
      next: (s) => this.statuses = s
    });
  }

  showRejectInput = false;
  rejectionReason = '';

  openUpdateModal(ticket: any) {
    this.selectedTicket = ticket;
    this.updateForm.status_id = ticket.replacement ? ticket.replacement.status : (ticket.ticket_return ? ticket.ticket_return.status : '');
    this.updateForm.remarks = ticket.replacement ? ticket.replacement.remarks : (ticket.ticket_return ? ticket.ticket_return.remarks : '');
    this.updateForm.tracking_id = ticket.ticket_return ? (ticket.ticket_return.tracking_id || '') : '';
    this.showRejectInput = false;
    this.rejectionReason = '';
    this.showModal = true;
  }

  applyFilter() {
    let list = [...this.tickets];
    
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      list = list.filter(t =>
        t.customer_name?.toLowerCase().includes(term) ||
        t.customer_email?.toLowerCase().includes(term) ||
        t.order_id?.toLowerCase().includes(term)
      );
    }
    
    if (this.filterOrderId) {
      list = list.filter(t => t.order_id?.toLowerCase().includes(this.filterOrderId.toLowerCase()));
    }
    
    if (this.filterLogisticsStatus) {
      list = list.filter(t => {
        const ls = t.replacement ? t.replacement.status : (t.ticket_return ? t.ticket_return.status : '');
        return ls === this.filterLogisticsStatus;
      });
    }

    if (this.fromDate) {
      const fd = new Date(this.fromDate).setHours(0, 0, 0, 0);
      list = list.filter(t => new Date(t.created_at).getTime() >= fd);
    }
    
    if (this.toDate) {
      const td = new Date(this.toDate).setHours(23, 59, 59, 999);
      list = list.filter(t => new Date(t.created_at).getTime() <= td);
    }

    list.sort((a, b) => {
      const d1 = new Date(a.created_at).getTime();
      const d2 = new Date(b.created_at).getTime();
      return this.sortDate === 'desc' ? d2 - d1 : d1 - d2;
    });

    this.filteredTickets = list;
  }

  toggleSortDate() {
    this.sortDate = this.sortDate === 'desc' ? 'asc' : 'desc';
    this.applyFilter();
  }

  resetFilters() {
    this.searchTerm = '';
    this.filterOrderId = '';
    this.filterLogisticsStatus = '';
    this.fromDate = '';
    this.toDate = '';
    this.sortDate = 'desc';
    this.applyFilter();
  }

  closeModal() {
    this.showModal = false;
    this.selectedTicket = null;
    this.showRejectInput = false;
    this.rejectionReason = '';
  }

  approveLogistics() {
    if (!confirm('Are you sure you want to approve this logistics request?')) return;
    
    this.http.put(`${this.apiUrl}/tickets/${this.selectedTicket.id}/approve-logistics`, {}).subscribe({
      next: () => {
        this.notifService.showToast({ title: 'Success', message: 'Logistics request approved successfully', type: 'success' });
        this.closeModal();
        this.loadData();
      },
      error: (err) => {
        console.error('Error approving', err);
        this.notifService.showToast({ title: 'Error', message: 'Failed to approve logistics request', type: 'danger' });
      }
    });
  }

  confirmReject() {
    if (!this.rejectionReason.trim()) {
      this.notifService.showToast({ title: 'Error', message: 'Please enter a rejection reason', type: 'danger' });
      return;
    }
    if (!confirm('Are you sure you want to reject this logistics request?')) return;
    
    this.http.put(`${this.apiUrl}/tickets/${this.selectedTicket.id}/reject-logistics`, { reason: this.rejectionReason }).subscribe({
      next: () => {
        this.notifService.showToast({ title: 'Success', message: 'Logistics request rejected', type: 'success' });
        this.closeModal();
        this.loadData();
      },
      error: (err) => {
        console.error('Error rejecting', err);
        this.notifService.showToast({ title: 'Error', message: 'Failed to reject logistics request', type: 'danger' });
      }
    });
  }

  saveUpdate() {
    if (!this.selectedTicket) return;
    this.saving = true;

    const payload = {
      status: this.updateForm.status_id,
      remarks: this.updateForm.remarks,
      tracking_id: this.updateForm.tracking_id
    };

    let updateSub;
    if (this.selectedTicket.replacement && this.selectedTicket.replacement.le_id === this.user.id) {
      updateSub = this.http.put(`${this.apiUrl}/logistics/replacements/${this.selectedTicket.replacement.id}`, payload);
    } else if (this.selectedTicket.ticket_return && this.selectedTicket.ticket_return.le_id === this.user.id) {
      updateSub = this.http.put(`${this.apiUrl}/logistics/returns/${this.selectedTicket.ticket_return.id}`, payload);
    }

    if (updateSub) {
      updateSub.subscribe({
        next: () => {
          this.notifService.showToast({ title: 'Success', message: 'Logistics updated successfully!', type: 'success' });
          this.closeModal();
          this.loadData();
          this.saving = false;
        },
        error: (err) => {
          this.notifService.showToast({ title: 'Error', message: 'Failed to update logistics.', type: 'danger' });
          this.saving = false;
        }
      });
    } else {
      this.saving = false;
      this.notifService.showToast({ title: 'Error', message: 'This request is not assigned to you.', type: 'danger' });
    }
  }

  getLogisticsStatusStyle(status: string | undefined): { [key: string]: string } {
    if (!status) return { background: '#f0f1f3', color: '#495057', borderColor: '#dee2e6' };
    let color = '#6c757d'; // Default gray
    const lower = status.toLowerCase();
    
    if (lower.includes('progress') || lower.includes('process')) {
      color = '#f59f00'; // Warning orange
    } else if (lower.includes('pending') || lower.includes('review')) {
      color = '#e67700'; // Darker orange
    } else if (lower.includes('approv') || lower.includes('deliver') || lower.includes('complet')) {
      color = '#37b24d'; // Success green
    } else if (lower.includes('reject') || lower.includes('cancel') || lower.includes('fail')) {
      color = '#f03e3e'; // Danger red
    } else {
      color = '#1c7ed6'; // Primary blue
    }
    
    return {
      background: color + '22',
      color: color,
      borderColor: color + '55',
      border: '1px solid ' + color + '55'
    };
  }
}
