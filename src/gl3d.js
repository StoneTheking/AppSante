// Moteur 3D partagé (three.js, WebGL) : un seul contexte graphique pour toute l'appli.
// Chaque scène (Diana, mannequins de sport) est rendue dans ce canevas caché puis recopiée dans son
// propre <canvas> 2D : on peut afficher autant de Diana et de démonstrations que l'on veut sans
// dépasser la limite de contextes WebGL du téléphone, et l'image affichée ne disparaît jamais
// (si Android retire le contexte graphique quand l'appli passe en arrière-plan, la dernière image reste).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export { THREE };

let R = null; // { renderer, env, w, h }
let failed = false;
const listeners = new Set();

// Appelé quand le contexte est recréé : les scènes doivent reconstruire leurs textures d'environnement.
export const onReset = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function create() {
  if (failed || typeof document === 'undefined') return null;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 512;
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(1);
    renderer.setSize(512, 512, false);
    renderer.setClearColor(0x000000, 0);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.autoClear = true;
    const pm = new THREE.PMREMGenerator(renderer);
    const env = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      // on repartira d'un contexte neuf au prochain dessin
      try { R?.renderer.dispose(); } catch { /* déjà perdu */ }
      R = null;
      listeners.forEach((fn) => fn());
    });
    return { renderer, env, w: 512, h: 512 };
  } catch {
    failed = true;
    return null;
  }
}

export const available = () => !!(R || (R = create()));
export const envMap = () => (available() ? R.env : null);
let gen = 0; // incrémenté à chaque recréation du contexte
export const generation = () => gen;

// Rend « scene » vue par « camera » à la taille du canevas cible, puis la recopie dedans.
export function blit(target, scene, camera) {
  if (!R) { R = create(); if (R) gen++; }
  if (!R) return false;
  const W = target.width, H = target.height;
  if (!W || !H) return true;
  const { renderer } = R;
  if (W > R.w || H > R.h) {
    R.w = Math.min(2048, Math.max(R.w, W)); R.h = Math.min(2048, Math.max(R.h, H));
    renderer.setSize(R.w, R.h, false);
  }
  const w = Math.min(W, R.w), h = Math.min(H, R.h);
  renderer.setViewport(0, 0, w, h);
  renderer.setScissor(0, 0, w, h);
  renderer.setScissorTest(true);
  if (camera.isPerspectiveCamera && Math.abs(camera.aspect - w / h) > 1e-3) { camera.aspect = w / h; camera.updateProjectionMatrix(); }
  try { renderer.render(scene, camera); } catch { return false; }
  const ctx = target.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, W, H);
  // l'origine de WebGL est en bas à gauche : la zone dessinée est en bas du canevas partagé
  ctx.drawImage(renderer.domElement, 0, R.h - h, w, h, 0, 0, W, H);
  return true;
}
