import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-type-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './type-management.component.html',
})
export class TypeManagementComponent implements OnInit {
  types: any[] = [];
  showModal = false;
  editMode = false;
  saving = false;
  saveMsg = '';
  editId: any = null;
  form: any = { name: '', is_active: true };

  private http = inject(HttpClient);
  private apiUrl = '/api';

  ngOnInit() { this.load(); }
  load() { this.http.get<any[]>(`${this.apiUrl}/query-types`).subscribe(d => this.types = d); }

  openNew() {
    this.form = { name: '', is_active: true };
    this.editId = null;
    this.editMode = false;
    this.saveMsg = '';
    this.showModal = true;
  }

  openEdit(t: any) {
    this.form = { name: t.name, is_active: t.is_active };
    this.editId = t.id;
    this.editMode = true;
    this.saveMsg = '';
    this.showModal = true;
  }

  save() {
    this.saving = true;
    const req = this.editMode
      ? this.http.put(`${this.apiUrl}/query-types/${this.editId}`, this.form)
      : this.http.post(`${this.apiUrl}/query-types`, this.form);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.saveMsg = this.editMode ? 'Type updated!' : 'Type created!';
        this.load();
        setTimeout(() => this.closeModal(), 1000);
      },
      error: () => { this.saving = false; this.saveMsg = 'Error saving type.'; }
    });
  }

  delete(id: any) {
    if (!confirm('Delete this type?')) return;
    this.http.delete(`${this.apiUrl}/query-types/${id}`).subscribe(() => this.load());
  }

  closeModal() { this.showModal = false; }
}
