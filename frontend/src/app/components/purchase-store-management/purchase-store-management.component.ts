import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-purchase-store-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './purchase-store-management.component.html',
})
export class PurchaseStoreManagementComponent implements OnInit {
  currentPage = 1;
  pageSize = 10;
  Math = Math;
  list: any[] = [];
  showModal = false;
  editMode = false;
  saving = false;
  saveMsg = '';
  editId: any = null;
  form: any = { name: '', is_active: true };

  private http = inject(HttpClient);
  private apiUrl = '/api/purchase-stores';

  ngOnInit() { this.load(); }
  load() { this.http.get<any[]>(this.apiUrl).subscribe(d => this.list = d); }

  openNew() {
    this.form = { name: '', is_active: true };
    this.editId = null;
    this.editMode = false;
    this.saveMsg = '';
    this.showModal = true;
  }

  openEdit(f: any) {
    this.form = { name: f.name, is_active: f.is_active };
    this.editId = f.id;
    this.editMode = true;
    this.saveMsg = '';
    this.showModal = true;
  }

  save() {
    this.saving = true;
    const req = this.editMode
      ? this.http.put(`${this.apiUrl}/${this.editId}`, this.form)
      : this.http.post(this.apiUrl, this.form);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.saveMsg = this.editMode ? 'Updated!' : 'Created!';
        this.load();
        setTimeout(() => this.closeModal(), 1000);
      },
      error: () => { this.saving = false; this.saveMsg = 'Error saving.'; }
    });
  }

  delete(id: any) {
    if (!confirm('Delete this item?')) return;
    this.http.delete(`${this.apiUrl}/${id}`).subscribe(() => this.load());
  }

  closeModal() { this.showModal = false; }
}
