// Quota de Storage (§12, §19 spec technique) : 1 Go sur l'offre Free, alerte de l'admin à 80 %.

export const STORAGE_ALERT_RATIO = 0.8;

// Cette méthode permet de savoir si l'occupation de Storage atteint le seuil d'alerte de 80 % du quota.
export function isStorageNearQuota(usedBytes: number | null, quotaBytes: number): boolean {
  return usedBytes !== null && quotaBytes > 0 && usedBytes / quotaBytes >= STORAGE_ALERT_RATIO;
}

// Cette méthode permet d'afficher l'occupation sous la forme « 412 Mo / 1 Go · 40 % ».
export function formatStorageUsage(usedBytes: number, quotaBytes: number): string {
  const mo = (b: number) => Math.round(b / 1_048_576);
  const quota =
    quotaBytes >= 1_073_741_824 ? `${Math.round(quotaBytes / 1_073_741_824)} Go` : `${mo(quotaBytes)} Mo`;
  const pct = Math.floor((usedBytes / quotaBytes) * 100);
  return `${mo(usedBytes)} Mo / ${quota} · ${pct} %`;
}
