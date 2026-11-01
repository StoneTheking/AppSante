// Photos des repas en pleine taille, gardées sur le téléphone (IndexedDB : bien plus de place que le stockage
// principal) pour que l'IA puisse regarder à nouveau la photo quand on corrige une analyse, et pour l'afficher nette.
// Sans IndexedDB (tests, navigateur privé), tout continue de marcher : simplement pas de photo gardée.
const DB = 'appsante-photos', STORE = 'photos', MAX = 80;
let dbp = null;
function db() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  dbp ||= new Promise((resolve) => {
    try {
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => resolve(null);
    } catch { resolve(null); }
  });
  return dbp;
}
async function run(mode, fn) {
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const tx = d.transaction(STORE, mode), st = tx.objectStore(STORE);
      const req = fn(st);
      tx.oncomplete = () => resolve(req?.result ?? null);
      tx.onerror = tx.onabort = () => resolve(null);
    } catch { resolve(null); }
  });
}
export const savePhoto = (id, dataUrl) => (id && dataUrl ? run('readwrite', (st) => st.put({ dataUrl, at: Date.now() }, id)) : Promise.resolve(null));
export const getPhoto = async (id) => (await run('readonly', (st) => st.get(id)))?.dataUrl || null;
// Ménage : photos des repas supprimés, et au-delà des MAX plus récentes.
export async function prunePhotos(mealIds) {
  const keep = new Set(mealIds);
  const all = await run('readonly', (st) => st.getAllKeys());
  if (!all) return;
  const ids = all.filter((k) => keep.has(k));
  const drop = all.filter((k) => !keep.has(k));
  if (ids.length > MAX) {
    const ages = await Promise.all(ids.map(async (k) => [k, (await run('readonly', (st) => st.get(k)))?.at || 0]));
    drop.push(...ages.sort((a, b) => b[1] - a[1]).slice(MAX).map(([k]) => k));
  }
  if (drop.length) await run('readwrite', (st) => { drop.forEach((k) => st.delete(k)); });
}
