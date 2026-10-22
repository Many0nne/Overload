// Recherche insensible aux accents (§F7.2).

// Cette méthode permet de normaliser un texte pour la recherche : décomposition NFD, sans diacritiques, minuscules.
export function normalizeSearch(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

// Cette méthode permet de savoir si un nom normalisé correspond à une requête (tous les mots de la requête présents).
export function matchesSearch(nameSearch: string, query: string): boolean {
  const q = normalizeSearch(query);
  if (!q) return true;
  return q.split(' ').every((word) => nameSearch.includes(word));
}
