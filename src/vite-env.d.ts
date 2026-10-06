/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

declare const __APP_BUILD_ID__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  readonly VITE_BACKEND?: 'supabase' | 'hono';
  /** 4-digit PIN required to show portfolio values after they are hidden. */
  readonly VITE_VALUES_PIN?: string;
}
