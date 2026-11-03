import { LucideAngularModule } from 'lucide-angular';
import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
    selector: 'app-user-management',
    imports: [CommonModule, FormsModule, LucideAngularModule],
    templateUrl: './user-management.component.html'
})
export class UserManagementComponent implements OnInit {
  users: any[] = [];
  showModal = false;
  editMode = false;
  saving = false;
  saveMsg = '';
  editId: any = null;

  form: any = { name: '', email: '', password: '', role: 'cse', is_active: true };

  private http = inject(HttpClient);
  private apiUrl = '/api';

  ngOnInit() { this.load(); }

  currentPage = 1;
  pageSize = 10;
  totalItems = 0;
  stats: any = { total: 0, active: 0, cse: 0, le: 0 };
  Math = Math;

  load() {
    let params: any = {
      page: this.currentPage,
      per_page: this.pageSize
    };
    this.http.get<any>(`${this.apiUrl}/users`, { params }).subscribe(res => {
      this.users = res.data;
      this.totalItems = res.total;
      this.stats = res.stats;
    });
  }

  openNew() {
    this.form = { name: '', email: '', password: '', role: 'cse', is_active: true };
    this.editId = null;
    this.editMode = false;
    this.saveMsg = '';
    this.showModal = true;
  }

  openEdit(u: any) {
    this.form = { name: u.name, email: u.email, password: '', role: u.role, is_active: u.is_active };
    this.editId = u.id;
    this.editMode = true;
    this.saveMsg = '';
    this.showModal = true;
  }

  save() {
    this.saving = true;
    const payload: any = { ...this.form };
    if (this.editMode && !payload.password) delete payload.password;

    const req = this.editMode
      ? this.http.put(`${this.apiUrl}/users/${this.editId}`, payload)
      : this.http.post(`${this.apiUrl}/users`, payload);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.saveMsg = this.editMode ? 'User updated successfully!' : 'User created successfully!';
        this.load();
        setTimeout(() => this.closeModal(), 1200);
      },
      error: (err) => {
        this.saving = false;
        const msg = err?.error?.message || 'Error saving user.';
        this.saveMsg = 'Error: ' + msg;
      }
    });
  }

  toggleActive(u: any) {
    this.http.put(`${this.apiUrl}/users/${u.id}`, { is_active: !u.is_active })
      .subscribe(() => this.load());
  }

  closeModal() { this.showModal = false; }

  get adminCount() { return this.stats.total - this.stats.cse - this.stats.le; }
  get cseCount() { return this.stats.cse; }
  get leCount() { return this.stats.le; }
  get activeCount() { return this.stats.active; }
  get totalUsersCount() { return this.stats.total; }
}
