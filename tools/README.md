# Auth API Generator

This directory contains the OpenAPI specification and generator script for creating TypeScript client code for the Auth API.

## Files

- `openapi.yaml` - OpenAPI 3.0 specification for the Auth API
- `generate.js` - Node.js script that generates TypeScript client code
- `config.json` - Configuration file for the OpenAPI generator
- `README.md` - This documentation file

## Usage

### Generate API Client

Run the following command from the project root:

```bash
npm run generate:auth-api
```

This will:

1. Validate the OpenAPI specification
2. Generate TypeScript client code using OpenAPI Generator
3. Create Angular services and models
4. Place the generated code in `src/libs/auth-api/`

### Modify the API Specification

1. Edit `openapi.yaml` to add/modify endpoints, models, etc.
2. Run the generator script to update the client code
3. Update your Angular components to use the new/modified API

### Generated Output

The script generates the following in `src/libs/auth-api/`:

```
src/libs/auth-api/
├── api/                    # API service classes
│   ├── authentication.service.ts
│   ├── user.service.ts
│   └── ...
├── model/                  # TypeScript interfaces
│   ├── login-request.ts
│   ├── login-response.ts
│   ├── user-profile.ts
│   └── ...
├── auth-api.module.ts      # Angular module
├── configuration.ts        # Configuration class
├── index.ts               # Main exports
└── README.md              # Usage documentation
```

## Integration with Angular

### 1. Import the Module

```typescript
// app.config.ts
import { provideApiAuth } from 'src/libs/auth-api/provide-api';


export const appConfig: ApplicationConfig = {
  providers: [
    ...
    provideApiAuth({
      credentials: {
        bearerAuth: () => {
          return localStorage.getItem("jwt") ?? undefined;
        },
      },
    }),
    ...
  ],
};
```

### 2. Use in Services

```typescript
// auth.service.ts
import { Injectable } from "@angular/core";
import { AuthenticationService, UserService } from "../libs/auth-api";

@Injectable()
export class AuthService {
  constructor(private authApi: AuthenticationService, private userApi: UserService) {}

  async login(email: string, password: string) {
    try {
      const response = await this.authApi.login({ email, password }).toPromise();
      // Handle successful login
      return response;
    } catch (error) {
      // Handle login error
      throw error;
    }
  }
}
```

## Configuration

### Environment-specific Configuration

You can configure different API endpoints for different environments:

```typescript
// environments/environment.ts
export const environment = {
  apiBaseUrl: "http://localhost:3000/v1",
};

// environments/environment.prod.ts
export const environment = {
  apiBaseUrl: "https://api.example.com/v1",
};
```

### Authentication

The generated client supports Bearer token authentication. Configure it like this:

```typescript
createAuthApiConfiguration({
  basePath: environment.apiBaseUrl,
  accessToken: () => {
    // Return the current access token
    return localStorage.getItem("access_token") || "";
  },
});
```

## Customization

### Adding New Endpoints

1. Add the endpoint to `openapi.yaml` under the `paths` section
2. Define any new models in the `components/schemas` section
3. Run `npm run generate:auth-api` to regenerate the client

### Modifying Models

1. Update the schema definitions in `openapi.yaml`
2. Regenerate the client code
3. Update your Angular code to use the new model structure

## Best Practices

1. **Version Control**: Commit both the OpenAPI spec and generated code
2. **Documentation**: Keep the OpenAPI spec well-documented with descriptions and examples
3. **Validation**: Use the built-in validation features of OpenAPI for request/response validation
4. **Type Safety**: Leverage TypeScript types generated from the OpenAPI spec
5. **Error Handling**: Use the generated error response models for proper error handling

## Troubleshooting

### Generation Errors

- Ensure the OpenAPI spec is valid YAML
- Check that all required dependencies are installed
- Verify file paths and permissions

### Runtime Errors

- Check API base URL configuration
- Verify authentication token is being provided
- Ensure CORS is properly configured on the API server

## Dependencies

- `@openapitools/openapi-generator-cli` - OpenAPI code generator
- Node.js (for running the generator script)
- Angular CLI (for the target application)

**Note** If your openapi.yml does not have the following fragments, add them to it:

```yml
openapi: 3.0.4
---
# 1) Define the security scheme type (HTTP bearer)
components:
  securitySchemes:
    bearerAuth: # arbitrary name for the security scheme
      type: http
      scheme: bearer
      bearerFormat: JWT # optional, arbitrary value for documentation purposes

# 2) Apply the security globally to all operations
security:
  - bearerAuth: [] # use the same name as above
```
