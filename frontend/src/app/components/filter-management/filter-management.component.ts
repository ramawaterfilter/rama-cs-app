import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-filter-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './filter-management.component.html',
})
export class FilterManagementComponent implements OnInit {
  currentPage = 1;
  pageSize = 10;
  Math = Math;
  filters: any[] = [];
  showModal = false;
  editMode = false;
  saving = false;
  saveMsg = '';
  editId: any = null;
  form: any = { name: '', is_active: true };

  private http = inject(HttpClient);
  private apiUrl = '/api';

  ngOnInit() { this.load(); }
  load() { this.http.get<any[]>(`${this.apiUrl}/query-filters`).subscribe(d => this.filters = d); }

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
      ? this.http.put(`${this.apiUrl}/query-filters/${this.editId}`, this.form)
      : this.http.post(`${this.apiUrl}/query-filters`, this.form);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.saveMsg = this.editMode ? 'Filter updated!' : 'Filter created!';
        this.load();
        setTimeout(() => this.closeModal(), 1000);
      },
      error: () => { this.saving = false; this.saveMsg = 'Error saving filter.'; }
    });
  }

  delete(id: any) {
    if (!confirm('Delete this filter?')) return;
    this.http.delete(`${this.apiUrl}/query-filters/${id}`).subscribe(() => this.load());
  }

  closeModal() { this.showModal = false; }
}
