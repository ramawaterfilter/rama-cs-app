import { Routes } from '@angular/router';
import { PublicFormComponent } from './components/public-form/public-form.component';
import { LoginComponent } from './components/login/login.component';
import { DashboardLayoutComponent } from './components/dashboard-layout/dashboard-layout.component';
import { AdminDashboardComponent } from './components/admin-dashboard/admin-dashboard.component';
import { CseDashboardComponent } from './components/cse-dashboard/cse-dashboard.component';
import { UserManagementComponent } from './components/user-management/user-management.component';
import { ProfileSettingsComponent } from './components/profile-settings/profile-settings.component';
import { TicketGridComponent } from './components/ticket-grid/ticket-grid.component';
import { CategoryManagementComponent } from './components/category-management/category-management.component';
import { StatusManagementComponent } from './components/status-management/status-management.component';
import { ProductManagementComponent } from './components/product-management/product-management.component';
import { ChannelManagementComponent } from './components/channel-management/channel-management.component';
import { TypeManagementComponent } from './components/type-management/type-management.component';
import { FilterManagementComponent } from './components/filter-management/filter-management.component';
import { OutreachManagementComponent } from './components/outreach-management/outreach-management.component';
import { PurchaseStoreManagementComponent } from './components/purchase-store-management/purchase-store-management.component';
import { CountryManagementComponent } from './components/country-management/country-management.component';
import { AuthGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'admin', redirectTo: 'dashboard/overview', pathMatch: 'full' },
  { path: 'cse', redirectTo: 'dashboard/tickets', pathMatch: 'full' },
  { 
    path: 'dashboard', 
    component: DashboardLayoutComponent,
    canActivate: [AuthGuard],
    children: [
      { path: 'overview', component: AdminDashboardComponent },
      { path: 'new-query', component: PublicFormComponent },
      { path: 'cse', component: CseDashboardComponent },
      { path: 'tickets', component: TicketGridComponent },
      { path: 'ticket-requests', component: TicketGridComponent },
      { path: 'categories', component: CategoryManagementComponent },
      { path: 'statuses', component: StatusManagementComponent },
      { path: 'products', component: ProductManagementComponent },
      { path: 'channels', component: ChannelManagementComponent },
      { path: 'types', component: TypeManagementComponent },
      { path: 'filters', component: FilterManagementComponent },
      { path: 'outreach', component: OutreachManagementComponent },
      { path: 'purchase-stores', component: PurchaseStoreManagementComponent },
      { path: 'countries', component: CountryManagementComponent },
      { path: 'users', component: UserManagementComponent },
      { path: 'user-requests', loadComponent: () => import('./components/user-profile-requests/user-profile-requests.component').then(m => m.UserProfileRequestsComponent) },
      { path: 'profile', component: ProfileSettingsComponent },
      { path: 'logistics', loadComponent: () => import('./components/logistics-dashboard/logistics-dashboard.component').then(m => m.LogisticsDashboardComponent) },
      { path: 'rejected-approvals', loadComponent: () => import('./components/rejected-approvals/rejected-approvals.component').then(m => m.RejectedApprovalsComponent) },
      { path: '', redirectTo: 'overview', pathMatch: 'full' }
    ]
  },
  { path: '**', redirectTo: '' }
];
