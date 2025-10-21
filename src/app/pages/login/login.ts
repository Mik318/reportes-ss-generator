import {Component, signal} from '@angular/core';
import {FormControl, FormGroup, ReactiveFormsModule, Validators} from '@angular/forms';
import {Auth} from '../../shared/services/auth';
import {Router, RouterLink} from '@angular/router';
import {AutenticacionService, AuthTokenResponse, LoginRequest} from '../../../libs/republica-cafe-management';

@Component({
  selector: 'app-login',
  imports: [
    ReactiveFormsModule,
    RouterLink
  ],
  templateUrl: './login.html',
  styleUrl: './login.scss'
})
export class Login {
  isLogin = true;
  showPassword = false;
  showConfirmPassword = false;
  isLoading = false;
  error = '';
  success = signal(false);
  setLoggedIn = signal(false);

  loginForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required])
  });

  signupForm = new FormGroup({
    email: new FormControl('', [Validators.required, Validators.email]),
    password: new FormControl('', [Validators.required, Validators.minLength(6)]),
    confirmPassword: new FormControl('', [Validators.required])
  });

  constructor(private auth: Auth,
              private router: Router,
              private autenticacionService: AutenticacionService) {
    this.setLoggedIn.set(this.auth.isLoggedInValue)
  }

  async handleLogin() {
    this.isLoading = true;
    this.error = '';
    const {email, password} = this.loginForm.value;
    const result = await this.signIn(email ?? '', password ?? '');
    if (result) {
      this.auth.setLoggedIn(true);
      this.router.navigate(['/home']);
    }
  }

  async handleSignup() {
    this.isLoading = true;
    this.error = '';
    const {email, password, confirmPassword} = this.signupForm.value;
    if (password !== confirmPassword) {
      this.error = 'Las contraseñas no coinciden';
      this.isLoading = false;
      return;
    }
    if ((password ?? '').length < 6) {
      this.error = 'La contraseña debe tener al menos 6 caracteres';
      this.isLoading = false;
      return;
    }
    const loginRequest: LoginRequest = {
      email: email ?? '',
      password: password ?? ''
    }
    this.autenticacionService.createAcountAuthCreateAccountPost(loginRequest).subscribe({
      next: () => {
        this.success.set(true);
        this.isLogin = false;
        this.isLoading = false;
      },
      error: (error) => {
        console.error(error);
        this.error = 'Error al crear la cuenta. Por favor, verifica tu información.';
        this.isLoading = false;
      }
    })
  }

  // Simula tu AuthContext
  async signIn(email: string, password: string): Promise<boolean> {
    return new Promise((resolve) => {
      const loginRequest: LoginRequest = {
        email: email,
        password: password
      }
      this.autenticacionService.getTokenAuthGetTokenPost(loginRequest).subscribe(
        {
          next: (response: AuthTokenResponse) => {
            try {
              if (typeof window !== 'undefined' && response?.access_token) {
                localStorage.setItem('jwt', response.access_token);
                this.isLoading = false;
              }
            } catch (e) {
              this.isLoading = false;
            }
            this.auth.setLoggedIn(true);
            resolve(true);
          },
          error: (error) => {
            console.error(error);
            resolve(false);
          }
        }
      );
    });
  }

  continueWithoutLogin() {
    try {
      this.auth.setLoggedIn(true);
      this.router.navigate(['/home']);
    } catch (e) {
      console.error('Error al intentar entrar sin login:', e);
    }
  }
}
