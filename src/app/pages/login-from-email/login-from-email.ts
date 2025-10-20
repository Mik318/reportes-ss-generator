import {Component, OnInit} from '@angular/core';
import {Router} from '@angular/router';
import {Auth} from '../../shared/services/auth';

@Component({
  selector: 'app-login-from-email',
  imports: [],
  templateUrl: './login-from-email.html',
  styleUrl: './login-from-email.scss'
})
export class LoginFromEmail implements OnInit {

  constructor(
    private _routes: Router,
    private auth: Auth
  ) {
  }

  ngOnInit() {
    const fragment = window.location.hash.substring(1);
    const params = new URLSearchParams(fragment);
    const accessToken = params.get('access_token');

    if (accessToken) {
      try {
        localStorage.setItem('jwt', accessToken);
        try {
          this.auth.setLoggedIn(true);
        } catch (e) {
        }
      } catch (e) {
        console.error('No se pudo guardar el token en localStorage:', e);
      }
      try {
        history.replaceState(null, '', window.location.pathname + window.location.search);
      } catch (e) {
      }
      this._routes.navigate(['/home'], {replaceUrl: true});
    }
  }
}
