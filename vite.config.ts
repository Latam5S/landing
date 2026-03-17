import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        form: resolve(__dirname, 'form.html'),
      },
    },
    outDir: 'dist',
  },
  publicDir: 'public',
  server: {
    port: 8090,
  },
});
