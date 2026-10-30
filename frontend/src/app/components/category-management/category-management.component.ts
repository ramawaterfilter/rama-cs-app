import { LucideAngularModule } from 'lucide-angular';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-category-management',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './category-management.component.html',
})
export class CategoryManagementComponent implements OnInit {
  totalItems = 0;
  allCategories: any[] = [];
  currentPage = 1;
  pageSize = 10;
  Math = Math;
  categories: any[] = [];
  queryTypes: any[] = [];
  showModal = false;
  editMode = false;
  saving = false;
  saveMsg = '';
  showBulkModal = false;
  bulkFile: File | null = null;
  bulkRows: any[] = [];
  bulkErrors: string[] = [];
  bulkMessage = '';
  bulkBusy = false;
  bulkFormat = 'hierarchy';

  openBulk() {
    this.bulkFile = null;
    this.bulkRows = [];
    this.bulkErrors = [];
    this.bulkMessage = '';
    this.showBulkModal = true;
  }

  selectBulkFile(event: Event) {
    this.bulkFile = (event.target as HTMLInputElement).files?.[0] ?? null;
    this.bulkRows = [];
    this.bulkErrors = [];
    this.bulkMessage = '';
    if (this.bulkFile && (!this.bulkFile.name.toLowerCase().endsWith('.csv') || this.bulkFile.size > 1024 * 1024)) {
      this.bulkErrors = ['Select a CSV file no larger than 1 MB.'];
      this.bulkFile = null;
    }
  }

  downloadBulkTemplate() {
    this.bulkBusy = true;
    this.http.get(`${this.apiUrl}/categories/bulk-template`, { responseType: 'blob' }).subscribe({
      next: blob => {
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'category-upload-sample.csv';
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        this.bulkBusy = false;
      },
      error: () => {
        this.bulkBusy = false;
        this.bulkErrors = ['Could not download the template. Please try again.'];
      }
    });
  }

  uploadBulk(apply = false) {
    if (!this.bulkFile || this.bulkBusy) return;
    const payload = new FormData();
    payload.append('file', this.bulkFile);
    payload.append('apply', apply ? '1' : '0');
    this.bulkBusy = true;
    this.bulkErrors = [];
    this.bulkMessage = '';
    this.http.post<any>(`${this.apiUrl}/categories/bulk`, payload).subscribe({
      next: result => {
        this.bulkBusy = false;
        if (apply) {
          this.bulkMessage = result.message;
          this.bulkRows = [];
          this.bulkFile = null;
          this.load();
        } else {
          this.bulkFormat = result.format || 'legacy';
          this.bulkRows = result.rows;
          this.bulkMessage = result.message || '';
        }
      },
      error: err => {
        this.bulkBusy = false;
        this.bulkRows = [];
        this.bulkErrors = err.error?.errors
          ? Object.values(err.error.errors).flat().map(String)
          : ['The request failed. No partial changes are saved. Check the category list before retrying if the connection was interrupted.'];
      }
    });
  }

  form: any = { name: '', type: 'category', query_type_id: null, parent_ids: [] };
  editId: any = null;
  categorySearch = '';
  showCatDropdown = false;

  private http = inject(HttpClient);
  private apiUrl = '/api';

  ngOnInit() { this.load(); }

  load() {
    let url = `${this.apiUrl}/categories?page=${this.currentPage}&per_page=${this.pageSize}`;
    if (this.filterQueryType) url += `&query_type_id=${this.filterQueryType}`;
    if (this.searchCategoryTerm) url += `&search=${encodeURIComponent(this.searchCategoryTerm)}`;

    this.http.get<any>(url).subscribe(res => {
      this.categories = res.data ? res.data : res;
      this.totalItems = res.total || this.categories.length;
    });
    this.http.get<any>(`${this.apiUrl}/categories`).subscribe(d => this.allCategories = d);
    this.http.get<any[]>(`${this.apiUrl}/query-types`).subscribe(d => this.queryTypes = d);
  }

  onFilterChange() {
    this.currentPage = 1;
    this.load();
  }

  getParentPath(cat: any): string {
    if (!cat.parents || cat.parents.length === 0) return '—';
    return cat.parents.map((p:any) => p.name).join(' > ');
  }

  openNew() {
    this.form = { name: '', type: 'category', query_type_id: null, parent_ids: [] };
    this.editId = null;
    this.editMode = false;
    this.saveMsg = '';
    this.showModal = true;
  }

  openEdit(cat: any) {
    this.form = { 
        name: cat.name, 
        type: cat.type || 'category',
        query_type_id: cat.query_type_id || null, 
        parent_ids: cat.parents ? cat.parents.map((p:any) => p.id) : [] 
    };
    this.editId = cat.id;
    this.editMode = true;
    this.saveMsg = '';
    this.showModal = true;
  }

  save() {
    this.saving = true;
    const payload = { ...this.form };

    const req = this.editMode
      ? this.http.put(`${this.apiUrl}/categories/${this.editId}`, payload)
      : this.http.post(`${this.apiUrl}/categories`, payload);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.saveMsg = this.editMode ? 'Category updated!' : 'Category created!';
        this.load();
        setTimeout(() => this.closeModal(), 1000);
      },
      error: (err) => { 
        this.saving = false; 
        this.saveMsg = err.error?.message ? 'Error: ' + err.error.message : 'Error saving category.'; 
      }
    });
  }

  delete(id: any) {
    if (!confirm('Delete this category?')) return;
    this.http.delete(`${this.apiUrl}/categories/${id}`).subscribe(() => this.load());
  }

  closeModal() { this.showModal = false; }

  searchCategoryTerm = '';
  filterQueryType = '';

  
  
  

  getCategoryName(id: any) {
    const c = this.allCategories.find((c:any) => c.id == id);
    return c ? c.name : '';
  }

  getQueryTypeName(qtId: any) {
    const qt = this.queryTypes.find(q => q.id == qtId);
    return qt ? qt.name : '';
  }

  availableParents() {
    let parents = this.allCategories.filter(c => !this.form.parent_ids.includes(c.id) && c.id !== this.editId);
    
    if (this.form.query_type_id) {
        parents = parents.filter(c => c.query_type_id == this.form.query_type_id);
    }

    if (this.form.type === 'category') {
        return [];
    } else if (this.form.type === 'subcategory') {
        parents = parents.filter(c => c.type === 'category' || !c.type);
    } else if (this.form.type === 'child') {
        parents = parents.filter(c => c.type === 'subcategory');
    }

    if (this.categorySearch.trim()) {
      const term = this.categorySearch.toLowerCase();
      parents = parents.filter(c => c.name.toLowerCase().includes(term));
    }
    return parents;
  }

  hideDropdown() {
    setTimeout(() => this.showCatDropdown = false, 200);
  }

  addParentById(id: number) {
    if (!this.form.parent_ids.includes(id)) {
      this.form.parent_ids.push(id);
    }
    this.categorySearch = '';
  }

  addParent(event: any) {
    const val = event.target.value;
    if (val) {
      this.addParentById(Number(val));
      event.target.value = '';
    }
  }

  removeParent(id: any) {
    this.form.parent_ids = this.form.parent_ids.filter((p:any) => p !== id);
  }
}
