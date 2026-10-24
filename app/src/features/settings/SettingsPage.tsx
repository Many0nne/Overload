import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { type PendingSync, signOut, syncBeforeSignOut } from '@/data/auth';
import { disablePush, enablePush, sendTestNotification } from '@/data/push';
import { useProfile, useSettings } from '@/data/queries';
import { updateSettings } from '@/data/repositories';
import { useSession } from '@/data/session';
import { refreshStorageUsage, useStorageUsage } from '@/data/storageUsage';
import { supabase } from '@/data/supabase';
import { syncNow } from '@/data/sync/scheduler';
import { TRAINING_AGE_LABELS } from '@/domain/labels';
import { BAR_CHOICES, PLATE_CHOICES, plateSetFor } from '@/domain/plates';
import { formatStorageUsage, isStorageNearQuota } from '@/domain/quota';
import type { Settings, TrainingAgeBucket } from '@/domain/types';
import { formatPlate } from '@/features/plates/PlateBar';
import { Seg, Sheet, SubHead, Switch, toast } from '@/ui/components';
import { formatInviteCode } from '@/ui/platform';
import { formatRest } from '@/ui/time';
import { DeleteAccountSheet } from './DeleteAccountSheet';
import { exportData } from './exportData';

const REST_CHOICES: (number | null)[] = [null, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

// Cette méthode permet de décrire en toutes lettres ce qui reste à synchroniser, ex. « 2 modifications et 1 photo ».
function describePending({ changes, photos }: PendingSync): string {
  const parts = [];
  if (changes > 0) parts.push(`${changes} modification${changes > 1 ? 's' : ''}`);
  if (photos > 0) parts.push(`${photos} photo${photos > 1 ? 's' : ''}`);
  return `${parts.join(' et ')} ${changes + photos > 1 ? 'ne sont' : "n'est"}`;
}

// Cette méthode permet d'afficher et de modifier tous les paramètres de l'utilisateur (§F7.8).
// Cette méthode permet d'afficher à l'admin l'occupation de Storage, relue à l'ouverture, en alerte au-delà de 80 % (§19).
function AdminSection() {
  const { usedBytes, quotaBytes } = useStorageUsage();
  const near = isStorageNearQuota(usedBytes, quotaBytes);
  useEffect(() => {
    void refreshStorageUsage(true);
  }, []);
  return (
    <div className="section">
      <div className="section-title">Administration</div>
      <div className="set-row">
        Stockage photos
        <span className={near ? 'c-warm' : 't2'}>
          {usedBytes === null ? '—' : formatStorageUsage(usedBytes, quotaBytes)}
        </span>
      </div>
      {near && (
        <p className="t2 px-16 pb-12">
          Le quota de 1 Go approche : au-delà, l'envoi des photos échouera. Supprimer d'anciennes photos ou
          passer à une offre Supabase supérieure.
        </p>
      )}
    </div>
  );
}

export default function SettingsPage() {
  const navigate = useNavigate();
  const settings = useSettings();
  const profile = useProfile();
  const email = useSession((s) => s.email);
  const [sheet, setSheet] = useState<
    'rest' | 'bar' | 'plates' | 'age' | 'invite' | 'export' | 'delete' | 'logout' | 'logout-pending' | null
  >(null);
  const [pending, setPending] = useState<PendingSync | null>(null);
  const [checking, setChecking] = useState(false);

  const set = (patch: Partial<Settings>) => void updateSettings(patch);
  const units = settings.units;
  const plateSet = plateSetFor(settings, units.weight);
  // Cette méthode permet d'enregistrer la barre ou les disques de l'unité de poids courante (l'autre unité garde les siens).
  const setPlates = (patch: Partial<typeof plateSet>) =>
    set({ plates: { ...settings.plates, [units.weight]: { ...plateSet, ...patch } } });
  // Cette méthode permet d'activer ou retirer un disque disponible, en gardant au moins un disque.
  const togglePlate = (p: number) => {
    const on = plateSet.plates.includes(p);
    if (on && plateSet.plates.length === 1) return toast('Garde au moins un disque');
    setPlates({
      plates: on ? plateSet.plates.filter((q) => q !== p) : [...plateSet.plates, p].sort((a, b) => b - a),
    });
  };
  const inviteLink = profile ? `${location.origin}/i/${profile.invite_code}` : '';

  // Cette méthode permet de remplacer le code d'invitation, ce qui rend l'ancien lien inutilisable (§F7.1).
  const regenerate = async () => {
    const { error } = await supabase.rpc('regenerate_invite');
    if (error) return toast('Impossible hors ligne');
    await syncNow();
    toast('Nouveau lien créé');
    setSheet(null);
  };

  // Cette méthode permet de se déconnecter après une dernière synchro lorsque tout est envoyé,
  // sinon d'ouvrir l'avertissement listant ce qui serait perdu (outbox ou photos en attente).
  const requestSignOut = async () => {
    if (checking) return;
    setChecking(true);
    const left = await syncBeforeSignOut().finally(() => setChecking(false));
    if (left.changes === 0 && left.photos === 0) return signOut();
    setPending(left);
    setSheet('logout-pending');
  };

  // Cette méthode permet d'exporter les données locales puis de se déconnecter, sauf si l'export échoue ou est annulé.
  const exportThenSignOut = async () => {
    try {
      await exportData();
    } catch (e) {
      return toast(e instanceof Error ? e.message : 'Export impossible');
    }
    await signOut();
  };

  return (
    <>
      <SubHead title="Paramètres" />
      <div className="section mt-4">
        <div className="section-title">Unités</div>
        <div className="set-row">
          Poids
          <Seg
            value={units.weight}
            onChange={(weight) => set({ units: { ...units, weight } })}
            options={[
              { value: 'kg', label: 'kg' },
              { value: 'lb', label: 'lb' },
            ]}
          />
        </div>
        <div className="set-row">
          Longueur
          <Seg
            value={units.length}
            onChange={(length) => set({ units: { ...units, length } })}
            options={[
              { value: 'cm', label: 'cm' },
              { value: 'in', label: 'in' },
            ]}
          />
        </div>
        <div className="set-row">
          Distance
          <Seg
            value={units.distance}
            onChange={(distance) => set({ units: { ...units, distance } })}
            options={[
              { value: 'km', label: 'km' },
              { value: 'mi', label: 'mi' },
            ]}
          />
        </div>
      </div>

      <div className="section">
        <div className="section-title">Séance</div>
        <button className="set-row" onClick={() => setSheet('rest')}>
          Repos par défaut<span className="t2">{formatRest(settings.defaultRestS)} ›</span>
        </button>
        <div className="set-row">
          <span>
            Notification fin de repos
            <small className="muted d-block fs-12">
              son système uniquement ; si muette : Réglages › Notifications › Overload › Sons, mode
              silencieux, Concentration
            </small>
          </span>
          <Switch
            label="Notification fin de repos"
            on={settings.restNotification}
            onChange={async (v) => {
              if (!v) void disablePush();
              else if ((await enablePush()) === 'denied')
                toast('Autorise les notifications dans Réglages iOS');
              set({ restNotification: v });
            }}
          />
        </div>
        <div className="set-row">
          <span>
            Son du minuteur
            <small className="muted d-block fs-12">
              app ouverte ; coupé par le mode silencieux de l'iPhone
            </small>
          </span>
          <Switch label="Son du minuteur" on={settings.timerSound} onChange={(v) => set({ timerSound: v })} />
        </div>
        <div className="set-row">
          Garder l'écran allumé
          <Switch
            label="Garder l'écran allumé"
            on={settings.keepAwake}
            onChange={(v) => set({ keepAwake: v })}
          />
        </div>
      </div>

      <div className="section">
        <div className="section-title">Disques</div>
        <button className="set-row" onClick={() => setSheet('bar')}>
          Barre
          <span className="t2">
            {formatPlate(plateSet.bar)} {units.weight} ›
          </span>
        </button>
        <button className="set-row" onClick={() => setSheet('plates')}>
          <span>
            Disques disponibles
            <small className="muted d-block fs-12">calcul des disques pour les exercices à la barre</small>
          </span>
          <span className="t2">{plateSet.plates.length} ›</span>
        </button>
      </div>

      <div className="section">
        <div className="section-title">Progression</div>
        <div className="set-row">
          <span>
            Objectifs de progression
            <small className="muted d-block fs-12">pré-remplissage et tendance projetée</small>
          </span>
          <Switch
            label="Objectifs de progression"
            on={settings.progressionEnabled}
            onChange={(v) => set({ progressionEnabled: v })}
          />
        </div>
        <div className="set-row">
          <span>
            Saisir l'effort ressenti (RPE)
            <small className="muted d-block fs-12">
              proposé après chaque série validée, affine les objectifs
            </small>
          </span>
          <Switch
            label="Saisir l'effort ressenti (RPE)"
            on={settings.rpeEnabled}
            onChange={(v) => set({ rpeEnabled: v })}
          />
        </div>
        <button className="set-row" onClick={() => setSheet('age')}>
          Ancienneté en musculation
          <span className="t2">
            {settings.trainingAge ? TRAINING_AGE_LABELS[settings.trainingAge.bucket] : 'Non renseignée'} ›
          </span>
        </button>
      </div>

      <div className="section">
        <div className="section-title">Apparence</div>
        <div className="set-row">
          Thème
          <Seg
            value={settings.theme}
            onChange={(theme) => set({ theme })}
            options={[
              { value: 'light', label: 'Clair' },
              { value: 'dark', label: 'Sombre' },
              { value: 'auto', label: 'Auto' },
            ]}
          />
        </div>
      </div>

      <div className="section">
        <div className="section-title">Compte</div>
        <div className="set-row">
          E-mail<span className="t2">{email}</span>
        </div>
        <button className="set-row" onClick={() => setSheet('invite')}>
          Lien d'invitation<span className="c-accent">Copier · Régénérer</span>
        </button>
        <button className="set-row" onClick={() => setSheet('export')}>
          Exporter mes données<span className="t2">JSON · CSV ›</span>
        </button>
        <button className="set-row" onClick={() => navigate('/profile/settings/import-hevy')}>
          Importer depuis HEVY<span className="t2">CSV ›</span>
        </button>
        <button className="set-row" onClick={() => navigate('/profile/settings/claude')}>
          Claude<span className="t2">Connecteur ›</span>
        </button>
        <button className="set-row" onClick={() => setSheet('logout')}>
          Se déconnecter
          <span />
        </button>
        <button className="set-row c-fail" onClick={() => setSheet('delete')}>
          Supprimer le compte
          <span />
        </button>
      </div>

      {profile?.is_admin && <AdminSection />}

      <div className="section">
        <div className="section-title">À propos</div>
        <button className="set-row" onClick={async () => toast(await sendTestNotification())}>
          Tester une notification<span className="c-accent">Dans 10 s ›</span>
        </button>
        <button className="set-row" onClick={() => navigate('/profile/settings/errors')}>
          Journal d'erreurs<span className="t2">›</span>
        </button>
        <div className="set-row">
          Version<span className="t2">Overload {__APP_VERSION__}</span>
        </div>
      </div>

      <Sheet open={sheet === 'rest'} title="Repos par défaut" onClose={() => setSheet(null)}>
        <div className="chips wrap mt-8">
          {REST_CHOICES.map((s) => (
            <button
              key={String(s)}
              className={`chip${settings.defaultRestS === s ? ' on' : ''}`}
              onClick={() => {
                set({ defaultRestS: s });
                setSheet(null);
              }}
            >
              {formatRest(s)}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'bar'} title="Poids de la barre" onClose={() => setSheet(null)}>
        <div className="chips wrap mt-8">
          {BAR_CHOICES[units.weight].map((b) => (
            <button
              key={b}
              className={`chip${plateSet.bar === b ? ' on' : ''}`}
              onClick={() => {
                setPlates({ bar: b });
                setSheet(null);
              }}
            >
              {formatPlate(b)} {units.weight}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'plates'} title="Disques disponibles" onClose={() => setSheet(null)}>
        <p>Touche un disque pour l'ajouter ou le retirer. Réglage propre aux charges en {units.weight}.</p>
        <div className="chips wrap mt-12">
          {PLATE_CHOICES[units.weight].map((p) => (
            <button
              key={p}
              className={`chip${plateSet.plates.includes(p) ? ' on' : ''}`}
              aria-pressed={plateSet.plates.includes(p)}
              onClick={() => togglePlate(p)}
            >
              {formatPlate(p)}
            </button>
          ))}
        </div>
      </Sheet>

      <Sheet open={sheet === 'age'} title="Ancienneté en musculation" onClose={() => setSheet(null)}>
        <p>Sert à projeter ta progression sur la fiche exercice.</p>
        <div className="chips wrap mt-12">
          {(Object.keys(TRAINING_AGE_LABELS) as TrainingAgeBucket[]).map((b) => (
            <button
              key={b}
              className={`chip${settings.trainingAge?.bucket === b ? ' on' : ''}`}
              onClick={() => {
                set({ trainingAge: { bucket: b, declaredAt: Date.now() } });
                setSheet(null);
              }}
            >
              {TRAINING_AGE_LABELS[b]}
            </button>
          ))}
          <button
            className={`chip${!settings.trainingAge ? ' on' : ''}`}
            onClick={() => {
              set({ trainingAge: undefined });
              setSheet(null);
            }}
          >
            Non renseignée
          </button>
        </div>
      </Sheet>

      <Sheet
        open={sheet === 'invite'}
        title="Inviter un proche"
        onClose={() => setSheet(null)}
        actions={[
          {
            label: 'Copier le lien',
            kind: 'primary',
            onClick: async () => {
              await navigator.clipboard?.writeText(inviteLink);
              toast('Lien copié');
              setSheet(null);
            },
          },
          { label: 'Régénérer le lien', kind: 'danger', onClick: regenerate },
        ]}
      >
        <p>Ton lien est réutilisable et n'expire pas. Le régénérer rend l'ancien inutilisable.</p>
        <div className="code-big mt-12">{profile ? formatInviteCode(profile.invite_code) : '—'}</div>
      </Sheet>

      <Sheet
        open={sheet === 'export'}
        title="Exporter mes données"
        onClose={() => setSheet(null)}
        actions={[
          {
            label: 'Exporter (JSON + CSV)',
            kind: 'primary',
            onClick: async () => {
              setSheet(null);
              toast('Préparation de l’export…');
              try {
                await exportData();
              } catch (e) {
                toast(e instanceof Error ? e.message : 'Export impossible');
              }
            },
          },
        ]}
      >
        <p>Un fichier JSON complet et un fichier CSV des séances, lisible dans un tableur.</p>
      </Sheet>

      <Sheet
        open={sheet === 'logout'}
        title="Se déconnecter ?"
        onClose={() => setSheet(null)}
        actions={[
          {
            label: checking ? 'Synchronisation…' : 'Se déconnecter',
            kind: 'danger',
            onClick: requestSignOut,
          },
          { label: 'Annuler', onClick: () => setSheet(null) },
        ]}
      >
        <p>
          Les données locales de cet appareil seront effacées. Elles restent sur ton compte une fois
          synchronisées.
        </p>
      </Sheet>

      <Sheet
        open={sheet === 'logout-pending'}
        title="Données non synchronisées"
        onClose={() => setSheet(null)}
        actions={[
          {
            label: checking ? 'Synchronisation…' : 'Réessayer la synchro',
            kind: 'primary',
            onClick: requestSignOut,
          },
          { label: 'Exporter puis se déconnecter', onClick: exportThenSignOut },
          { label: 'Se déconnecter quand même', kind: 'danger', onClick: () => signOut() },
          { label: 'Annuler', kind: 'ghost', onClick: () => setSheet(null) },
        ]}
      >
        <p>
          {pending && describePending(pending)} pas encore sur ton compte (hors ligne ou serveur injoignable).
          Te déconnecter maintenant les effacera définitivement de cet appareil.
        </p>
      </Sheet>

      <DeleteAccountSheet open={sheet === 'delete'} onClose={() => setSheet(null)} />
    </>
  );
}
