import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  return {
    plugins: [react()],
    base: './',
    build: {
      outDir: 'mobile-web',
      emptyOutDir: true,
      // Old Android WebViews can choke on Vite's default modern output.
      target: 'chrome61',
      cssTarget: 'chrome61',
    },
    define: {
      'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_URL ?? ''),
      'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''),
    },
  };
});
