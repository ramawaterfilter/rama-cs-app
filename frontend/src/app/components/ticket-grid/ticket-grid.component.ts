import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';
import { Router, ActivatedRoute } from '@angular/router';
import { NotificationService } from '../../services/notification.service';
import { productNameOptions, productSkuOptions, pickCatalogProduct, ORDERED_PRODUCT_KEYS, REPLACEMENT_PRODUCT_KEYS } from '../../product-options';

@Component({
  selector: 'app-ticket-grid',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './ticket-grid.component.html',
})
export class TicketGridComponent implements OnInit {
  tickets: any[] = [];
  filteredTickets: any[] = [];
  statuses: any[] = [];
  cses: any[] = [];
  les: any[] = [];
  user: any;
  isAdmin = false;
  isRequestsView = false;
  masterDataLoaded = false;
  loading = true;
  searchTerm = '';
  filterStatus = '';
  filterCategory = '';
  filterAssignee = '';
  filterOrderId = '';
  filterCustomerEmail = '';
  fromDate = '';
  toDate = '';
  sortDate = 'desc';
  currentPage = 1;
  pageSize = 10;
  Math = Math;
  categories: any[] = [];
  channels: any[] = [];
  queryTypes: any[] = [];
  queryFilters: any[] = [];
  countries: any[] = [];
  outreaches: any[] = [];
  purchaseStores: any[] = [];
  products: any[] = [];

  // product dropdowns — shared helpers from product-options.ts
  nameOptions = (current: string) => productNameOptions(this.products, current);
  skuOptions = (current: string) => productSkuOptions(this.products, current);
  pickOrdered = (form: any, by: 'name' | 'sku', value: string) => pickCatalogProduct(this.products, form, ORDERED_PRODUCT_KEYS, by, value);
  pickReplacement = (form: any, by: 'name' | 'sku', value: string) => pickCatalogProduct(this.products, form, REPLACEMENT_PRODUCT_KEYS, by, value);

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
    
    if (this.router.url.includes('ticket-requests')) {
      this.isRequestsView = true;
    }

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

