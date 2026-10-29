import { defineConfig } from 'vite';

// base relative : l'app fonctionne sur GitHub Pages (sous-dossier) comme en local.
export default defineConfig({
  base: './',
  build: { target: 'es2020', outDir: 'dist' },
});
