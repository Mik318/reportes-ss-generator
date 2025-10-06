# Auth API Client

This is an auto-generated TypeScript client for the Auth API, created from the OpenAPI specification.

## Usage

### 1. Import the module in your Angular app

```typescript
import { AuthApiModule, createAuthApiConfiguration } from './libs/republica-cafe-management';

@NgModule({
  imports: [
    AuthApiModule.forRoot(() => 
      createAuthApiConfiguration({
        basePath: 'https://api.example.com/v1',
        accessToken: () => localStorage.getItem('access_token') || ''
      })
    )
  ]
})
export class AppModule { }
```

### 2. Use the services

```typescript
import { Injectable } from '@angular/core';
import { AuthenticationService, UserService } from './libs/republica-cafe-management';

@Injectable()
export class AuthService {
  constructor(
    private authApi: AuthenticationService,
    private userApi: UserService
  ) {}

  async login(email: string, password: string) {
    return this.authApi.login({ email, password }).toPromise();
  }

  async getUserProfile() {
    return this.userApi.getUserProfile().toPromise();
  }
}
```

## Generated Files

- `api/` - API service classes
- `model/` - TypeScript interfaces for API models
- `configuration.ts` - Configuration class
- `index.ts` - Main export file
- `republica-cafe-management.module.ts` - Angular module

## Regeneration

To regenerate this client, run:

```bash
npm run generate:republica-cafe-management
```

**Note: This directory is auto-generated. Do not edit files manually as they will be overwritten.**
