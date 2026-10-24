import type { SetKind } from '@/domain/types';

// Classe de couleur d'une nature de série (échauffement W, dégressive D, échec X), partagée par le tableau de séance,
// la feuille de choix, l'historique et l'édition de routine.
export const KIND_CLASS: Record<SetKind, string> = { normal: '', warmup: 'W', drop: 'D', failure: 'X' };
