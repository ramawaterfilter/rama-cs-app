import { LucideAngularModule } from 'lucide-angular';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { NotificationService } from '../../services/notification.service';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


@Component({
  selector: 'app-ticket-grid',
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './ticket-grid.component.html'
})
export class TicketGridComponent implements OnInit {
  tickets: any[] = [];
  filteredTickets: any[] = [];
  statuses: any[] = [];
  cses: any[] = [];
  les: any[] = [];
  user: any;
  isAdmin = false;
  get isRequestsView(): boolean {
    return this.router.url.includes('ticket-requests');
  }

  get isAllTicketsView(): boolean {
    return this.router.url.includes('all-tickets-view');
  }
  masterDataLoaded = false;
  loading = true;
  searchTerm = '';
  filterStatus = '';
  filterCategory = '';
  filterAssignee = '';
  filterOrderId = '';
  fromDate = '';
  toDate = '';
  sortDate = 'desc';
  currentPage = 1;
  pageSize = 10;
  Math = Math;

  /** Autopopulate SKU when a product is chosen from the dropdown. */
  onProductSelect(form: any, nameField: string, skuField: string) {
    const p = this.products.find(x => x.name === form[nameField]);
    form[skuField] = p ? (p.sku || '') : '';
  }

  /** True if a saved free-text value isn't in the master list (legacy data). */
  isLegacyValue(list: any[], key: string, value: string): boolean {
    return !!value && !list.some(x => x[key] === value);
  }
  categories: any[] = [];
  channels: any[] = [];
  queryTypes: any[] = [];
  queryFilters: any[] = [];
  countries: any[] = [];
  outreaches: any[] = [];
  purchaseStores: any[] = [];
  products: any[] = [];
  returnReasons: any[] = [];
  replacementReasons: any[] = [];

