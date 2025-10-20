import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import {NavBar} from './shared/components/nav-bar/nav-bar';
import {Auth} from './shared/services/auth';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, NavBar],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('reportes-ss-generator');
  isLoggedIn = signal(false);
  constructor(private auth: Auth) {
    this.isLoggedIn = this.auth.isLoggedIn;
  }


}
