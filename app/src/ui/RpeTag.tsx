import { formatRpe } from '@/domain/format';
import { rpeColor } from '@/ui/rpeColor';

// Cette méthode permet d'afficher « @ RPE x » d'une série dans l'historique, teinté selon l'effort lorsque la valeur est valide.
export function RpeTag(p: { rpe: number }) {
  const style = rpeColor(p.rpe);
  return (
    <span className={style ? 'rpe-tag rpe-tint' : 'muted'} style={style}>
      @ RPE {formatRpe(p.rpe)}
    </span>
  );
}
