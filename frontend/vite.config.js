import { defineConfig } from 'vite'
export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        loja: new URL('./index.html', import.meta.url).pathname,
        admin: new URL('./admin.html', import.meta.url).pathname,
      },
    },
  },
})