    this.notifService.allTickets$.subscribe(data => {
      if (data !== null) {
        this.tickets = data;
        this.applyFilter(false);
        this.loading = false;
        
        // Open the modal if a specific ticket was requested from notification click
        if (this.requestedTicketIdToOpen && !this.showModal) {
          const t = this.tickets.find(x => x.id === this.requestedTicketIdToOpen);
          if (t) {
            this.openTicket(t);
            this.requestedTicketIdToOpen = null;
          }
        } else if (this.showModal && this.selectedTicket) {
          // Update the selected ticket data in case it was modified (e.g. edit requested)
          const updatedT = this.tickets.find(x => x.id === this.selectedTicket.id);
          if (updatedT) {
            this.selectedTicket = updatedT;
          }
        }
      }
      
      // Load master data only after tickets have loaded to prevent network bottleneck
      if (!this.masterDataLoaded) {
        this.masterDataLoaded = true;
        this.loadAll();
      }
    });
  }

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
      next: (d) => this.products = d,
      error: (err) => console.error('Failed to load products:', err)
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

  applyFilter(resetPage = true) {
    let list = [...this.tickets];
    if (this.searchTerm) {
      const term = this.searchTerm.toLowerCase();
      list = list.filter(t =>
        t.customer_name?.toLowerCase().includes(term) ||
        t.customer_email?.toLowerCase().includes(term) ||
        t.customer_phone?.toLowerCase().includes(term) ||
        t.agent_name?.toLowerCase().includes(term) ||
        t.description?.toLowerCase().includes(term) ||
        t.order_id?.toLowerCase().includes(term) ||
        t.query_type?.name?.toLowerCase().includes(term) ||
        t.type_of_query?.toLowerCase().includes(term) ||
        t.category?.name?.toLowerCase().includes(term) ||
        t.sub_category?.name?.toLowerCase().includes(term) ||
        t.child_category?.name?.toLowerCase().includes(term)
      );
    }
    if (this.filterOrderId) {
      list = list.filter(t => t.order_id?.toLowerCase().includes(this.filterOrderId.toLowerCase()));
    }
    if (this.filterCustomerEmail) {
      const email = this.filterCustomerEmail.toLowerCase();
      list = list.filter(t => t.customer_email?.toLowerCase().includes(email));
    }
    if (this.filterStatus) {
      list = list.filter(t => String(t.status_id) === String(this.filterStatus));
    }
    if (this.filterCategory) {
      list = list.filter(t => String(t.category_id) === String(this.filterCategory));
    }
    if (this.filterAssignee) {
      if (this.filterAssignee === 'unassigned') {
        list = list.filter(t => !t.executive_id);
      } else {
        list = list.filter(t => String(t.executive_id) === String(this.filterAssignee));
      }
    }
    
    if (this.fromDate) {
      const fd = new Date(this.fromDate).setHours(0, 0, 0, 0);
      list = list.filter(t => new Date(t.received_at).getTime() >= fd);
    }
    if (this.toDate) {
      const td = new Date(this.toDate).setHours(23, 59, 59, 999);
      list = list.filter(t => new Date(t.received_at).getTime() <= td);
    }
    
    list.sort((a, b) => {
      const d1 = new Date(a.created_at).getTime();
      const d2 = new Date(b.created_at).getTime();
      return this.sortDate === 'desc' ? d2 - d1 : d1 - d2;
    });

    if (this.isRequestsView) {
      list = list.filter(t => (t.edit_requested && !t.edit_approved) || (t.profile_edit_requested && !t.profile_edit_approved));
    }

    this.filteredTickets = list;
    // ponytail: never lose the user's page on a background poll — only clamp it
    const pages = Math.max(1, Math.ceil(list.length / this.pageSize));
    this.currentPage = resetPage ? 1 : Math.min(this.currentPage, pages);
  }

  toggleSortDate() {
    this.sortDate = this.sortDate === 'desc' ? 'asc' : 'desc';
    this.applyFilter();
  }

  resetFilters() {
    this.searchTerm = '';
    this.filterOrderId = '';
    this.filterCustomerEmail = '';
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

  buildExportRows() {
    return this.filteredTickets.map(t => {
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
        'Address': t.address,
        'Query Channel': t.query_channel?.name || t.query_source,
        'Query Type': t.query_type?.name || t.type_of_query,
        'Category': t.category?.name,
        'Sub-Category': t.sub_category?.name,
        'Child-Category': t.child_category?.name,
        'Description': t.description,
        'Action Taken': t.remarks || t.action_taken,
        'Outreach': t.outreach?.name || t.customer_outreach,
        'Filters': t.query_filter?.name || t.filters,
        'Received At': t.received_at ? new Date(t.received_at).toLocaleString() : '',
        'Resolved At': t.resolved_at ? new Date(t.resolved_at).toLocaleString() : '',
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
        'Logistics Others': isReplacement ? t.replacement.others : '',
        'Marketplace': isReturn ? t.ticket_return.marketplace_channel : '',
        'Return Date': isReturn ? t.ticket_return.return_date : '',
        'No. of Boxes': isReturn ? t.ticket_return.no_of_boxes : '',
        'Inbound Ref No': isReturn ? t.ticket_return.inbound_ref_no : '',
        'Inbound Ref Date': isReturn ? t.ticket_return.inbound_ref_date : '',
        'Courier Name': isReturn ? t.ticket_return.courier_name : '',
        'Tracking ID': isReturn ? t.ticket_return.tracking_id : '',
        'LE Remarks': log ? log.remarks : ''
      };
    });
  }

  async exportXLSX() {
    const XLSX = await import('xlsx');
    const ws = XLSX.utils.json_to_sheet(this.buildExportRows());
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tickets');
    XLSX.writeFile(wb, 'Service_Tickets_Report.xlsx');
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
      received_at: ticket.received_at ? new Date(ticket.received_at).toISOString().slice(0, 16) : this.nowLocal(),
      resolved_at: ticket.resolved_at ? new Date(ticket.resolved_at).toISOString().slice(0, 16) : '',
      logistics_type: ticket.replacement ? 'replacement' : (ticket.ticket_return ? 'return' : 'nil'),
      replacement_form: ticket.replacement ? { ...ticket.replacement } : {
        le_id: '', ordered_product_name: '', ordered_product_sku: '', replacement_product_name: '', replacement_product_sku: '', replacement_qty: 1, replacement_reason: '', others: ''
      },
      return_form: ticket.ticket_return ? { ...ticket.ticket_return } : {
        le_id: '', marketplace_channel: '', country_id: '', ordered_product_name: '', ordered_product_sku: '', return_reasons: '', return_date: this.today(), courier_name: '', tracking_id: '', no_of_boxes: 1, inbound_ref_no: '', inbound_ref_date: this.today()
      }
    };
    this.saveMsg = '';
    this.errorMsg = '';
    this.showModal = true;
  }

  onUpdateStatusChange(id: any) {
    const s = this.statuses.find(x => x.id == id);
    if (s && /close|resolv|complete/i.test(s.name)) {
      if (!this.updateForm.resolved_at) this.updateForm.resolved_at = this.nowLocal();
    } else {
      this.updateForm.resolved_at = '';
    }
  }

  private nowLocal() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  }

  private today() {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
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
    
    // Add profile fields if Admin, if CSE has profile edit approval, or when
    // they ride along with a replacement request (dispatch needs the address)
    if (this.isAdmin || this.selectedTicket.profile_edit_approved || this.updateForm.logistics_type === 'replacement') {
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
      payload.resolved_at = this.updateForm.resolved_at;
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
