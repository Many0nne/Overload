import { Component, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router';
import { logError } from '@/data/errors';
import { isChunkLoadError, reloadOnceForChunk } from './errorRecovery';

type Props = {
  children: ReactNode;
  // Préfixe du journal local (Paramètres › Journal d'erreurs).
  scope: string;
  // Rappelle que la séance est déjà enregistrée.
  workout?: boolean;
  // Change de valeur à la navigation : l'écran d'erreur disparaît quand on quitte la page fautive.
  resetKey?: string;
  // Rendu de remplacement (par défaut : l'écran de secours) ; null pour masquer un élément annexe.
  fallback?: ReactNode;
};
type State = { error: unknown; resetKey?: string; hasError: boolean };

// Composant classe : React n'expose la capture des erreurs de rendu qu'aux classes (getDerivedStateFromError).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, hasError: false, resetKey: this.props.resetKey };

  // Cette méthode permet de basculer sur l'écran d'erreur lorsqu'un descendant lève une exception au rendu.
  static getDerivedStateFromError(error: unknown): Partial<State> {
    return { error, hasError: true };
  }

  // Cette méthode permet d'effacer l'erreur lorsque la clé de réinitialisation change (navigation vers une autre page).
  static getDerivedStateFromProps(props: Props, state: State): Partial<State> | null {
    if (props.resetKey === state.resetKey) return null;
    return { error: null, hasError: false, resetKey: props.resetKey };
  }

  // Cette méthode permet de journaliser l'erreur capturée, ou de recharger une fois si un chunk lazy a disparu.
  componentDidCatch(error: unknown, info: ErrorInfo) {
    if (isChunkLoadError(error) && reloadOnceForChunk()) return;
    void logError(this.props.scope, error);
    if (info.componentStack) console.error(info.componentStack);
  }

  render() {
    if (!this.state.hasError) return this.props.children;
    if (this.props.fallback !== undefined) return this.props.fallback;
    return <CrashScreen workout={this.props.workout} />;
  }
}

// Cette méthode permet d'afficher l'écran de secours (message, recharger, retour à l'accueil) à la place d'un écran blanc.
function CrashScreen(props: { workout?: boolean }) {
  return (
    <section className="crash" role="alert">
      <h1>Cet écran a rencontré un problème</h1>
      <p>L'erreur a été notée dans le journal (Profil › Paramètres › Journal d'erreurs).</p>
      {props.workout && (
        <p>
          <b>Ta séance n'est pas perdue :</b> les séries et la saisie sont déjà enregistrées sur cet appareil.
        </p>
      )}
      <div className="crash-actions">
        <button className="btn btn-primary btn-block" onClick={() => location.reload()}>
          Recharger
        </button>
        <button className="btn btn-soft btn-block" onClick={() => location.assign('/')}>
          Retour à l'accueil
        </button>
      </div>
    </section>
  );
}

// Cette méthode permet de protéger une page : l'erreur reste confinée à la page et s'efface quand on change d'adresse.
export function PageBoundary(props: { children: ReactNode; scope: string; workout?: boolean }) {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary scope={props.scope} workout={props.workout} resetKey={pathname}>
      {props.children}
    </ErrorBoundary>
  );
}
