import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-user-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user-management.component.html',
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

  load() {
    this.http.get<any[]>(`${this.apiUrl}/users`).subscribe(d => this.users = d);
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

  get adminCount() { return this.users.filter(u => u.role === 'admin').length; }
  get cseCount() { return this.users.filter(u => u.role === 'cse').length; }
  get leCount() { return this.users.filter(u => u.role === 'le').length; }
  get activeCount() { return this.users.filter(u => u.is_active).length; }
}
