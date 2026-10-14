import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // Android アプリの中ではファイルとして読み込むため、相対パスにする
  base: './',
  plugins: [react(), tailwindcss()],
});
