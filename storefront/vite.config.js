import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig({
    plugins: [react()],
    server: {
        port: 3001,
        proxy: { '/b/': { target: 'http://localhost:5000', changeOrigin: true }, '/api': { target: 'http://localhost:5000', changeOrigin: true }, '/uploads': { target: 'http://localhost:5000', changeOrigin: true } },
    },
    build: { target: 'es2020', cssCodeSplit: true },
});
