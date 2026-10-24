import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/data/supabase';
import { Sheet, SubHead, Switch, toast } from '@/ui/components';

// Paramètres › Claude (docs/spec-mcp.md §9) : URL du connecteur, mode d'emploi, connexions actives et journal des
// modifications faites par Claude. Tables non synchronisées : écran disponible en ligne uniquement.

type Connection = {
  client_id: string;
  client_name: string | null;
  can_write: boolean;
  created_at: string;
  last_used_at: string | null;
};

type AuditEntry = {
  id: number;
  tool: string;
  sync_table: string;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  at: string;
};

const TOOL_LABELS: Record<string, string> = {
  create_routine: 'Routine créée',
  update_routine: 'Routine modifiée',
  log_workout: 'Séance ajoutée',
  update_workout: 'Séance modifiée',
  delete_workout: 'Séance supprimée',
  add_body_measurement: 'Mesure enregistrée',
  set_exercise_goal: 'Objectif fixé',
  set_exercise_prefs: 'Réglages de progression',
};

const dateTime = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

// Cette méthode permet d'obtenir l'URL du connecteur à coller dans Claude (Edge Function mcp du projet).
export function connectorUrl(): string {
  const base = ((import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '').replace(/\/+$/, '');
  return `${base}/functions/v1/mcp`;
}

// Cette méthode permet de nommer l'élément touché par une écriture de Claude (nom de routine, titre de séance, date).
function auditTarget(e: AuditEntry): string {
  const row = (e.after ?? e.before ?? {}) as {
    doc?: { name?: string; title?: string };
    measured_on?: string;
  };
  return row.doc?.name ?? row.doc?.title ?? row.measured_on ?? '';
}

// Cette méthode permet de copier un texte dans le presse-papiers avec un message de confirmation.
async function copy(text: string, done: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast(done);
  } catch {
    toast('Copie impossible');
  }
}

