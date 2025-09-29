#!/usr/bin/env node

const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

// Configuration
const CONFIG = {
    openApiSpec: path.join(__dirname, "openapi.yaml"),
    outputDir: path.join(__dirname, "../../src/libs/republica-cafe-management"),
    tempDir: path.join(__dirname, "temp"),
    packageName: "republica-cafe-management",
    packageVersion: "1.0.0",
};

/**
 * Log with timestamp
 */
function log(message) {
    console.log(`[${new Date().toISOString()}] ${message}`);
}

/**
 * Execute command and log output
 */
function execCommand(command, options = {}) {
    log(`Executing: ${command}`);
    try {
        execSync(command, {
            stdio: "inherit",
            cwd: options.cwd || __dirname,
            ...options,
        });
    } catch (error) {
        console.error(`Error executing command: ${command}`);
        console.error(error.message);
        process.exit(1);
    }
}

/**
 * Clean up directories
 */
function cleanup() {
    log("Cleaning up previous builds...");

    if (fs.existsSync(CONFIG.outputDir)) {
        execCommand(`rm -rf "${CONFIG.outputDir}"`);
    }

    if (fs.existsSync(CONFIG.tempDir)) {
        execCommand(`rm -rf "${CONFIG.tempDir}"`);
    }
}

/**
 * Validate OpenAPI spec
 */
function validateSpec() {
    log("Validating OpenAPI specification...");

    if (!fs.existsSync(CONFIG.openApiSpec)) {
        console.error(`OpenAPI spec not found at: ${CONFIG.openApiSpec}`);
        process.exit(1);
    }

    log("✓ OpenAPI specification found");
}

/**
 * Generate TypeScript client
 */
function generateClient() {
    log("Generating TypeScript client...");

    const command = [
        "npx openapi-generator-cli generate",
        `-i "${CONFIG.openApiSpec}"`,
        `-g typescript-angular`,
        `-o "${CONFIG.tempDir}"`,
        `--package-name=${CONFIG.packageName}`,
        `--additional-properties=npmName=${CONFIG.packageName}`,
        `--additional-properties=npmVersion=${CONFIG.packageVersion}`,
        "--additional-properties=supportsES6=true",
        "--additional-properties=withInterfaces=true",
        "--additional-properties=taggedUnions=true",
        "--additional-properties=stringEnums=true",
        "--additional-properties=enumPropertyNaming=original",
    ].join(" ");

    execCommand(command);
    log("✓ TypeScript client generated");
}

/**
 * Post-process generated files
 */
function postProcess() {
    log("Post-processing generated files...");

    // Create output directory
    fs.mkdirSync(CONFIG.outputDir, { recursive: true });

    const sourceDir = CONFIG.tempDir;
    const targetDir = CONFIG.outputDir;

    // Copy all TypeScript files
    execCommand(`cp -r "${sourceDir}"/*.ts "${targetDir}/"`);

    // Copy model files
    if (fs.existsSync(path.join(sourceDir, "model"))) {
        const modelTarget = path.join(targetDir, "model");
        fs.mkdirSync(modelTarget, { recursive: true });
        execCommand(`cp -r "${sourceDir}/model/." "${modelTarget}/"`);
    }

    // Copy API files
    if (fs.existsSync(path.join(sourceDir, "api"))) {
        const apiTarget = path.join(targetDir, "api");
        fs.mkdirSync(apiTarget, { recursive: true });
        execCommand(`cp -r "${sourceDir}/api/." "${apiTarget}/"`);
    }

    log("✓ Files copied to final destination");
}

/**
 * Create index file for easier imports
 */
function createIndexFile() {
    log("Creating index file...");

    const indexContent = `// Generated API client exports
// This file is auto-generated. Do not edit manually.

// Export all models
export * from './model/models';

// Export all APIs
export * from './api/api';

// Export configuration
export * from './configuration';

// Export variables
export * from './variables';

// Re-export commonly used types
export { Configuration } from './configuration';
export { Observable } from 'rxjs';
`;

    fs.writeFileSync(path.join(CONFIG.outputDir, "index.ts"), indexContent);
    log("✓ Index file created");
}

/**
 * Create Angular module file
 */
function createAngularModule() {
    log("Creating Angular module...");

    const moduleContent = `import { NgModule, ModuleWithProviders } from '@angular/core';
import { HttpClientModule } from '@angular/common/http';
import { Configuration, ConfigurationParameters } from './configuration';
import { ApiModule } from './api.module';

@NgModule({
  imports: [
    HttpClientModule,
    ApiModule
  ],
  exports: [
    ApiModule
  ]
})
export class AuthApiModule {
  public static forRoot(configurationFactory: () => Configuration): ModuleWithProviders<AuthApiModule> {
    return {
      ngModule: AuthApiModule,
      providers: [
        {
          provide: Configuration,
          useFactory: configurationFactory
        }
      ]
    };
  }
}

// Convenience factory for common configuration
export function createAuthApiConfiguration(params: ConfigurationParameters): Configuration {
  return new Configuration(params);
}
`;

    fs.writeFileSync(
        path.join(CONFIG.outputDir, "republica-cafe-management.module.ts"),
        moduleContent
    );
    log("✓ Angular module created");
}

/**
 * Create README file
 */
function createReadme() {
    log("Creating README...");

    const readmeContent = `# Auth API Client

This is an auto-generated TypeScript client for the Auth API, created from the OpenAPI specification.

## Usage

### 1. Import the module in your Angular app

\`\`\`typescript
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
\`\`\`

### 2. Use the services

\`\`\`typescript
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
\`\`\`

## Generated Files

- \`api/\` - API service classes
- \`model/\` - TypeScript interfaces for API models
- \`configuration.ts\` - Configuration class
- \`index.ts\` - Main export file
- \`republica-cafe-management.module.ts\` - Angular module

## Regeneration

To regenerate this client, run:

\`\`\`bash
npm run generate:republica-cafe-management
\`\`\`

**Note: This directory is auto-generated. Do not edit files manually as they will be overwritten.**
`;

    fs.writeFileSync(path.join(CONFIG.outputDir, "README.md"), readmeContent);
    log("✓ README created");
}

/**
 * Clean up temporary files
 */
function cleanupTemp() {
    log("Cleaning up temporary files...");

    if (fs.existsSync(CONFIG.tempDir)) {
        execCommand(`rm -rf "${CONFIG.tempDir}"`);
    }

    log("✓ Temporary files cleaned up");
}

/**
 * Main execution
 */
function main() {
    console.log("🚀 Starting Auth API client generation...\n");

    try {
        cleanup();
        validateSpec();
        generateClient();
        postProcess();
        createIndexFile();
        createAngularModule();
        createReadme();
        cleanupTemp();

        console.log("\n✅ Auth API client generated successfully!");
        console.log(`📁 Output directory: ${CONFIG.outputDir}`);
        console.log("\nNext steps:");
        console.log("1. Import AuthApiModule in your Angular app");
        console.log("2. Configure the API base URL and authentication");
        console.log("3. Use the generated services in your components");
    } catch (error) {
        console.error("\n❌ Generation failed:", error.message);
        process.exit(1);
    }
}

// Run if called directly
if (require.main === module) {
    main();
}

module.exports = {
    generate: main,
    CONFIG,
};
