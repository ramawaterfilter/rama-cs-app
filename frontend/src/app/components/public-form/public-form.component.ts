import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

import { AuthService } from '../../services/auth.service';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-public-form',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './public-form.component.html',
})
export class PublicFormComponent implements OnInit {
  formData: any = {
    agent_name: '',
    agent_email: '',
    order_id: '',
    purchase_store: '',
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    query_channel_id: '',
    query_type_id: '',
    query_filter_id: '',
    customer_outreach_id: '',
    country_id: '',
    address: '',
    executive_id: '',
    status_id: ''
  };
  
  channels: any[] = [];
  queryTypes: any[] = [];
  queryFilters: any[] = [];
  outreaches: any[] = [];
  purchaseStores: any[] = [];
  countries: any[] = [];
  categories: any[] = [];
  statuses: any[] = [];
  executives: any[] = [];
  
  // Search strings
  catSearch = '';
  subSearch = '';
  childSearch = '';
  
  // Dropdown visibility
  showCatDropdown = false;
  showSubDropdown = false;
  showChildDropdown = false;
  
  selectedCategoryId: any = '';
  selectedSubcategoryId: any = '';
  selectedChildCategoryId: any = '';

  selectedCatName = '';
  selectedSubName = '';
  selectedChildName = '';

  successMsg = '';
  errorMsg = '';
  loading = false;
  
  private http = inject(HttpClient);
  public authService = inject(AuthService);
  private notifService = inject(NotificationService);
  private apiUrl = '/api';

  ngOnInit() {
    this.http.get<any[]>(`${this.apiUrl}/categories/public`).subscribe(d => this.categories = d);
    this.http.get<any[]>(`${this.apiUrl}/query-channels/public`).subscribe(d => this.channels = d);
    this.http.get<any[]>(`${this.apiUrl}/query-types/public`).subscribe(d => this.queryTypes = d);
    this.http.get<any[]>(`${this.apiUrl}/query-filters/public`).subscribe(d => this.queryFilters = d);
    this.http.get<any[]>(`${this.apiUrl}/customer-outreaches/public`).subscribe(d => this.outreaches = d);
    this.http.get<any[]>(`${this.apiUrl}/purchase-stores/public`).subscribe(d => this.purchaseStores = d);
    this.http.get<any[]>(`${this.apiUrl}/countries/public`).subscribe(d => this.countries = d);
    this.http.get<any[]>(`${this.apiUrl}/statuses/public?type=general`).subscribe(d => this.statuses = d);

    // Auto-fill agent details if user is logged in
    const user = this.authService.getUserData();
    if (user) {
      this.formData.agent_name = user.name;
      this.formData.agent_email = user.email;
      
      if (user.role === 'admin') {
        this.http.get<any[]>(`${this.apiUrl}/cse-list`).subscribe({
          next: (d) => this.executives = d,
          error: (err) => console.error('Failed to load executives', err)
        });
      }
    }
  }

  // Filtered lists for searchable dropdowns
  get filteredCategories() {
    if (!this.formData.query_type_id) return [];
    
    const cats = this.categories.filter(c => 
      c.query_type_id == this.formData.query_type_id && 
      (!c.parents || c.parents.length === 0)
    );
    
    return cats.filter(c => c.name && c.name.toLowerCase().includes(this.catSearch.toLowerCase()));
  }

  get filteredSubCategories() {
    if (!this.selectedCategoryId) return [];
    const subs = this.categories.filter(c => c.parents && c.parents.some((p:any) => p.id == this.selectedCategoryId));
    return subs.filter(c => c.name && c.name.toLowerCase().includes(this.subSearch.toLowerCase()));
  }

  get filteredChildCategories() {
    if (!this.selectedSubcategoryId) return [];
    const children = this.categories.filter(c => c.parents && c.parents.some((p:any) => p.id == this.selectedSubcategoryId));
    return children.filter(c => c.name && c.name.toLowerCase().includes(this.childSearch.toLowerCase()));
  }

  selectCategory(c: any) {
    this.selectedCategoryId = c.id;
    this.selectedCatName = c.name;
    this.catSearch = c.name;
    this.showCatDropdown = false;
    this.onCategoryChange();
  }

  selectSubcategory(c: any) {
    this.selectedSubcategoryId = c.id;
    this.selectedSubName = c.name;
    this.subSearch = c.name;
    this.showSubDropdown = false;
    this.onSubcategoryChange();
  }

  selectChildCategory(c: any) {
    this.selectedChildCategoryId = c.id;
    this.selectedChildName = c.name;
    this.childSearch = c.name;
    this.showChildDropdown = false;
  }

  onTypeChange() {
    this.selectedCategoryId = '';
    this.selectedCatName = '';
    this.catSearch = '';
    this.onCategoryChange();
  }

  onCategoryChange() {
    this.selectedSubcategoryId = '';
    this.selectedSubName = '';
    this.subSearch = '';
    this.onSubcategoryChange();
  }

  onSubcategoryChange() {
    this.selectedChildCategoryId = '';
    this.selectedChildName = '';
    this.childSearch = '';
  }

  hideDropdowns() {
    setTimeout(() => {
      this.showCatDropdown = false;
      this.showSubDropdown = false;
      this.showChildDropdown = false;
    }, 200);
  }

  onSubmit(form: any) {
    if (form.invalid) {
      this.errorMsg = 'Please fill all required fields correctly.';
      window.scrollTo(0, 0);
      return;
    }

    const payload = {
      ...this.formData,
      category_id: this.selectedCategoryId,
      sub_category_id: this.selectedSubcategoryId,
      child_category_id: this.selectedChildCategoryId
    };

    this.loading = true;
    this.successMsg = '';
    this.errorMsg = '';
    this.http.post(`${this.apiUrl}/tickets/public`, payload).subscribe({
      next: (res: any) => {
        this.loading = false;
        this.successMsg = 'Your query has been submitted successfully.';
        this.notifService.refresh(); // Update the notification bell immediately
        this.formData = {
          query_channel_id: '',
          query_type_id: '',
          query_filter_id: '',
          customer_outreach_id: '',
          purchase_type_id: '',
          country_id: '',
          state_id: '',
          address: '',
          executive_id: '',
          status_id: ''
        }; 
        this.selectedCategoryId = '';
        this.selectedSubcategoryId = '';
        this.selectedChildCategoryId = '';
        this.selectedCatName = '';
        this.selectedSubName = '';
        this.selectedChildName = '';
        this.catSearch = '';
        this.subSearch = '';
        this.childSearch = '';
        form.resetForm();
        window.scrollTo(0, 0);
      },
      error: (err) => {
        this.loading = false;
        this.errorMsg = 'Error submitting query. Please try again.';
        window.scrollTo(0, 0);
      }
    });
  }
}
