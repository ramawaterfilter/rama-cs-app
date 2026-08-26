import { Component, inject, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

import { RouterLink } from '@angular/router';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './login.component.html',
})
export class LoginComponent implements OnInit, OnDestroy {
  credentials = { email: '', password: '' };
  error = '';
  loading = false;
  showPassword = false;
  
  showForgotPassword = false;
  forgotPasswordEmail = '';
  forgotPasswordMessage = '';
  forgotPasswordError = '';
  forgotPasswordLoading = false;
  
  private authService = inject(AuthService);
  private router = inject(Router);
  public themeService = inject(ThemeService);

  cooldownTime = 0;
  private cooldownInterval: any;

  ngOnInit() {
    this.checkCooldown();
  }

  ngOnDestroy() {
    if (this.cooldownInterval) {
      clearInterval(this.cooldownInterval);
    }
  }

  checkCooldown() {
    const lastRequest = localStorage.getItem('lastPasswordResetRequest');
    if (lastRequest) {
      const timePassed = Math.floor((Date.now() - parseInt(lastRequest)) / 1000);
      const cooldownLimit = 60; // 60 seconds cooldown
      if (timePassed < cooldownLimit) {
        this.startCooldownTimer(cooldownLimit - timePassed);
      }
    }
  }

  startCooldownTimer(seconds: number) {
    this.cooldownTime = seconds;
    if (this.cooldownInterval) clearInterval(this.cooldownInterval);
    
    this.cooldownInterval = setInterval(() => {
      this.cooldownTime--;
      if (this.cooldownTime <= 0) {
        clearInterval(this.cooldownInterval);
        this.cooldownTime = 0;
      }
    }, 1000);
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleForgotPassword() {
    this.showForgotPassword = !this.showForgotPassword;
    this.error = '';
    this.forgotPasswordMessage = '';
    this.forgotPasswordError = '';
    this.forgotPasswordEmail = this.credentials.email; // Pre-fill if typed
  }

  onForgotPasswordSubmit() {
    if (!this.forgotPasswordEmail) {
      this.forgotPasswordError = 'Email is required.';
      return;
    }
    
    if (this.cooldownTime > 0) {
      this.forgotPasswordError = `Please wait ${this.cooldownTime} seconds before requesting again.`;
      return;
    }
    
    this.forgotPasswordLoading = true;
    this.forgotPasswordError = '';
    this.forgotPasswordMessage = '';
    
    this.authService.requestPasswordReset(this.forgotPasswordEmail).subscribe({
      next: (res) => {
        this.forgotPasswordLoading = false;
        this.forgotPasswordMessage = 'Password reset request submitted successfully to admins.';
        localStorage.setItem('lastPasswordResetRequest', Date.now().toString());
        this.startCooldownTimer(60);
      },
      error: (err) => {
        this.forgotPasswordLoading = false;
        this.forgotPasswordError = err.error?.message || 'Error submitting request. Please try again.';
      }
    });
  }

  onSubmit() {
    this.loading = true;
    this.error = '';
    this.authService.login(this.credentials).subscribe({
      next: (res) => {
        console.log('Login successful. User:', res.user);
        if (res.user.role === 'admin') {
          this.router.navigate(['/dashboard/overview']);
        } else {
          this.router.navigate(['/dashboard/tickets']);
        }
      },
      error: (err) => {
        this.loading = false;
        this.error = 'Invalid credentials or inactive account.';
      }
    });
  }
}
