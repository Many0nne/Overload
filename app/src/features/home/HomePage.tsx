import { useEffect, useMemo, useRef, useState } from 'react';
import { useHistoryWithBadges } from '@/data/derived';
import { useExerciseMap, useProfile, useSettings } from '@/data/queries';
import { formatDurationHuman, formatKg } from '@/domain/format';
import { parseDayKey } from '@/domain/dates';
import { currentWeekDays, weeklyAggregates, weekStreak } from '@/domain/stats';
import { HistoryCard } from '@/features/history/HistoryCard';
import { SyncPill } from '@/ui/SyncPill';

const PAGE = 20;
const dayLetter = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const rangeFmt = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });

// Cette méthode permet d'afficher l'accueil : résumé de la semaine, série de semaines et historique paginé (§F8).
export default function HomePage() {
  const { workouts, badges } = useHistoryWithBadges();
  const exercises = useExerciseMap();
  const settings = useSettings();
  const profile = useProfile();
  const [count, setCount] = useState(PAGE);
  const sentinel = useRef<HTMLDivElement>(null);
  const now = Date.now();

  const { week, days, streak, list } = useMemo(() => {
    const all = workouts ?? [];
    return {
      week: weeklyAggregates(all, now, 1).at(-1),
      days: currentWeekDays(all, now),
      streak: weekStreak(all, now),
      list: [...all].reverse(),
    };
  }, [workouts, Math.floor(now / 60_000)]);

  // Chargement par pages au fil du défilement (§F7.5).
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) setCount((c) => c + PAGE);
    });
    io.observe(el);
    return () => io.disconnect();
  }, [list.length]);

  const initial = (profile?.display_name ?? '?').charAt(0).toUpperCase();
  const first = days[0];
  const last = days[6];

  return (
    <>
      <div className="head">
        <h2>Accueil</h2>
        <div className="right">
          <SyncPill />
        </div>
      </div>
      <div className="section" style={{ marginTop: 4 }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <b style={{ fontSize: '1rem' }}>Cette semaine</b>
            {first && last && (
              <span className="muted" style={{ fontSize: '.8125rem' }}>
                {rangeFmt.format(parseDayKey(first.day))} – {rangeFmt.format(parseDayKey(last.day))}
              </span>
            )}
          </div>
          <div className="stats-row" style={{ padding: '12px 0 0' }}>
            <div className="stat">
              <div className="k">Séances</div>
              <div className="v">{week?.count ?? 0}</div>
            </div>
            <div className="stat">
              <div className="k">Durée</div>
              <div className="v">{formatDurationHuman(week?.durationS ?? 0)}</div>
            </div>
            <div className="stat">
              <div className="k">Volume</div>
              <div className="v">{formatKg(week?.volumeKg ?? 0, settings.units.weight, 0)}</div>
            </div>
          </div>
          <div className="week">
            {days.map((d, i) => (
              <div key={d.day} className={`d${d.trained ? ' on' : ''}${d.today ? ' today' : ''}`}>
                <i>{dayLetter[i]}</i>
                {Number(d.day.slice(8))}
              </div>
            ))}
          </div>
          <div className="streak">
            <span style={{ fontSize: '1.375rem' }}>🔥</span>
            <div>
              <b>
                {streak} semaine{streak > 1 ? 's' : ''} d'affilée
              </b>
              <div className="muted" style={{ fontSize: '.8125rem' }}>
                au moins une séance chaque semaine
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="section">
        <div className="section-title">Historique</div>
        {workouts && list.length === 0 && (
          <p className="empty">Aucune séance pour l'instant. Démarre-en une depuis l'onglet Séance.</p>
        )}
        {list.slice(0, count).map((w) => (
          <HistoryCard
            key={w.id}
            workout={w}
            badges={badges[w.id]}
            exercises={exercises}
            units={settings.units}
            initial={initial}
          />
        ))}
        {count < list.length && <div ref={sentinel} style={{ height: 40 }} />}
      </div>
    </>
  );
}
