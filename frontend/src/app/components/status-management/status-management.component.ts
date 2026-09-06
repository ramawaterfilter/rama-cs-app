import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-status-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './status-management.component.html',
})
export class StatusManagementComponent implements OnInit {
  statuses: any[] = [];
  showModal = false;
  editMode = false;
  saving = false;
  saveMsg = '';
  editId: any = null;
  form: any = { name: '', color: '#545cd8', is_default: false, type: 'general' };
  currentPage = 1;
  pageSize = 10;
  Math = Math;

  private http = inject(HttpClient);
  private apiUrl = '/api';

  ngOnInit() { this.load(); }
  load() { this.http.get<any[]>(`${this.apiUrl}/statuses`).subscribe(d => this.statuses = d); }

  openNew() {
    this.form = { name: '', color: '#545cd8', is_default: false, type: 'general' };
    this.editId = null;
    this.editMode = false;
    this.saveMsg = '';
    this.showModal = true;
  }

  openEdit(s: any) {
    this.form = { name: s.name, color: s.color || '#545cd8', is_default: s.is_default, type: s.type || 'general' };
    this.editId = s.id;
    this.editMode = true;
    this.saveMsg = '';
    this.showModal = true;
  }

  save() {
    this.saving = true;
    const req = this.editMode
      ? this.http.put(`${this.apiUrl}/statuses/${this.editId}`, this.form)
      : this.http.post(`${this.apiUrl}/statuses`, this.form);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.saveMsg = this.editMode ? 'Status updated!' : 'Status created!';
        this.load();
        setTimeout(() => this.closeModal(), 1000);
      },
      error: () => { this.saving = false; this.saveMsg = 'Error saving status.'; }
    });
  }

  delete(id: any) {
    if (!confirm('Delete this status?')) return;
    this.http.delete(`${this.apiUrl}/statuses/${id}`).subscribe(() => this.load());
  }

  closeModal() { this.showModal = false; }
}
