// Thème : sombre par défaut, clair ou selon le système.
import * as store from './store.js';

const media = window.matchMedia?.('(prefers-color-scheme: dark)');

export function applyTheme() {
  const pref = store.get().settings.theme || 'dark';
  const theme = pref === 'auto' ? (media?.matches ? 'dark' : 'light') : pref;
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#07090d' : '#f4f6fa');
}

media?.addEventListener?.('change', applyTheme);
