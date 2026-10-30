import { LucideAngularModule } from 'lucide-angular';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-logistics-reason-management',
  standalone: true,
  imports: [CommonModule, FormsModule, LucideAngularModule],
  templateUrl: './logistics-reason-management.component.html',
})
export class LogisticsReasonManagementComponent implements OnInit {
  currentPage = 1;
  pageSize = 10;
  Math = Math;
  list: any[] = [];
  typeFilter = '';
  showModal = false;
  editMode = false;
  saving = false;
  saveMsg = '';
  editId: any = null;
  form: any = { reason: '', type: 'return', is_active: true };

  private http = inject(HttpClient);
  private apiUrl = '/api/logistics-reasons';

  ngOnInit() { this.load(); }

  load() { this.http.get<any[]>(this.apiUrl).subscribe(d => this.list = d); }

  get filtered() {
    return this.typeFilter ? this.list.filter(r => r.type === this.typeFilter) : this.list;
  }

  setFilter(v: string) { this.typeFilter = v; this.currentPage = 1; }

  openNew() {
    this.form = { reason: '', type: 'return', is_active: true };
    this.editId = null;
    this.editMode = false;
    this.saveMsg = '';
    this.showModal = true;
  }

  openEdit(r: any) {
    this.form = { reason: r.reason, type: r.type, is_active: !!r.is_active };
    this.editId = r.id;
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
        setTimeout(() => this.closeModal(), 800);
      },
      error: (e) => {
        this.saving = false;
        this.saveMsg = 'Error: ' + (e?.error?.errors?.reason?.[0] || e?.error?.message || 'could not save.');
      }
    });
  }

  delete(id: any) {
    if (!confirm('Delete this reason?')) return;
    this.http.delete(`${this.apiUrl}/${id}`).subscribe(() => this.load());
  }

  closeModal() { this.showModal = false; }
}
