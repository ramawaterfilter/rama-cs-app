import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-profile-settings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './profile-settings.component.html',
})
export class ProfileSettingsComponent implements OnInit {
  user: any = {};
  profileForm: any = { name: '', email: '' };
  passwordForm: any = { password: '', password_confirm: '' };
  profileMsg = '';
  passwordMsg = '';
  profileSaving = false;
  passwordSaving = false;

  private http = inject(HttpClient);
  private authService = inject(AuthService);
  private apiUrl = '/api';

  ngOnInit() {
    this.user = this.authService.getUserData();
    this.profileForm.name = this.user?.name || '';
    this.profileForm.email = this.user?.email || '';
  }

  saveProfile() {
    this.profileSaving = true;
    this.profileMsg = '';
    this.http.put(`${this.apiUrl}/user/profile`, { name: this.profileForm.name }).subscribe({
      next: (res: any) => {
        this.profileSaving = false;
        this.profileMsg = 'success:Profile updated successfully!';
        const stored = this.authService.getUserData();
        stored.name = res.user.name;
        localStorage.setItem('user_data', JSON.stringify(stored));
        this.user = stored;
      },
      error: () => { this.profileSaving = false; this.profileMsg = 'error:Failed to update profile.'; }
    });
  }

  savePassword() {
    if (this.passwordForm.password !== this.passwordForm.password_confirm) {
      this.passwordMsg = 'error:Passwords do not match.';
      return;
    }
    if (this.passwordForm.password.length < 6) {
      this.passwordMsg = 'error:Password must be at least 6 characters.';
      return;
    }
    this.passwordSaving = true;
    this.passwordMsg = '';
    this.http.put(`${this.apiUrl}/user/profile`, { password: this.passwordForm.password }).subscribe({
      next: () => {
        this.passwordSaving = false;
        this.passwordMsg = 'success:Password changed successfully!';
        this.passwordForm = { password: '', password_confirm: '' };
      },
      error: () => { this.passwordSaving = false; this.passwordMsg = 'error:Failed to update password.'; }
    });
  }

  isSuccess(msg: string) { return msg.startsWith('success:'); }
  msgText(msg: string) { return msg.replace(/^(success|error):/, ''); }
}
