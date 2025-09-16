import Constants from 'expo-constants';

interface EnvConfig {
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  OPENROUTER_API_KEY: string;
  APP_NAME: string;
  APP_SCHEME: string;
  APP_DOMAIN: string;
  APPLE_CLIENT_ID: string;
  DEBUG_MODE: boolean;
  API_TIMEOUT: number;
}

class EnvironmentManager {
  private config: Partial<EnvConfig> = {};

  constructor() {
    this.loadConfig();
  }

  private loadConfig() {
    // Load from Expo Constants (which reads from app.json extra field)
    const expoConfig = Constants.expoConfig?.extra || {};

    // In development, you can also load from environment variables
    // Note: React Native doesn't support process.env directly
    // This would typically be handled by a bundler plugin or build process

    this.config = {
      GOOGLE_CLIENT_ID: expoConfig.googleClientId || expoConfig.GOOGLE_CLIENT_ID || '',
      GOOGLE_CLIENT_SECRET: expoConfig.googleClientSecret || expoConfig.GOOGLE_CLIENT_SECRET || '',
      OPENROUTER_API_KEY: expoConfig.openRouterApiKey || expoConfig.OPENROUTER_API_KEY || '',
      APP_NAME: expoConfig.appName || expoConfig.APP_NAME || 'PlantAI Interior',
      APP_SCHEME: expoConfig.appScheme || expoConfig.APP_SCHEME || 'plant-interior-ai',
      APP_DOMAIN: expoConfig.appDomain || expoConfig.APP_DOMAIN || 'plant-interior-ai.app',
      APPLE_CLIENT_ID: expoConfig.appleClientId || expoConfig.APPLE_CLIENT_ID || '',
      DEBUG_MODE: expoConfig.debugMode || expoConfig.DEBUG_MODE || false,
      API_TIMEOUT: expoConfig.apiTimeout || expoConfig.API_TIMEOUT || 30000,
    };
  }

  get<K extends keyof EnvConfig>(key: K): EnvConfig[K] {
    const value = this.config[key];

    if (value === undefined || value === '') {
      if (this.isRequired(key)) {
        throw new Error(`Environment variable ${key} is required but not set`);
      }
    }

    return value as EnvConfig[K];
  }

  private isRequired(key: keyof EnvConfig): boolean {
    const required = [
      'GOOGLE_CLIENT_ID',
      'OPENROUTER_API_KEY',
    ];
    return required.includes(key);
  }

  // Helper methods for commonly used values
  getGoogleClientId(): string {
    return this.get('GOOGLE_CLIENT_ID');
  }

  getOpenRouterApiKey(): string {
    const key = this.get('OPENROUTER_API_KEY');
    console.log('Environment OpenRouter key:', key ? `${key.substring(0, 10)}...` : 'MISSING');
    return key;
  }

  getAppScheme(): string {
    return this.get('APP_SCHEME');
  }

  getAppDomain(): string {
    return this.get('APP_DOMAIN');
  }

  isDebugMode(): boolean {
    return this.get('DEBUG_MODE');
  }

  getApiTimeout(): number {
    return this.get('API_TIMEOUT');
  }

  // Validation method to check if all required env vars are set
  validateConfig(): { isValid: boolean; missingVars: string[] } {
    const requiredVars = ['GOOGLE_CLIENT_ID', 'OPENROUTER_API_KEY'];
    const missingVars: string[] = [];

    for (const varName of requiredVars) {
      try {
        this.get(varName as keyof EnvConfig);
      } catch (error) {
        missingVars.push(varName);
      }
    }

    return {
      isValid: missingVars.length === 0,
      missingVars,
    };
  }
}

// Export singleton instance
export const env = new EnvironmentManager();

// Export type for TypeScript support
export type { EnvConfig };