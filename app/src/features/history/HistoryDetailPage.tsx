import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { useHistoryWithBadges } from '@/data/derived';
import { useExerciseMap, useSettings, useWorkout } from '@/data/queries';
import { createRoutine, deleteWorkout } from '@/data/repositories';
import {
  criterionLabel,
  formatDurationHuman,
  formatKg,
  formatSetValues,
  formatTarget,
} from '@/domain/format';
import { uuidv7 } from '@/domain/ids';
import { setLabels } from '@/domain/labels';
import { missedTarget, setMeetsTarget, targetsMet } from '@/domain/progression';
import { workoutToRoutine } from '@/domain/routineDiff';
import { workoutSummary } from '@/domain/summary';
import { Sheet, SubHead, toast } from '@/ui/components';
import { DotsIcon } from '@/ui/icons';
import { formatWorkoutDate } from './HistoryCard';
import { PhotoView } from './PhotoView';

// Cette méthode permet d'afficher le détail d'une séance passée : toutes les séries, records, objectifs, note et photo (§F7.5).
// Elle donne accès à la modification, à la suppression et à « enregistrer comme routine ».
export default function HistoryDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const row = useWorkout(id);
  const { badges: all } = useHistoryWithBadges();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const [menu, setMenu] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const badges = id ? all[id] : undefined;
  const summary = useMemo(() => (row ? workoutSummary(row, badges, Date.now()) : undefined), [row, badges]);

  if (row === undefined) return <div className="page" />;
  if (!row || row.deleted_at != null || !summary) {
    return (
      <>
        <SubHead title="Séance" />
        <p className="empty">Cette séance n'existe plus.</p>
      </>
    );
  }

  // Cette méthode permet de créer une routine à partir de cette séance (structure, séries validées, charges comme cibles).
  const saveAsRoutine = async () => {
    const doc = workoutToRoutine(row.doc, {
      name: row.doc.title.replace(/ – .*$/, '') || 'Nouvelle routine',
      newId: uuidv7,
    });
    await createRoutine(doc, null);
    setMenu(false);
    toast('Routine créée');
  };

  return (
    <>
      <SubHead
        title={row.doc.title || 'Séance'}
        right={
          <button className="icon-btn" aria-label="Actions" onClick={() => setMenu(true)}>
            <DotsIcon />
          </button>
        }
      />
      <div className="section" style={{ marginTop: 0 }}>
        <div className="muted" style={{ fontSize: '.875rem' }}>
          {formatWorkoutDate(row.started_at)}
        </div>
        <div className="mini" style={{ display: 'flex', gap: 18, margin: '12px 0' }}>
          <div className="stat">
            <div className="k">Durée</div>
            <div className="v">{formatDurationHuman(summary.durationS)}</div>
          </div>
          <div className="stat">
            <div className="k">Volume</div>
            <div className="v">{formatKg(summary.volumeKg, settings.units.weight, 0)}</div>
          </div>
          <div className="stat">
            <div className="k">Séries</div>
            <div className="v">{summary.setCount}</div>
          </div>
          <div className="stat">
            <div className="k">Records</div>
            <div className="v">
              {summary.recordCount > 0 ? <span className="pr-pill">🏆 {summary.recordCount}</span> : '0'}
            </div>
          </div>
        </div>
        {summary.targets.total > 0 && (
          <div className="goal-sum">
            🎯 Objectifs atteints : {summary.targets.met} / {summary.targets.total} exercices
          </div>
        )}
        {row.doc.note && (
          <p className="t2" style={{ fontSize: '.9375rem', lineHeight: 1.5 }}>
            {row.doc.note}
          </p>
        )}
        {row.doc.photoPath && <PhotoView path={row.doc.photoPath} height={220} />}
      </div>
      <div className="section">
        {row.doc.exercises.map((e) => {
          const ex = exercises.get(e.exerciseId);
          const labels = setLabels(e.sets.map((s) => s.kind));
          const met = targetsMet(e);
          const missed = e.sets.map((s) => missedTarget(s, e.measurementType));
          return (
            <div key={e.id} className="card hist">
              <Link to={`/exercise/${e.exerciseId}`} style={{ textDecoration: 'none' }}>
                <h3 style={{ fontSize: '.9375rem', color: 'var(--accent)' }}>
                  {ex?.name ?? 'Exercice'}
                  {badges?.entries[e.id]?.length ? ' 🏆' : ''}
                </h3>
              </Link>
              {met !== undefined && (
                <div className="date">
                  <span className={met ? 'ok' : 'ko'}>
                    {met ? '🎯 objectif atteint' : 'objectif non atteint'}
                  </span>
                </div>
              )}
              {e.note && <p className="note">{e.note}</p>}
              <ul style={{ marginTop: 10 }}>
                {e.sets.map((s, i) => (
                  <li key={s.id}>
                    <b
                      style={{
                        color:
                          s.kind === 'warmup'
                            ? 'var(--warm)'
                            : s.kind === 'drop'
                              ? 'var(--drop)'
                              : s.kind === 'failure'
                                ? 'var(--fail)'
                                : undefined,
                      }}
                    >
                      {labels[i]}
                    </b>
                    {formatSetValues(s, e.measurementType, settings.units)}
                    {badges?.sets[s.id]?.length ? (
                      <span
                        className="pr-pill"
                        title={badges.sets[s.id]!.map((c) =>
                          ex ? criterionLabel(c, ex.measurement_type) : c,
                        ).join(', ')}
                      >
                        🏆
                      </span>
                    ) : null}
                    {setMeetsTarget(s, e.measurementType) ? <span className="ok">✓</span> : null}
                    {missed[i] ? (
                      <span className="muted">
                        {' '}
                        · obj. {formatTarget(missed[i], e.measurementType, settings.units)}
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <Sheet
        open={menu}
        title={row.doc.title}
        onClose={() => setMenu(false)}
        actions={[
          { label: 'Modifier la séance', kind: 'primary', onClick: () => navigate(`/workout/${row.id}`) },
          { label: 'Enregistrer comme routine', onClick: saveAsRoutine },
          {
            label: 'Supprimer la séance',
            kind: 'danger',
            onClick: () => {
              setMenu(false);
              setConfirm(true);
            },
          },
        ]}
      />
      <Sheet
        open={confirm}
        title="Supprimer la séance ?"
        onClose={() => setConfirm(false)}
        actions={[
          {
            label: 'Supprimer',
            kind: 'danger',
            onClick: async () => {
              await deleteWorkout(row.id);
              navigate('/', { replace: true });
            },
          },
          { label: 'Annuler', onClick: () => setConfirm(false) },
        ]}
      >
        <p>Les records et statistiques des séances suivantes seront recalculés.</p>
      </Sheet>
    </>
  );
}
