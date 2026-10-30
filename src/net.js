// Erreurs réseau en français partout : « Failed to fetch » (pas de réseau, réseau trop faible, serveur injoignable)
// devient un message clair, marqué offline pour que l'appli puisse mettre la demande de côté.
export const OFFLINE_MSG = 'Pas de connexion internet. Réessaie quand tu auras du réseau.';
export const WEAK_MSG = 'Connexion impossible ou trop faible. Vérifie ton réseau et réessaie.';

export const isOffline = (e) => !!e && (e.offline || /failed to fetch|networkerror|load failed|network request failed|internet/i.test(e.message || ''));

export function netError(cause) {
  const e = new Error(typeof navigator !== 'undefined' && navigator.onLine === false ? OFFLINE_MSG : WEAK_MSG);
  e.offline = true;
  e.cause = cause;
  return e;
}

if (typeof window !== 'undefined' && window.fetch && !window.fetch.wrapped) {
  const nativeFetch = window.fetch.bind(window);
  const wrapped = async (...args) => {
    try { return await nativeFetch(...args); } catch (e) {
      if (e?.name === 'AbortError') throw e;
      throw netError(e);
    }
  };
  wrapped.wrapped = true;
  window.fetch = wrapped;
}
