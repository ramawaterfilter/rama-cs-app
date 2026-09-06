import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-category-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './category-management.component.html',
})
export class CategoryManagementComponent implements OnInit {
  currentPage = 1;
  pageSize = 10;
  Math = Math;
  categories: any[] = [];
  queryTypes: any[] = [];
  showModal = false;
  editMode = false;
  saving = false;
  saveMsg = '';

  form: any = { name: '', type: 'category', query_type_id: null, parent_ids: [] };
  editId: any = null;
  categorySearch = '';
  showCatDropdown = false;

  private http = inject(HttpClient);
  private apiUrl = '/api';

  ngOnInit() { this.load(); }

  load() {
    this.http.get<any[]>(`${this.apiUrl}/categories`).subscribe(d => this.categories = d);
    this.http.get<any[]>(`${this.apiUrl}/query-types`).subscribe(d => this.queryTypes = d);
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

  get topLevel() { 
    return this.categories.filter(c => !c.parents || c.parents.length === 0); 
  }

  get filteredTopLevel() {
    let list = this.topLevel;
    
    if (this.filterQueryType) {
      list = list.filter(c => c.query_type_id == this.filterQueryType);
    }

    if (this.searchCategoryTerm) {
      const term = this.searchCategoryTerm.toLowerCase();
      list = list.filter(c => {
         if (c.name.toLowerCase().includes(term)) return true;
         const children = this.getChildren(c.id);
         if (children.some(sub => sub.name.toLowerCase().includes(term))) return true;
         const grand = children.flatMap(sub => this.getGrandChildren(sub.id));
         if (grand.some(g => g.name.toLowerCase().includes(term))) return true;
         return false;
      });
    }
    return list;
  }
  getChildren(id: any) { return this.categories.filter(c => c.parents && c.parents.some((p:any) => p.id === id)); }
  getGrandChildren(id: any) { return this.getChildren(id); } // Just reuse getChildren

  getCategoryName(id: any) {
    const c = this.categories.find(c => c.id == id);
    return c ? c.name : '';
  }

  getQueryTypeName(qtId: any) {
    const qt = this.queryTypes.find(q => q.id == qtId);
    return qt ? qt.name : '';
  }

  availableParents() {
    let parents = this.categories.filter(c => !this.form.parent_ids.includes(c.id) && c.id !== this.editId);
    
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
