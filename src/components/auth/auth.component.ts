import { ChangeDetectionStrategy, Component, output, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

@Component({
  selector: 'app-auth',
  templateUrl: './auth.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
})
export class AuthComponent {
  loginSuccess = output<void>();
  platformId = inject(PLATFORM_ID);

  onConnect() {
    // In a real app, this would involve a wallet connection library.
    // Here, we just emit an event to simulate a successful login.
    if (isPlatformBrowser(this.platformId)) {
        localStorage.setItem('is_authenticated', 'true');
    }
    this.loginSuccess.emit();
  }
}