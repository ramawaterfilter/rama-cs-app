import { Component, inject, OnInit, OnDestroy, HostListener, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterLink, RouterLinkActive, Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { NotificationService } from '../../services/notification.service';
import { ThemeService } from '../../services/theme.service';

@Component({
  selector: 'app-dashboard-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterLink, RouterLinkActive],
  templateUrl: './dashboard-layout.component.html',
  styleUrls: ['./dashboard-layout.component.scss']
})
export class DashboardLayoutComponent implements OnInit, OnDestroy {
  public authService = inject(AuthService);
  public notifService = inject(NotificationService);
  public themeService = inject(ThemeService);
  private router = inject(Router);
  private http = inject(HttpClient);
  private apiUrl = '/api';
  user: any = null;
  isAdmin = false;
  initials = '';
  pageTitle = 'Dashboard';
  sidebarCollapsed = false;
  mobileSidebarOpen = false;
  showNotifDropdown = false;

  @ViewChild('notifContainer') notifContainer!: ElementRef;

  navItems: any[] = [];
  notifications: any[] = [];
  toasts: any[] = [];
  private toasterSub: any;

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    if (this.showNotifDropdown && this.notifContainer && !this.notifContainer.nativeElement.contains(event.target)) {
      this.showNotifDropdown = false;
    }
  }

  ngOnInit() {
    this.user = this.authService.getUserData();
    this.isAdmin = this.user?.role === 'admin';
    this.initials = this.user?.name?.split(' ').map((n: string) => n[0]).join('').toUpperCase() || 'U';

    if (this.isAdmin) {
      this.navItems = [
        { section: 'OVERVIEW' },
        { label: 'Dashboard', icon: '🏠', route: '/dashboard/overview' },
        { section: 'TICKET MANAGEMENT' },
        { label: 'New Query', icon: '📝', route: '/dashboard/new-query' },
        { label: 'All Tickets', icon: '🎫', route: '/dashboard/tickets' },
        { label: 'Ticket Requests', icon: '🔔', route: '/dashboard/ticket-requests' },
        { label: 'Logistics Dashboard', icon: '🚚', route: '/dashboard/logistics' },
        { section: 'MASTER DATA' },
        { label: 'Categories', icon: '🗂️', route: '/dashboard/categories' },
        { label: 'Products', icon: '📦', route: '/dashboard/products' },
        { label: 'Query Channels', icon: '📶', route: '/dashboard/channels' },
        { label: 'Query Types', icon: '📋', route: '/dashboard/types' },
        { label: 'Query Filters', icon: '📏', route: '/dashboard/filters' },
        { label: 'Customer Outreach', icon: '🤝', route: '/dashboard/outreach' },
        { label: 'Purchase Stores', icon: '🏪', route: '/dashboard/purchase-stores' },
        { label: 'Countries', icon: '🌍', route: '/dashboard/countries' },
        { label: 'Query Statuses', icon: '🔖', route: '/dashboard/statuses' },
        { section: 'ADMINISTRATION' },
        { label: 'User Management', icon: '👥', route: '/dashboard/users' },
        { label: 'User Profile Requests', icon: '🔑', route: '/dashboard/user-requests' },
        { label: 'Profile & Security', icon: '⚙️', route: '/dashboard/profile' },
      ];
    } else if (this.user?.role === 'le') {
      this.navItems = [
        { section: 'LOGISTICS TEAM' },
        { label: 'Logistics Dashboard', icon: '🚚', route: '/dashboard/logistics' },
        { section: 'ACCOUNT' },
        { label: 'Profile & Security', icon: '⚙️', route: '/dashboard/profile' },
      ];
      const currentPath = this.router.url;
      if (currentPath === '/dashboard' || currentPath === '/dashboard/overview' || currentPath === '/dashboard/') {
        this.router.navigate(['/dashboard/logistics']);
      }
    } else {
      this.navItems = [
        { section: 'MY WORKSPACE' },
        { label: 'My Dashboard', icon: '🏠', route: '/dashboard/cse' },
        { label: 'New Query', icon: '📝', route: '/dashboard/new-query' },
        { label: 'All Tickets', icon: '🎫', route: '/dashboard/tickets' },
        { label: 'Logistics', icon: '🚚', route: '/dashboard/logistics' },
        { label: 'Rejected Approvals', icon: '❌', route: '/dashboard/rejected-approvals' },
        { section: 'ACCOUNT' },
        { label: 'Profile & Security', icon: '⚙️', route: '/dashboard/profile' },
      ];
      // Redirect CSE users away from admin-only overview
      const currentPath = this.router.url;
      if (currentPath === '/dashboard' || currentPath === '/dashboard/overview' || currentPath === '/dashboard/') {
        this.router.navigate(['/dashboard/cse']);
      }
    }
    
    this.loadNotifications();
  }

  loadNotifications() {
    this.toasterSub = this.notifService.toaster$.subscribe(toast => {
      this.toasts.push(toast);
      setTimeout(() => {
        this.toasts.shift();
      }, 5000); // Remove after 5 seconds
    });
  }

  ngOnDestroy() {
    if (this.toasterSub) {
      this.toasterSub.unsubscribe();
    }
  }

  toggleNotifDropdown() {
    this.showNotifDropdown = !this.showNotifDropdown;
  }

  toggleSidebar() {
    if (window.innerWidth <= 768) {
      this.mobileSidebarOpen = !this.mobileSidebarOpen;
    } else {
      this.sidebarCollapsed = !this.sidebarCollapsed;
    }
  }

  closeMobileSidebar() {
    this.mobileSidebarOpen = false;
  }

  logout() {
    this.authService.logout();
  }
}
