// Détection de la plateforme et du mode d'affichage (§9 de la spec technique).

// Cette méthode permet de savoir si l'app tourne installée (écran d'accueil) plutôt que dans un onglet de navigateur.
export function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

// Cette méthode permet de détecter un iPhone ou un iPad (y compris iPadOS qui se présente comme un Mac).
export function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) || (ua.includes('Macintosh') && navigator.maxTouchPoints > 1);
}

// Cette méthode permet de formater un code d'invitation en groupes de 4 (RX7K-2P9Q-D4MA).
export function formatInviteCode(code: string): string {
  return normalizeInviteCode(code)
    .replace(/(.{4})(?=.)/g, '$1-')
    .slice(0, 14);
}

// Cette méthode permet de nettoyer un code collé (majuscules, sans tirets ni espaces).
export function normalizeInviteCode(code: string): string {
  return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}