// Cette méthode permet d'afficher et de gérer le connecteur Claude : URL, mode d'emploi, connexions et journal.
export default function ClaudePage() {
  const url = connectorUrl();
  const [online, setOnline] = useState(navigator.onLine);
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [audit, setAudit] = useState<AuditEntry[] | null>(null);
  const [showAudit, setShowAudit] = useState(false);
  const [toRevoke, setToRevoke] = useState<Connection | null>(null);

  // Cette méthode permet de relire les connexions actives (non déconnectées), les plus récentes d'abord.
  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from('mcp_connections')
      .select('client_id, client_name, can_write, created_at, last_used_at')
      .is('revoked_at', null)
      .order('created_at', { ascending: false });
    if (error) return setConnections([]);
    setConnections(data as Connection[]);
  }, []);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  useEffect(() => {
    if (online) void load();
  }, [online, load]);

  // Cette méthode permet d'autoriser ou d'interdire les modifications pour une connexion.
  const setCanWrite = async (c: Connection, canWrite: boolean) => {
    const { error } = await supabase
      .from('mcp_connections')
      .update({ can_write: canWrite })
      .eq('client_id', c.client_id);
    if (error) return toast('Modification impossible hors ligne');
    setConnections(
      (list) => list?.map((x) => (x.client_id === c.client_id ? { ...x, can_write: canWrite } : x)) ?? null,
    );
  };

  // Cette méthode permet de déconnecter un client : révocation de l'autorisation OAuth (Claude devra redemander le
  // consentement) puis de la connexion (refus dès l'appel suivant, même avec un jeton encore valide).
  const revoke = async (c: Connection) => {
    setToRevoke(null);
    await supabase.auth.oauth.revokeGrant({ clientId: c.client_id }).catch(() => null);
    const { error } = await supabase.rpc('revoke_mcp_connection', { p_client_id: c.client_id });
    if (error) return toast('Déconnexion impossible hors ligne');
    toast('Claude déconnecté');
    void load();
  };

  // Cette méthode permet d'afficher les 30 dernières modifications faites par Claude.
  const openAudit = async () => {
    setShowAudit(true);
    const { data, error } = await supabase
      .from('mcp_audit')
      .select('id, tool, sync_table, before, after, at')
      .order('at', { ascending: false })
      .limit(30);
    setAudit(error ? [] : (data as AuditEntry[]));
  };

  return (
    <>
      <SubHead title="Claude" />
      <div className="section mt-4">
        <div className="section-title">Connecteur</div>
        <p className="t2 px-16 pb-10 fs-14 lh-15">
          Branche ton propre Claude sur Overload pour l'interroger sur tes séances ou lui faire créer des
          routines. Les données lues par Claude sont transmises à Anthropic, dans le cadre de ton compte
          Claude.
        </p>
        <div className="set-row">
          <code data-testid="connector-url" className="fs-13 break-all">
            {url}
          </code>
          <button className="c-accent shrink-0" onClick={() => void copy(url, 'URL copiée')}>
            Copier
          </button>
        </div>
      </div>

      <div className="section">
        <div className="section-title">Mode d'emploi</div>
        <ol className="t2 claude-steps">
          <li>
            claude.ai, Claude Desktop ou mobile :{' '}
            <b>Paramètres › Connecteurs › Ajouter un connecteur personnalisé</b>, puis colle l'URL.
          </li>
          <li>
            Claude Code :{' '}
            <button
              className="c-accent ta-left"
              onClick={() => void copy(`claude mcp add --transport http overload ${url}`, 'Commande copiée')}
            >
              <code>claude mcp add --transport http overload {url}</code>
            </button>
          </li>
          <li>Claude ouvre la page de connexion d'Overload : connecte-toi et autorise.</li>
        </ol>
      </div>

      <div className="section">
        <div className="section-title">Connexions</div>
        {!online && <p className="t2 px-16 pb-12">Disponible en ligne uniquement.</p>}
        {online && connections === null && <p className="t2 px-16 pb-12">Chargement…</p>}
        {online && connections?.length === 0 && <p className="t2 px-16 pb-12">Aucune connexion active.</p>}
        {online &&
          connections?.map((c) => (
            <div key={c.client_id} className="card client-card">
              <div className="flex justify-between items-baseline">
                <b>{c.client_name || 'Client OAuth'}</b>
                <button className="c-fail" onClick={() => setToRevoke(c)}>
                  Déconnecter
                </button>
              </div>
              <p className="t2 fs-13 mt-4">
                Connecté le {dateTime.format(new Date(c.created_at))}
                {c.last_used_at
                  ? ` · utilisé le ${dateTime.format(new Date(c.last_used_at))}`
                  : ' · jamais utilisé'}
              </p>
              <div className="set-row">
                Modifications autorisées
                <Switch
                  on={c.can_write}
                  label="Modifications autorisées"
                  onChange={(v) => void setCanWrite(c, v)}
                />
              </div>
            </div>
          ))}
        {online && (
          <button className="set-row" onClick={() => void openAudit()}>
            Voir les modifications de Claude<span className="t2">›</span>
          </button>
        )}
      </div>

      <Sheet open={showAudit} title="Modifications de Claude" onClose={() => setShowAudit(false)}>
        {audit === null && <p className="t2">Chargement…</p>}
        {audit?.length === 0 && <p className="t2">Aucune modification pour le moment.</p>}
        {audit && audit.length > 0 && (
          <ul className="event-list">
            {audit.map((e) => (
              <li key={e.id}>
                <b>{TOOL_LABELS[e.tool] ?? e.tool}</b>
                {auditTarget(e) && <span> · {auditTarget(e)}</span>}
                <div className="t2 fs-13">{dateTime.format(new Date(e.at))}</div>
              </li>
            ))}
          </ul>
        )}
        <p className="t2 fine mt-10">Les 30 dernières, conservées 90 jours.</p>
      </Sheet>

      <Sheet
        open={toRevoke !== null}
        title="Déconnecter Claude ?"
        onClose={() => setToRevoke(null)}
        actions={[
          {
            label: 'Déconnecter',
            kind: 'danger',
            onClick: () => {
              if (toRevoke) void revoke(toRevoke);
            },
          },
          { label: 'Annuler', onClick: () => setToRevoke(null) },
        ]}
      >
        <p>
          Claude perdra l'accès dès son prochain appel. Pour le rebrancher, il faudra autoriser à nouveau.
        </p>
      </Sheet>
    </>
  );
}
