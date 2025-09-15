import {Component} from '@angular/core';
import {Router, RouterLink} from '@angular/router';

@Component({
  selector: 'app-nav-bar',
  imports: [
    RouterLink
  ],
  templateUrl: './nav-bar.html',
  styleUrl: './nav-bar.scss'
})
export class NavBar {
  constructor(private router: Router) {
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
