import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-channel-management',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './channel-management.component.html',
})
export class ChannelManagementComponent implements OnInit {
  currentPage = 1;
  pageSize = 10;
  Math = Math;
  channels: any[] = [];
  showModal = false;
  editMode = false;
  saving = false;
  saveMsg = '';
  editId: any = null;
  form: any = { name: '', is_active: true };

  private http = inject(HttpClient);
  private apiUrl = '/api';

  ngOnInit() { this.load(); }
  load() { this.http.get<any[]>(`${this.apiUrl}/query-channels`).subscribe(d => this.channels = d); }

  openNew() {
    this.form = { name: '', is_active: true };
    this.editId = null;
    this.editMode = false;
    this.saveMsg = '';
    this.showModal = true;
  }

  openEdit(c: any) {
    this.form = { name: c.name, is_active: c.is_active };
    this.editId = c.id;
    this.editMode = true;
    this.saveMsg = '';
    this.showModal = true;
  }

  save() {
    this.saving = true;
    const req = this.editMode
      ? this.http.put(`${this.apiUrl}/query-channels/${this.editId}`, this.form)
      : this.http.post(`${this.apiUrl}/query-channels`, this.form);

    req.subscribe({
      next: () => {
        this.saving = false;
        this.saveMsg = this.editMode ? 'Channel updated!' : 'Channel created!';
        this.load();
        setTimeout(() => this.closeModal(), 1000);
      },
      error: () => { this.saving = false; this.saveMsg = 'Error saving channel.'; }
    });
  }

  delete(id: any) {
    if (!confirm('Delete this channel?')) return;
    this.http.delete(`${this.apiUrl}/query-channels/${id}`).subscribe(() => this.load());
  }

  closeModal() { this.showModal = false; }
}
