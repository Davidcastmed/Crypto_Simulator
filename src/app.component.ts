import { ChangeDetectionStrategy, Component, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { AuthComponent } from './components/auth/auth.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, AuthComponent, DashboardComponent]
})
export class AppComponent {
  isAuthenticated = signal(false);
  platformId = inject(PLATFORM_ID);

  constructor() {
    if (isPlatformBrowser(this.platformId)) {
      if (localStorage.getItem('is_authenticated') === 'true') {
        this.isAuthenticated.set(true);
      }
    }
  }

  handleLoginSuccess() {
    this.isAuthenticated.set(true);
  }

  handleLogout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('is_authenticated');
      // Also clear portfolio and order data on logout for a clean session
      localStorage.removeItem('crypto_portfolio');
      localStorage.removeItem('crypto_orders');
    }
    this.isAuthenticated.set(false);
  }
}