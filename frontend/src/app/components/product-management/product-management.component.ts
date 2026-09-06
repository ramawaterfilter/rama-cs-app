import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-product-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './product-management.component.html',
})
export class ProductManagementComponent implements OnInit {
  currentPage = 1;
  pageSize = 10;
  Math = Math;
  products: any[] = [];
  showModal = false;
  editMode = false;
  saving = false;
  saveMsg = '';
  editId: any = null;

  form: any = {
    name: '', sku: '', brand: '', model: '',
    description: '', category_ids: [], service_type: '', is_active: true
  };

  serviceTypes = ['Sales', 'Service', 'Parts', 'Installation', 'AMC', 'Other'];
  categories: any[] = [];
  categorySearchL1 = '';
  categorySearchL2 = '';
  categorySearchL3 = '';
  showCatDropdownL1 = false;
  showCatDropdownL2 = false;
  showCatDropdownL3 = false;

  private http = inject(HttpClient);
  private apiUrl = '/api';

  ngOnInit() { this.load(); }

  load() {
    this.http.get<any[]>(`${this.apiUrl}/products`).subscribe(d => this.products = d);
    this.http.get<any[]>(`${this.apiUrl}/categories`).subscribe(d => this.categories = d);
  }

  openNew() {
    this.form = { name: '', sku: '', brand: '', model: '', description: '', category_ids: [], service_type: '', is_active: true };
    this.editId = null;
    this.editMode = false;
    this.saveMsg = '';
    this.showModal = true;
  }

  openEdit(p: any) {
    this.form = { name: p.name, sku: p.sku || '', brand: p.brand || '', model: p.model || '', description: p.description || '', category_ids: p.categories ? p.categories.map((c:any)=>c.id) : [], service_type: p.service_type || '', is_active: p.is_active };
    this.editId = p.id;
    this.editMode = true;
    this.saveMsg = '';
    this.showModal = true;
  }

  save() {
    this.saving = true;
    const req = this.editMode
      ? this.http.put(`${this.apiUrl}/products/${this.editId}`, this.form)
      : this.http.post(`${this.apiUrl}/products`, this.form);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.saveMsg = this.editMode ? 'Product updated!' : 'Product created!';
        this.load();
        setTimeout(() => this.closeModal(), 1000);
      },
      error: () => { this.saving = false; this.saveMsg = 'Error saving product.'; }
    });
  }

  toggleActive(p: any) {
    this.http.put(`${this.apiUrl}/products/${p.id}`, { is_active: !p.is_active }).subscribe(() => this.load());
  }

  delete(id: any) {
    if (!confirm('Delete this product?')) return;
    this.http.delete(`${this.apiUrl}/products/${id}`).subscribe(() => this.load());
  }

  closeModal() { this.showModal = false; }

  getCategoryName(id: any) {
    const c = this.categories.find(c => c.id == id);
    return c ? c.name : '';
  }

  getSelectedByLevel(level: number) {
    return this.form.category_ids.filter((id:any) => {
      const cat = this.categories.find(c => c.id == id);
      if (!cat) return false;
      if (level === 1) return !cat.parents || cat.parents.length === 0;
      if (level === 2) {
        // Level 2 categories are those whose parents are Level 1
        return cat.parents && cat.parents.some((p:any) => {
          const parent = this.categories.find(c => c.id == p.id);
          return !parent?.parents || parent.parents.length === 0;
        });
      }
      if (level === 3) {
        // Level 3 categories are those whose parents are Level 2
        return cat.parents && cat.parents.some((p:any) => {
          const parent = this.categories.find(c => c.id == p.id);
          return parent?.parents && parent.parents.some((gp:any) => {
            const gParent = this.categories.find(c => c.id == gp.id);
            return !gParent?.parents || gParent.parents.length === 0;
          });
        });
      }
      return false;
    });
  }

  getAvailableL1() {
    let list = this.categories.filter(c => (!c.parents || c.parents.length === 0) && !this.form.category_ids.includes(c.id));
    if (this.categorySearchL1.trim()) {
      const term = this.categorySearchL1.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(term));
    }
    return list;
  }

  getAvailableL2() {
    const selectedL1 = this.getSelectedByLevel(1);
    if (selectedL1.length === 0) return [];
    let list = this.categories.filter(c => {
      return c.parents && c.parents.some((p:any) => selectedL1.includes(p.id)) && !this.form.category_ids.includes(c.id);
    });
    if (this.categorySearchL2.trim()) {
      const term = this.categorySearchL2.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(term));
    }
    return list;
  }

  getAvailableL3() {
    const selectedL2 = this.getSelectedByLevel(2);
    if (selectedL2.length === 0) return [];
    let list = this.categories.filter(c => {
      return c.parents && c.parents.some((p:any) => selectedL2.includes(p.id)) && !this.form.category_ids.includes(c.id);
    });
    if (this.categorySearchL3.trim()) {
      const term = this.categorySearchL3.toLowerCase();
      list = list.filter(c => c.name.toLowerCase().includes(term));
    }
    return list;
  }

  hideDropdown(level: number) {
    setTimeout(() => {
      if (level === 1) this.showCatDropdownL1 = false;
      if (level === 2) this.showCatDropdownL2 = false;
      if (level === 3) this.showCatDropdownL3 = false;
    }, 200);
  }

  addCategoryById(id: number, level: number) {
    if (!this.form.category_ids.includes(id)) {
      this.form.category_ids.push(id);
    }
    if (level === 1) this.categorySearchL1 = '';
    if (level === 2) this.categorySearchL2 = '';
    if (level === 3) this.categorySearchL3 = '';
  }

  removeCategory(id: any) {
    // When removing a parent, we should also remove its children from the selection
    const toRemove = [id];
    const findChildren = (parentId: any) => {
      this.categories.forEach(c => {
        if (c.parents && c.parents.some((p:any) => p.id == parentId)) {
          if (!toRemove.includes(c.id)) {
            toRemove.push(c.id);
            findChildren(c.id);
          }
        }
      });
    };
    findChildren(id);
    
    this.form.category_ids = this.form.category_ids.filter((c:any) => !toRemove.includes(c));
  }
}
