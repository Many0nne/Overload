import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { signOut } from '@/data/auth';
import { enablePush, sendTestNotification } from '@/data/push';
import { useProfile, useSettings } from '@/data/queries';
import { updateSettings } from '@/data/repositories';
import { useSession } from '@/data/session';
import { refreshStorageUsage, useStorageUsage } from '@/data/storageUsage';
import { supabase } from '@/data/supabase';
import { syncNow } from '@/data/sync/scheduler';
import { TRAINING_AGE_LABELS } from '@/domain/labels';
import { formatStorageUsage, isStorageNearQuota } from '@/domain/quota';
import type { Settings, TrainingAgeBucket } from '@/domain/types';
import { Seg, Sheet, SubHead, Switch, toast } from '@/ui/components';
import { formatInviteCode } from '@/ui/platform';
import { formatRest } from '@/ui/time';
import { DeleteAccountSheet } from './DeleteAccountSheet';
import { exportData } from './exportData';

const REST_CHOICES: (number | null)[] = [null, 30, 45, 60, 75, 90, 120, 150, 180, 240, 300];

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
        <span className={near ? undefined : 't2'} style={near ? { color: 'var(--warm)' } : undefined}>
          {usedBytes === null ? '—' : formatStorageUsage(usedBytes, quotaBytes)}
        </span>
      </div>
      {near && (
        <p className="t2" style={{ padding: '0 16px 12px' }}>
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
  const [sheet, setSheet] = useState<'rest' | 'age' | 'invite' | 'export' | 'delete' | 'logout' | null>(null);

  const set = (patch: Partial<Settings>) => void updateSettings(patch);
  const units = settings.units;
  const inviteLink = profile ? `${location.origin}/i/${profile.invite_code}` : '';

  // Cette méthode permet de remplacer le code d'invitation, ce qui rend l'ancien lien inutilisable (§F7.1).
  const regenerate = async () => {
    const { error } = await supabase.rpc('regenerate_invite');
    if (error) return toast('Impossible hors ligne');
    await syncNow();
    toast('Nouveau lien créé');
    setSheet(null);
  };

  return (
    <>
      <SubHead title="Paramètres" />
      <div className="section" style={{ marginTop: 4 }}>
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
        <button className="set-row" style={{ width: '100%' }} onClick={() => setSheet('rest')}>
          Repos par défaut<span className="t2">{formatRest(settings.defaultRestS)} ›</span>
        </button>
        <div className="set-row">
          <span>
            Notification fin de repos
            <small className="muted" style={{ display: 'block', fontSize: '.75rem' }}>
              son système uniquement ; si muette : Réglages › Notifications › Overload › Sons, mode
              silencieux, Concentration
            </small>
          </span>
          <Switch
            label="Notification fin de repos"
            on={settings.restNotification}
            onChange={async (v) => {
              if (v && (await enablePush()) === 'denied')
                toast('Autorise les notifications dans Réglages iOS');
              set({ restNotification: v });
            }}
          />
        </div>
        <div className="set-row">
          <span>
            Son du minuteur
            <small className="muted" style={{ display: 'block', fontSize: '.75rem' }}>
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
        <div className="section-title">Progression</div>
        <div className="set-row">
          <span>
            Objectifs de progression
            <small className="muted" style={{ display: 'block', fontSize: '.75rem' }}>
              pré-remplissage et tendance projetée
            </small>
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
            <small className="muted" style={{ display: 'block', fontSize: '.75rem' }}>
              proposé après chaque série validée, affine les objectifs
            </small>
          </span>
          <Switch
            label="Saisir l'effort ressenti (RPE)"
            on={settings.rpeEnabled}
            onChange={(v) => set({ rpeEnabled: v })}
          />
        </div>
        <button className="set-row" style={{ width: '100%' }} onClick={() => setSheet('age')}>
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
        <button className="set-row" style={{ width: '100%' }} onClick={() => setSheet('invite')}>
          Lien d'invitation<span style={{ color: 'var(--accent)' }}>Copier · Régénérer</span>
        </button>
        <button className="set-row" style={{ width: '100%' }} onClick={() => setSheet('export')}>
          Exporter mes données<span className="t2">JSON · CSV ›</span>
        </button>
        <button
          className="set-row"
          style={{ width: '100%' }}
          onClick={() => navigate('/profile/settings/import-hevy')}
        >
          Importer depuis HEVY<span className="t2">CSV ›</span>
        </button>
        <button
          className="set-row"
          style={{ width: '100%' }}
          onClick={() => navigate('/profile/settings/claude')}
        >
          Claude<span className="t2">Connecteur ›</span>
        </button>
        <button className="set-row" style={{ width: '100%' }} onClick={() => setSheet('logout')}>
          Se déconnecter
          <span />
        </button>
        <button
          className="set-row"
          style={{ width: '100%', color: 'var(--fail)' }}
          onClick={() => setSheet('delete')}
        >
          Supprimer le compte
          <span />
        </button>
      </div>

      {profile?.is_admin && <AdminSection />}

      <div className="section">
        <div className="section-title">À propos</div>
        <button
          className="set-row"
          style={{ width: '100%' }}
          onClick={async () => toast(await sendTestNotification())}
        >
          Tester une notification<span style={{ color: 'var(--accent)' }}>Dans 10 s ›</span>
        </button>
        <button
          className="set-row"
          style={{ width: '100%' }}
          onClick={() => navigate('/profile/settings/errors')}
        >
          Journal d'erreurs<span className="t2">›</span>
        </button>
        <div className="set-row">
          Version<span className="t2">Overload {__APP_VERSION__}</span>
        </div>
      </div>

      <Sheet open={sheet === 'rest'} title="Repos par défaut" onClose={() => setSheet(null)}>
        <div className="chips wrap" style={{ marginTop: 8 }}>
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

      <Sheet open={sheet === 'age'} title="Ancienneté en musculation" onClose={() => setSheet(null)}>
        <p>Sert à projeter ta progression sur la fiche exercice.</p>
        <div className="chips wrap" style={{ marginTop: 12 }}>
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
        <div className="code-big" style={{ marginTop: 12 }}>
          {profile ? formatInviteCode(profile.invite_code) : '—'}
        </div>
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
          { label: 'Se déconnecter', kind: 'danger', onClick: () => void signOut() },
          { label: 'Annuler', onClick: () => setSheet(null) },
        ]}
      >
        <p>
          Les données locales de cet appareil seront effacées. Elles restent sur ton compte une fois
          synchronisées.
        </p>
      </Sheet>

      <DeleteAccountSheet open={sheet === 'delete'} onClose={() => setSheet(null)} />
    </>
  );
}
