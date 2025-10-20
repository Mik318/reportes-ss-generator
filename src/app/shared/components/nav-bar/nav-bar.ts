import {Component} from '@angular/core';
import {Router, RouterLink} from '@angular/router';
import {Auth} from '../../services/auth';

@Component({
  selector: 'app-nav-bar',
  imports: [
    RouterLink
  ],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.scss'
})
export class NavBar {
  isLoggedIn!: () => boolean;

  constructor(private router: Router, private auth: Auth) {
    this.isLoggedIn = this.auth.isLoggedIn;
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login']);
  }

  getLinkClasses(path: string): string {
    const isActive = this.router.url === path;

    if (isActive) {
      return 'bg-blue-100 text-blue-700';
    } else {
      return 'text-gray-600 hover:text-gray-900 hover:bg-gray-100';
    }
  }
}
