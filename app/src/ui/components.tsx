import { type ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { create } from 'zustand';
import { BackIcon } from './icons';

// ---------- Toast ----------

type ToastState = { message: string | null; show: (m: string) => void };
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export const useToast = create<ToastState>((set) => ({
  message: null,
  show: (message) => {
    if (toastTimer) clearTimeout(toastTimer);
    set({ message });
    toastTimer = setTimeout(() => set({ message: null }), 2200);
  },
}));

// Cette méthode permet d'afficher un message bref en haut de l'écran.
export const toast = (m: string) => useToast.getState().show(m);

// Cette méthode permet d'afficher le toast courant (monté une fois dans le shell).
export function ToastHost() {
  const message = useToast((s) => s.message);
  return (
    <div className={`toast${message ? ' show' : ''}`} role="status" aria-live="polite">
      {message}
    </div>
  );
}

// ---------- Feuille de dialogue ----------

export type SheetAction = {
  label: string;
  kind?: 'primary' | 'soft' | 'danger' | 'ghost';
  onClick: () => void | Promise<void>;
};

// Cette méthode permet d'afficher une feuille modale en bas d'écran (confirmation, choix), fermée en touchant le fond.
export function Sheet(props: {
  open: boolean;
  title?: string;
  children?: ReactNode;
  actions?: SheetAction[];
  onClose: () => void;
}) {
  useEffect(() => {
    if (!props.open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && props.onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [props.open, props.onClose]);
  if (!props.open) return null;
  return (
    <div className="scrim show" onClick={props.onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        {props.title && <h3>{props.title}</h3>}
        {props.children}
        {props.actions && (
          <div className="acts">
            {props.actions.map((a) => (
              <button
                key={a.label}
                className={`btn btn-block ${a.kind === 'primary' ? 'btn-primary' : a.kind === 'danger' ? 'btn-soft btn-danger' : a.kind === 'ghost' ? 'btn-ghost' : 'btn-soft'}`}
                onClick={() => void a.onClick()}
              >
                {a.label}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ---------- En-têtes ----------

// Cette méthode permet d'afficher l'en-tête d'un écran secondaire : retour, titre centré, action à droite.
export function SubHead(props: { title: string; right?: ReactNode; onBack?: () => void }) {
  const navigate = useNavigate();
  return (
    <div className="head">
      <button className="icon-btn" aria-label="Retour" onClick={props.onBack ?? (() => navigate(-1))}>
        <BackIcon />
      </button>
      <span className="title-sm">{props.title}</span>
      <span style={{ minWidth: 38, display: 'flex', justifyContent: 'flex-end' }}>{props.right}</span>
    </div>
  );
}

// ---------- Contrôles ----------

// Cette méthode permet d'afficher un interrupteur on/off accessible.
export function Switch(props: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={props.on}
      aria-label={props.label}
      className={`switch${props.on ? ' on' : ''}`}
      onClick={() => props.onChange(!props.on)}
    />
  );
}

// Cette méthode permet d'afficher un sélecteur segmenté (choix exclusif parmi quelques options).
export function Seg<T extends string>(props: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  stretch?: boolean;
}) {
  return (
    <div className="seg" style={props.stretch ? { display: 'flex' } : undefined}>
      {props.options.map((o) => (
        <button
          key={o.value}
          className={o.value === props.value ? 'on' : ''}
          style={props.stretch ? { flex: 1 } : undefined}
          onClick={() => props.onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Cette méthode permet d'afficher une rangée de puces filtrantes.
export function Chips<T extends string>(props: {
  value: T | null;
  options: { value: T; label: string }[];
  onChange: (v: T | null) => void;
  allLabel?: string;
  wrap?: boolean;
}) {
  return (
    <div className={`chips${props.wrap ? ' wrap' : ''}`}>
      {props.allLabel && (
        <button className={`chip${props.value === null ? ' on' : ''}`} onClick={() => props.onChange(null)}>
          {props.allLabel}
        </button>
      )}
      {props.options.map((o) => (
        <button
          key={o.value}
          className={`chip${o.value === props.value ? ' on' : ''}`}
          onClick={() => props.onChange(o.value === props.value && props.allLabel ? null : o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
