import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-user-profile-requests',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-profile-requests.component.html',
  styleUrls: ['./user-profile-requests.component.scss']
})
export class UserProfileRequestsComponent implements OnInit {
  private http = inject(HttpClient);
  private notifService = inject(NotificationService);

  requests: any[] = [];
  loading = false;
  
  showPasswordModal = false;
  selectedRequestId: number | null = null;
  newPassword = '';
  submitting = false;

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.loading = true;
    this.http.get('/api/password-reset-requests').subscribe({
      next: (res: any) => {
        this.requests = res;
        this.loading = false;
      },
      error: (err) => {
        this.notifService.showToast({ title: 'Error', message: 'Failed to load requests', type: 'danger' });
        this.loading = false;
      }
    });
  }

  openAcceptModal(id: number) {
    this.selectedRequestId = id;
    this.newPassword = '';
    this.showPasswordModal = true;
  }

  closeModal() {
    this.showPasswordModal = false;
    this.selectedRequestId = null;
    this.newPassword = '';
  }

  rejectRequest(id: number) {
    if(confirm('Are you sure you want to reject this request?')) {
      this.http.put(`/api/password-reset-requests/${id}`, { status: 'Rejected' }).subscribe({
        next: () => {
          this.notifService.showToast({ title: 'Success', message: 'Request rejected', type: 'success' });
          this.loadRequests();
        },
        error: () => this.notifService.showToast({ title: 'Error', message: 'Failed to reject request', type: 'danger' })
      });
    }
  }

  acceptRequest() {
    if(!this.newPassword) return;
    this.submitting = true;
    this.http.put(`/api/password-reset-requests/${this.selectedRequestId}`, { 
      status: 'Accepted',
      new_password: this.newPassword
    }).subscribe({
      next: () => {
        this.notifService.showToast({ title: 'Success', message: 'Password reset successfully and request accepted', type: 'success' });
        this.submitting = false;
        this.closeModal();
        this.loadRequests();
      },
      error: () => {
        this.notifService.showToast({ title: 'Error', message: 'Failed to accept request', type: 'danger' });
        this.submitting = false;
      }
    });
  }
}