  // Modal state
  showModal = false;
  selectedTicket: any = null;
  showViewModal = false;
  viewedTicket: any = null;
  allocateMode = false;
  saving = false;
  saveMsg = '';
  errorMsg = '';
  updateForm: any = {
    executive_id: '',
    status_id: '',
    remarks: '',
    agent_name: '',
    agent_email: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    country_id: '',
    state_id: '',
    address: '',
    query_channel_id: '',
    query_type_id: '',
    query_filter_id: '',
    category_id: '',
    sub_category_id: '',
    child_category_id: '',
    description: '',
    action_taken: '',
    order_id: '',
    purchase_store: '',
    purchase_type_id: '',
    customer_outreach_id: '',
    received_at: '',
    resolved_at: '',
    logistics_type: 'nil',
    replacement_form: {
      le_id: '',
      ordered_product_name: '',
      ordered_product_sku: '',
      replacement_product_name: '',
      replacement_product_sku: '',
      replacement_qty: 1,
      replacement_reason: '',
      others: ''
    },
    return_form: {
      le_id: '',
      marketplace_channel: '',
      country_id: '',
      ordered_product_name: '',
      ordered_product_sku: '',
      return_reasons: '',
      return_date: '',
      courier_name: '',
      tracking_id: '',
      no_of_boxes: 1,
      inbound_ref_no: '',
      inbound_ref_date: ''
    }
  };

  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);
  private notifService = inject(NotificationService);
  private apiUrl = '/api';
  private requestedTicketIdToOpen: number | null = null;


  ngOnInit() {
    this.user = this.authService.getUserData();
    this.isAdmin = this.user?.role === 'admin';

    this.router.events.pipe(
      filter(event => event instanceof NavigationEnd)
    ).subscribe(() => {
      this.currentPage = 1;
      this.loadTickets();
    });

    this.route.queryParams.subscribe(params => {
      if (params['openTicket']) {
        this.requestedTicketIdToOpen = Number(params['openTicket']);
        // If tickets are already loaded, open immediately (for same-page navigation)
        if (this.tickets && this.tickets.length > 0) {
          const t = this.tickets.find(x => x.id === this.requestedTicketIdToOpen);
          if (t) {
            this.openTicket(t);
            this.requestedTicketIdToOpen = null;
          }
        }
      }
    });

    this.loadTickets();
    this.loadAll(); // Load master data
  }

  loadTickets() {
    this.loading = true;

    let params: any = {
      page: this.currentPage,
      per_page: this.pageSize,
      sort_date: this.sortDate,
      is_requests: this.isRequestsView ? 'true' : 'false',
      view_all: this.isAllTicketsView ? 'true' : 'false'
    };

    if (this.searchTerm) params.search = this.searchTerm;
    if (this.filterOrderId) params.order_id = this.filterOrderId;
    if (this.filterStatus) params.status_id = this.filterStatus;
    if (this.filterCategory) params.category_id = this.filterCategory;
    if (this.filterAssignee) params.executive_id = this.filterAssignee;
    if (this.fromDate) params.from_date = this.fromDate;
    if (this.toDate) params.to_date = this.toDate;

    this.http.get<any>(`${this.apiUrl}/tickets`, { params }).subscribe({
      next: (res) => {
        // Assume Laravel pagination structure
        this.tickets = res.data;
        this.filteredTickets = res.data;
        // If we want to strictly keep the local filteredTickets variable, we assign it here.
        // We will need the total count to show pagination. But the template might be expecting `filteredTickets.length` to paginate locally.
        // Wait, the template has `<div *ngFor="let t of paginatedTickets">` probably? Or does it use `filteredTickets | slice`?
        // I need to check how the template does pagination before I can complete this logic, but for now I'll attach a total property.
        this.totalItems = res.total;

        this.loading = false;

        if (this.requestedTicketIdToOpen && !this.showModal) {
          const t = this.tickets.find(x => x.id === this.requestedTicketIdToOpen);
          if (t) {
            this.openTicket(t);
            this.requestedTicketIdToOpen = null;
          }
        } else if (this.showModal && this.selectedTicket) {
          const updatedT = this.tickets.find(x => x.id === this.selectedTicket.id);
          if (updatedT) {
            this.selectedTicket = updatedT;
          }
        }
      },
      error: (err) => {
        this.loading = false;
        console.error('Failed to load tickets', err);
      }
    });
  }

  totalItems = 0;

  loadAll() {
    this.http.get<any[]>(`${this.apiUrl}/statuses?type=general`).subscribe({
      next: (d) => this.statuses = d,
      error: (err) => console.error('Failed to load statuses:', err)
    });

    this.http.get<any[]>(`${this.apiUrl}/categories`).subscribe({
      next: (d) => this.categories = d,
      error: (err) => console.error('Failed to load categories:', err)
    });

    this.http.get<any[]>(`${this.apiUrl}/query-channels`).subscribe({
      next: (d) => this.channels = d,
      error: (err) => console.error('Failed to load query-channels:', err)
    });

    this.http.get<any[]>(`${this.apiUrl}/query-types`).subscribe({
      next: (d) => this.queryTypes = d,
      error: (err) => console.error('Failed to load query-types:', err)
    });

    this.http.get<any[]>(`${this.apiUrl}/query-filters`).subscribe({
      next: (d) => this.queryFilters = d,
      error: (err) => console.error('Failed to load query-filters:', err)
    });

    this.http.get<any[]>(`${this.apiUrl}/countries`).subscribe({
      next: (d) => this.countries = d,
      error: (err) => console.error('Failed to load countries:', err)
    });

    this.http.get<any[]>(`${this.apiUrl}/customer-outreaches`).subscribe({
      next: (d) => this.outreaches = d,
      error: (err) => console.error('Failed to load outreaches:', err)
    });

    this.http.get<any[]>(`${this.apiUrl}/purchase-stores`).subscribe({
      next: (d) => this.purchaseStores = d,
      error: (err) => console.error('Failed to load purchase-stores:', err)
    });

    this.http.get<any[]>(`${this.apiUrl}/products`).subscribe({
      next: (d) => this.products = (d || []).filter((p: any) => p.is_active),
      error: (err) => console.error('Failed to load products:', err)
    });

    this.http.get<any[]>(`${this.apiUrl}/logistics-reasons?active_only=1`).subscribe({
      next: (d) => {
        this.returnReasons = d.filter(r => r.type === 'return');
        this.replacementReasons = d.filter(r => r.type === 'replacement');
      },
      error: (err) => console.error('Failed to load logistics-reasons:', err)
    });

    if (this.isAdmin || this.user?.role === 'cse') {
      this.http.get<any[]>(`${this.apiUrl}/cse-list`).subscribe({
        next: (d) => this.cses = d,
        error: (err) => console.error('Failed to load cse-list:', err)
      });
      this.http.get<any[]>(`${this.apiUrl}/le-list`).subscribe({
        next: (d) => this.les = d,
        error: (err) => console.error('Failed to load le-list:', err)
      });
    }
  }

  applyFilter(resetPage: boolean = true) {
    if (resetPage) {
      this.currentPage = 1;
    }
    this.loadTickets();
  }

  toggleSortDate() {
    this.sortDate = this.sortDate === 'desc' ? 'asc' : 'desc';
    this.applyFilter();
  }

  resetFilters() {
    this.searchTerm = '';
    this.filterOrderId = '';
    this.filterCategory = '';
    this.filterAssignee = '';
    this.filterStatus = '';
    this.fromDate = '';
    this.toDate = '';
    this.sortDate = 'desc';
    this.applyFilter();
  }

  getLEName(id: any): string {
    if (!id) return '—';
    const le = this.les.find(x => String(x.id) === String(id));
    return le ? le.name : String(id);
  }



  async exportXLSX() {
    const XLSX = await import('xlsx').catch(err => {
      console.error('Failed to load Excel export library', err);
      alert('Excel export could not load. Please try again.');
      return null;
    });

    if (!XLSX) return;

    let params: any = {
      sort_date: this.sortDate,
      is_requests: this.isRequestsView ? 'true' : 'false',
      view_all: this.isAllTicketsView ? 'true' : 'false',
      export: 'true'
    };

    if (this.searchTerm) params.search = this.searchTerm;
    if (this.filterOrderId) params.order_id = this.filterOrderId;
    if (this.filterStatus) params.status_id = this.filterStatus;
    if (this.filterCategory) params.category_id = this.filterCategory;
    if (this.filterAssignee) params.executive_id = this.filterAssignee;
    if (this.fromDate) params.from_date = this.fromDate;
    if (this.toDate) params.to_date = this.toDate;

    this.loading = true;
    this.http.get<any[]>(`${this.apiUrl}/tickets`, { params }).subscribe({
      next: (fullData) => {
        this.loading = false;
        const data = fullData.map(t => {
          const isReplacement = !!t.replacement;
          const isReturn = !!t.ticket_return;
          const log = t.replacement || t.ticket_return || null;

          return {
            'Ticket #': t.id,
            'Agent Name': t.agent_name,
            'Agent Email': t.agent_email,
            'Order ID': t.order_id,
            'Customer Name': t.customer_name,
            'Customer Email': t.customer_email,
            'Customer Phone': t.customer_phone,
            'Purchase Store': t.purchase_store,
            'Country': t.country_dynamic?.name || t.country,
            'Query Channel': t.query_channel?.name || t.query_source,
            'Query Type': t.query_type?.name || t.type_of_query,
            'Category': t.category?.name,
            'Sub-Category': t.sub_category?.name,
            'Child-Category': t.child_category?.name,
            'Description': t.description,
            'Action Taken': t.action_taken,
            'Outreach': t.outreach?.name || t.customer_outreach,
            'Filters': t.query_filter?.name || t.filters,
            'Received At': t.received_at ? new Date(t.received_at).toLocaleString() : '',
            'Resolved At': t.resolved_at ? new Date(t.resolved_at).toLocaleString() : '',
            'Last Updated': t.updated_at ? new Date(t.updated_at).toLocaleString() + (t.last_updater ? ' by ' + t.last_updater.name : '') : '',
            'Form Submitted': t.created_at ? new Date(t.created_at).toLocaleString() : '',
            'Status': t.status?.name,
            'Assigned Executive': t.executive?.name || '',
            'Logistics Type': isReplacement ? 'Replacement' : (isReturn ? 'Return' : ''),
            'Assigned LE': log ? (log.le?.name || this.getLEName(log.le_id)) : '',
            'Logistics Status': log ? log.status : '',
            'Ordered Product': log ? `${log.ordered_product_name} (${log.ordered_product_sku})` : '',
            'Replacement Product': isReplacement ? `${t.replacement.replacement_product_name} (${t.replacement.replacement_product_sku})` : '',
            'Logistics Qty': isReplacement ? t.replacement.replacement_qty : '',
            'Logistics Reason': isReplacement ? t.replacement.replacement_reason : (isReturn ? t.ticket_return.return_reasons : ''),
            'Courier Name': isReturn ? t.ticket_return.courier_name : '',
            'Tracking ID': isReturn ? t.ticket_return.tracking_id : '',
            'LE Remarks': log ? log.remarks : ''
          };
        });


        const ws = XLSX.utils.json_to_sheet(data);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'Tickets');
        XLSX.writeFile(wb, 'Service_Tickets_Report.xlsx');
      },
      error: (err) => {
        this.loading = false;
        console.error('Failed to export data', err);
      }
    });
  }

  openTicket(ticket: any, allocate = false) {
    this.selectedTicket = ticket;
    this.allocateMode = allocate;
    this.updateForm = {
      executive_id: ticket.executive_id || '',
      status_id: ticket.status_id || '',
      remarks: ticket.remarks || '',
      agent_name: ticket.agent_name || '',
      agent_email: ticket.agent_email || '',
      customer_name: ticket.customer_name || '',
      customer_email: ticket.customer_email || '',
      customer_phone: ticket.customer_phone || '',
      country_id: ticket.country_id || '',
      address: ticket.address || '',
      query_channel_id: ticket.query_channel_id || '',
      query_type_id: ticket.query_type_id || '',
      query_filter_id: ticket.query_filter_id || '',
      category_id: ticket.category_id || '',
      sub_category_id: ticket.sub_category_id || '',
      child_category_id: ticket.child_category_id || '',
      description: ticket.description || '',
      action_taken: ticket.action_taken || '',
      order_id: ticket.order_id || '',
      purchase_store: ticket.purchase_store || '',
      customer_outreach_id: ticket.customer_outreach_id || '',
      received_at: ticket.received_at ? new Date(ticket.received_at).toISOString().slice(0, 16) : '',
      resolved_at: ticket.resolved_at ? new Date(ticket.resolved_at).toISOString().slice(0, 16) : '',
      logistics_type: ticket.replacement ? 'replacement' : (ticket.ticket_return ? 'return' : 'nil'),
      replacement_form: ticket.replacement ? { ...ticket.replacement } : {
        le_id: '', ordered_product_name: '', ordered_product_sku: '', replacement_product_name: '', replacement_product_sku: '', replacement_qty: 1, replacement_reason: '', others: ''
      },
      return_form: ticket.ticket_return ? { ...ticket.ticket_return } : {
        le_id: '', marketplace_channel: '', country_id: '', ordered_product_name: '', ordered_product_sku: '', return_reasons: '', return_date: '', courier_name: '', tracking_id: '', no_of_boxes: 1, inbound_ref_no: '', inbound_ref_date: ''
      }
    };
    this.saveMsg = '';
    this.errorMsg = '';
    this.showModal = true;
  }

  closeModal() {
    this.showModal = false;
    this.selectedTicket = null;

    if (this.router.url.includes('openTicket')) {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { openTicket: null },
        queryParamsHandling: 'merge'
      });
    }
  }

  viewTicket(ticket: any) {
    this.viewedTicket = ticket;
    this.showViewModal = true;
  }

  closeViewModal() {
    this.showViewModal = false;
    this.viewedTicket = null;
  }

  saveTicket() {
    if (!this.selectedTicket) return;
    this.saving = true;
    const payload: any = {
      status_id: this.updateForm.status_id,
      remarks: this.updateForm.remarks
    };

    // Add profile fields if Admin or if CSE has profile edit approval
    if (this.isAdmin || this.selectedTicket.profile_edit_approved) {
      payload.customer_name = this.updateForm.customer_name;
      payload.customer_email = this.updateForm.customer_email;
      payload.customer_phone = this.updateForm.customer_phone;
      payload.country_id = this.updateForm.country_id;
      payload.address = this.updateForm.address;
    }

    // Add general fields if Admin or if CSE has general edit approval or if it's the first update
    const canUpdateGeneral = this.isAdmin || this.selectedTicket.edit_approved || !this.selectedTicket.has_been_updated;

    if (canUpdateGeneral) {
      if (this.updateForm.logistics_type === 'replacement' && !this.updateForm.replacement_form.le_id) {
        this.errorMsg = 'Please assign a Logistics Executive for Replacement request.';
        this.saving = false;
        return;
      }
      if (this.updateForm.logistics_type === 'return' && !this.updateForm.return_form.le_id) {
        this.errorMsg = 'Please assign a Logistics Executive for Return request.';
        this.saving = false;
        return;
      }

      payload.query_channel_id = this.updateForm.query_channel_id;
      payload.query_type_id = this.updateForm.query_type_id;
      payload.query_filter_id = this.updateForm.query_filter_id;
      payload.category_id = this.updateForm.category_id;
      payload.sub_category_id = this.updateForm.sub_category_id;
      payload.child_category_id = this.updateForm.child_category_id;
      payload.description = this.updateForm.description;
      payload.action_taken = this.updateForm.action_taken;
      payload.order_id = this.updateForm.order_id;
      payload.purchase_store = this.updateForm.purchase_store;
      payload.customer_outreach_id = this.updateForm.customer_outreach_id;
      payload.received_at = this.updateForm.received_at;

      payload.logistics_type = this.updateForm.logistics_type;
      payload.replacement_form = this.updateForm.replacement_form;
      payload.return_form = this.updateForm.return_form;
    }

    if (this.isAdmin && this.updateForm.executive_id) {
      payload.executive_id = this.updateForm.executive_id;
      payload.is_allocated = true;
    }

    this.http.put(`${this.apiUrl}/tickets/${this.selectedTicket.id}`, payload).subscribe({
      next: () => {
        this.saving = false;
        this.saveMsg = 'Ticket updated successfully!';
        this.notifService.refresh();
        this.loadTickets();
        setTimeout(() => this.closeModal(), 1200);
      },
      error: () => {
        this.saving = false;
        this.saveMsg = 'Error updating ticket.';
      }
    });
  }

  getStatusName(id: any) {
    const s = this.statuses.find(s => s.id == id);
    return s ? s.name : 'N/A';
  }

  /** Returns an inline-style object driven by the status color stored in the DB. */
  getStatusStyle(ticket: any): { [key: string]: string } {
    const color = ticket.status?.color;
    if (!color) return { background: '#f0f1f3', color: '#495057', borderColor: '#dee2e6' };
    return {
      background: color + '22',
      color: color,
      borderColor: color + '55',
      border: '1px solid ' + color + '55'
    };
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

  /** Color-dot background for the status color dot */
  getStatusDotColor(ticket: any): string {
    return ticket.status?.color || '#adb5bd';
  }

  deleteTicket(id: number) {
    if (!confirm('Are you sure you want to delete this ticket? This action cannot be undone.')) return;

    this.http.delete(`${this.apiUrl}/tickets/${id}`).subscribe({
      next: () => {
        this.notifService.refresh();
      },
      error: err => {
        alert('Failed to delete ticket');
      }
    });
  }

  requestEdit() {
    this.saving = true;
    this.http.post(`${this.apiUrl}/tickets/${this.selectedTicket.id}/request-edit`, {}).subscribe({
      next: () => {
        this.saveMsg = 'Edit request sent successfully!';
        this.saving = false;
        this.selectedTicket.edit_requested = true;
        this.notifService.refresh();
      },
      error: () => {
        this.saveMsg = 'Error sending edit request.';
        this.saving = false;
      }
    });
  }

  approveEdit() {
    this.saving = true;
    this.http.post(`${this.apiUrl}/tickets/${this.selectedTicket.id}/approve-edit`, {}).subscribe({
      next: () => {
        this.saveMsg = 'Edit request approved!';
        this.saving = false;
        this.selectedTicket.edit_requested = false;
        this.selectedTicket.edit_approved = true;
        this.notifService.refresh();
      },
      error: () => {
        this.saveMsg = 'Error approving edit request.';
        this.saving = false;
      }
    });
  }

  requestProfileEdit() {
    this.saving = true;
    this.http.post(`${this.apiUrl}/tickets/${this.selectedTicket.id}/request-profile-edit`, {}).subscribe({
      next: () => {
        this.saveMsg = 'Profile Edit request sent!';
        this.saving = false;
        this.selectedTicket.profile_edit_requested = true;
        this.notifService.refresh();
      },
      error: () => {
        this.saveMsg = 'Error sending profile edit request.';
        this.saving = false;
      }
    });
  }

  approveProfileEdit() {
    this.saving = true;
    this.http.post(`${this.apiUrl}/tickets/${this.selectedTicket.id}/approve-profile-edit`, {}).subscribe({
      next: () => {
        this.saveMsg = 'Profile Edit request approved!';
        this.saving = false;
        this.selectedTicket.profile_edit_requested = false;
        this.selectedTicket.profile_edit_approved = true;
        this.notifService.refresh();
      },
      error: () => {
        this.saveMsg = 'Error approving profile edit request.';
        this.saving = false;
      }
    });
  }
}
