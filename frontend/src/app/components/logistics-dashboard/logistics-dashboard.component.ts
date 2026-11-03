import { LucideAngularModule } from 'lucide-angular';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-logistics-dashboard',
    imports: [CommonModule, FormsModule, LucideAngularModule],
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
    remarks: ''
  };

  private http = inject(HttpClient);
  private notifService = inject(NotificationService);
  private authService = inject(AuthService);
  private apiUrl = '/api';

  ngOnInit() {
    this.user = this.authService.getUserData();
    this.loadData();
  }

  totalItems = 0;

  loadData() {
    this.loading = true;
    
    let params: any = {
      page: this.currentPage,
      per_page: this.pageSize,
      sort_date: this.sortDate
    };

    if (this.searchTerm) params.search = this.searchTerm;
    if (this.filterOrderId) params.order_id = this.filterOrderId;
    if (this.filterLogisticsStatus) params.logistics_status = this.filterLogisticsStatus;
    if (this.fromDate) params.from_date = this.fromDate;
    if (this.toDate) params.to_date = this.toDate;

    this.http.get<any>(`${this.apiUrl}/logistics`, { params }).subscribe({
      next: (res) => {
        this.tickets = res.data;
        this.filteredTickets = res.data;
        this.totalItems = res.total;
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching logistics tickets', err);
        this.loading = false;
      }
    });

    if (this.statuses.length === 0) {
      this.http.get<any[]>(`${this.apiUrl}/statuses?type=logistics`).subscribe({
        next: (s) => this.statuses = s
      });
    }
  }

  showRejectInput = false;
  rejectionReason = '';

  openUpdateModal(ticket: any) {
    this.selectedTicket = ticket;
    this.updateForm.status_id = ticket.replacement ? ticket.replacement.status : (ticket.ticket_return ? ticket.ticket_return.status : '');
    this.updateForm.remarks = ticket.replacement ? ticket.replacement.remarks : (ticket.ticket_return ? ticket.ticket_return.remarks : '');
    this.showRejectInput = false;
    this.rejectionReason = '';
    this.showModal = true;
  }

  applyFilter(resetPage: boolean = true) {
    if (resetPage) {
      this.currentPage = 1;
    }
    this.loadData();
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
      remarks: this.updateForm.remarks
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
