import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { NotificationService } from '../../services/notification.service';
import { AuthService } from '../../services/auth.service';
import { productNameOptions, productSkuOptions, pickCatalogProduct, ORDERED_PRODUCT_KEYS, REPLACEMENT_PRODUCT_KEYS } from '../../product-options';

@Component({
  selector: 'app-rejected-approvals',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './rejected-approvals.component.html',
  styleUrls: ['./rejected-approvals.component.scss']
})
export class RejectedApprovalsComponent implements OnInit {
  tickets: any[] = [];
  filteredTickets: any[] = [];
  loading = true;
  user: any;
  statuses: any[] = [];
  executives: any[] = [];
  products: any[] = [];

  // product dropdowns — shared helpers from product-options.ts
  nameOptions = (current: string) => productNameOptions(this.products, current);
  skuOptions = (current: string) => productSkuOptions(this.products, current);
  pickOrdered = (form: any, by: 'name' | 'sku', value: string) => pickCatalogProduct(this.products, form, ORDERED_PRODUCT_KEYS, by, value);
  pickReplacement = (form: any, by: 'name' | 'sku', value: string) => pickCatalogProduct(this.products, form, REPLACEMENT_PRODUCT_KEYS, by, value);
  
  // Filter states
  searchTerm = '';
  filterOrderId = '';
  fromDate = '';
  toDate = '';
  sortDate = 'desc';
  
  // Modal State
  showModal = false;
  selectedTicket: any = null;
  saving = false;
  updateForm: any = {
    logistics_type: '',
    replacement_form: { le_id: '', ordered_product_name: '', ordered_product_sku: '', replacement_product_name: '', replacement_product_sku: '', replacement_qty: 1, replacement_reason: '', others: '' },
    return_form: { le_id: '', ordered_product_name: '', ordered_product_sku: '', marketplace_channel: '', return_reasons: '', return_date: '', courier_name: '', tracking_id: '', no_of_boxes: 1, inbound_ref_no: '', inbound_ref_date: '' }
  };

  private http = inject(HttpClient);
  private notifService = inject(NotificationService);
  private authService = inject(AuthService);
  private apiUrl = '/api';

  ngOnInit() {
    this.user = this.authService.getUserData();
    this.loadData();
    this.http.get<any[]>(`${this.apiUrl}/le-list`).subscribe(d => this.executives = d);
    this.http.get<any[]>(`${this.apiUrl}/products`).subscribe(d => this.products = d);
  }

  loadData() {
    this.loading = true;
    this.http.get<any[]>(`${this.apiUrl}/logistics`).subscribe({
      next: (data) => {
        // Only keep rejected ones for this CSE
        this.tickets = data.filter(t => t.is_logistic_rejected && t.executive_id === this.user.id);
        this.applyFilter();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching rejected tickets', err);
        this.loading = false;
      }
    });
  }

  openUpdateModal(ticket: any) {
    this.selectedTicket = ticket;
    this.updateForm.logistics_type = ticket.replacement ? 'replacement' : (ticket.ticket_return ? 'return' : 'nil');
    this.updateForm.replacement_form = ticket.replacement ? { ...ticket.replacement } : { le_id: '', ordered_product_name: '', ordered_product_sku: '', replacement_product_name: '', replacement_product_sku: '', replacement_qty: 1, replacement_reason: '', others: '' };
    this.updateForm.return_form = ticket.ticket_return ? { ...ticket.ticket_return } : { le_id: '', ordered_product_name: '', ordered_product_sku: '', marketplace_channel: '', return_reasons: '', return_date: this.today(), courier_name: '', tracking_id: '', no_of_boxes: 1, inbound_ref_no: '', inbound_ref_date: this.today() };

    this.showModal = true;
  }

  private today() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
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
    this.fromDate = '';
    this.toDate = '';
    this.sortDate = 'desc';
    this.applyFilter();
  }

  closeModal() {
    this.showModal = false;
    this.selectedTicket = null;
  }

  saveUpdate() {
    this.saving = true;
    
    const payload: any = {
      logistics_type: this.updateForm.logistics_type,
      replacement_form: this.updateForm.replacement_form,
      return_form: this.updateForm.return_form
    };

    if (this.updateForm.logistics_type === 'replacement' && !this.updateForm.replacement_form.le_id) {
        this.notifService.showToast({ title: 'Error', message: 'Please assign a Logistics Executive for Replacement request.', type: 'danger' });
        this.saving = false;
        return;
    }
    if (this.updateForm.logistics_type === 'return' && !this.updateForm.return_form.le_id) {
        this.notifService.showToast({ title: 'Error', message: 'Please assign a Logistics Executive for Return request.', type: 'danger' });
        this.saving = false;
        return;
    }

    this.http.put(`${this.apiUrl}/tickets/${this.selectedTicket.id}`, payload).subscribe({
      next: () => {
        this.notifService.showToast({ title: 'Success', message: 'Logistics request re-submitted successfully', type: 'success' });
        this.saving = false;
        this.closeModal();
        this.loadData();
      },
      error: (err) => {
        console.error('Error updating logistics', err);
        this.notifService.showToast({ title: 'Error', message: 'Failed to update ticket', type: 'danger' });
        this.saving = false;
      }
    });
  }
}
