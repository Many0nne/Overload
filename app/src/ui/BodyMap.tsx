import { memo } from 'react';
import { BODY_BACK, BODY_FRONT, type BodyView } from '@/data/bodyMap.generated';
import {
  type BodySide,
  bodyHighlights,
  type Highlight,
  OVERLAY_ZONES,
  thumbnailSide,
} from '@/domain/bodyMap';
import type { Muscle } from '@/domain/types';

const VIEWS: Record<BodySide, BodyView> = { front: BODY_FRONT, back: BODY_BACK };

// Recadrage de la miniature : haut du corps (tête aux hanches) ou bas du corps (hanches aux pieds).
const LOWER: ReadonlySet<Muscle> = new Set(['quads', 'hamstrings', 'glutes', 'calves']);
const CROP_X: Record<BodySide, number> = { front: 0, back: 718 };
const CROP_UPPER = { y: 110, h: 640 };
const CROP_LOWER = { y: 600, h: 775 };

// Cette méthode permet de dessiner une vue du corps en colorant les zones sollicitées.
function Silhouette(props: { side: BodySide; highlights: Map<string, Highlight>; viewBox?: string }) {
  const view = VIEWS[props.side];
  return (
    <svg className="body-map" viewBox={props.viewBox ?? view.viewBox} aria-hidden="true">
      {view.parts.map((p) => {
        const h = props.highlights.get(p.slug);
        if (!h && OVERLAY_ZONES.has(p.slug)) return null;
        return <path key={p.slug} className={h ? `bm-${h}` : 'bm-base'} d={p.d.join(' ')} />;
      })}
    </svg>
  );
}

// Cette méthode permet d'afficher la miniature d'un exercice : une vue recadrée sur son muscle principal.
export const MuscleThumb = memo(function MuscleThumb(props: {
  primary: Muscle;
  secondary: readonly Muscle[];
}) {
  const side = thumbnailSide(props.primary);
  const crop = LOWER.has(props.primary) ? CROP_LOWER : CROP_UPPER;
  const w = 727;
  const x = CROP_X[side] + (w - crop.h) / 2;
  return (
    <span className="ex-av body-thumb">
      <Silhouette
        side={side}
        highlights={bodyHighlights(props.primary, props.secondary)}
        viewBox={`${x} ${crop.y} ${crop.h} ${crop.h}`}
      />
    </span>
  );
});

// Cette méthode permet d'afficher la carte musculaire complète (face et dos) sur la fiche d'un exercice.
export function BodyMap(props: { primary: Muscle; secondary: readonly Muscle[] }) {
  const highlights = bodyHighlights(props.primary, props.secondary);
  return (
    <div className="body-pair">
      <Silhouette side="front" highlights={highlights} />
      <Silhouette side="back" highlights={highlights} />
    </div>
  );
}
