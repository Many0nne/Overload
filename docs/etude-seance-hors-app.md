# Étude : la séance visible hors de l'app et sur l'écran verrouillé (#32, #33)

Statut : étude, aucune implémentation. Rédigée le 24/10/2026. Les compatibilités évoluent : revérifier les sources avant de coder.

## 1. Question posée

- **#32** : garder la modale de séance (minuteur de repos) visible quand l'utilisateur passe sur une autre app (YouTube, X…).
- **#33** : afficher ce minuteur sur l'écran verrouillé.

Plateformes : PWA installée sur iOS (Safari, appareil cible iOS 27, `SPEC-TECHNIQUE.md` §9) et PWA installée sur Android (Chrome).

## 2. Existant

| Élément | Où | Ce qu'il fait |
|---|---|---|
| Minuteur de repos | `app/src/features/workout-live/restTimer.ts` | État `{ endsAt, totalS, label… }` dans `meta` (Dexie). Affichage = `endsAt − Date.now()`, donc juste au retour au premier plan. Bip Web Audio en fin de repos, app ouverte seulement. |
| Notification de fin de repos | `app/src/data/push.ts` → RPC `schedule_rest_timer` → `pg_cron` (1 s) `dispatch_due_timers()` → Edge Function `supabase/functions/send-push/` | Un Web Push VAPID quand le repos se termine, sur cet appareil uniquement (précision 1 à 2 s, §8.2). Elle s'affiche **déjà sur l'écran verrouillé** sur les deux plateformes. |
| Service worker | `app/src/sw/service-worker.ts` | Affiche le push (`tag: 'rest'`, qui remplace la précédente) ; au toucher, refocalise l'app. |
| Écran allumé | `app/src/ui/wakeLock.ts` | Wake Lock pendant la séance, perdu à chaque mise en arrière-plan. |

Le besoin « être prévenu à la fin du repos, app fermée ou téléphone verrouillé » est donc déjà couvert. Ce qui manque, c'est **voir le temps restant** pendant le repos sans revenir dans l'app.

Contrainte transverse : **une page web en arrière-plan ne tourne pas.** iOS suspend la PWA quelques secondes après sa sortie du premier plan. Chrome Android limite les minuteurs des pages masquées (1 fois par seconde, puis 1 fois par minute après 5 min). Le service worker est arrêté après environ 30 s d'inactivité et n'a pas de minuteur en arrière-plan. Toute piste qui suppose de redessiner un compte à rebours chaque seconde en arrière-plan doit contourner cette contrainte (lecture média, push serveur…).

## 3. Pistes

Légende : ✅ faisable · ⚠️ faisable avec réserves · ❌ impossible.

### 3.1 Picture-in-Picture vidéo (canvas → `captureStream()` → `<video>` → `requestPictureInPicture()`) (#32)

Principe : dessiner le minuteur dans un canvas, le diffuser dans une vidéo et passer cette vidéo en fenêtre flottante.

| | iOS PWA | Android Chrome PWA |
|---|---|---|
| Faisabilité | ❌ | ⚠️ |

- **iOS : bloqué.** Le PiP vidéo fonctionne dans Safari, mais **pas dans une web app installée** : `requestPictureInPicture()` lève `NotSupportedError` ou ne fait rien, alors que `document.pictureInPictureEnabled` vaut `true`. Le bug WebKit 303885 est ouvert depuis décembre 2025, confirmé sur iOS 26.6 en juillet 2026, sans correctif (suivi interne Apple rdar://121964774). Or l'app n'existe sur iOS qu'en mode installé (§9). Les vidéos alimentées par un `MediaStream` (canvas, caméra) ont aussi un historique de bugs PiP sur iOS (bugs WebKit 181663, 206829).
- **Android : possible, mais seulement depuis un geste.** Chrome Android prend en charge le PiP vidéo, y compris avec un `MediaStream` venant de `canvas.captureStream()` (doc Chrome). `requestPictureInPicture()` exige une activation utilisateur. Il faut donc un bouton « Minuteur flottant » touché **avant** de quitter l'app. Le PiP automatique au changement d'app (`enterpictureinpicture` de Media Session) est documenté pour Chrome desktop seulement (Chrome 134+). caniuse marque Chrome Android en « prise en charge partielle ».
- **Coût** : moyen (canvas, flux, rendu du compte à rebours, cycle de vie du PiP, désactivation iOS). Environ 1 à 2 jours, plus des tests manuels Android.
- **Risques** : le dessin du canvas page masquée dépend des limitations de Chrome (à mesurer). Il faut aussi faire tourner une vidéo en continu (batterie), et rien ne dit que la fenêtre restera à jour plusieurs minutes. Bénéfice nul sur l'appareil cible (iPhone).

### 3.2 Document Picture-in-Picture (#32)

Principe : ouvrir une vraie mini-fenêtre HTML toujours au premier plan (`documentPictureInPicture.requestWindow()`).

| | iOS PWA | Android Chrome PWA |
|---|---|---|
| Faisabilité | ❌ | ❌ |

- Disponible sur Chrome **desktop** depuis la version 116 seulement. caniuse indique « non pris en charge » sur Chrome Android (jusqu'à la 152 au moins) et l'API est absente de Safari. MDN : pas Baseline.
- Coût et risques : sans objet.

### 3.3 Media Session API + audio muet en boucle (#33, et un peu #32)

Principe : lire en boucle un `<audio>` muet pour devenir la « lecture en cours » du système, puis renseigner `navigator.mediaSession.metadata` (titre « Repos · Développé couché, série 3 ») et `setPositionState({ duration: totalS, position: écoulé, playbackRate: 1 })`. Le système fait avancer la barre de progression tout seul, sans mise à jour depuis la page.

| | iOS PWA | Android Chrome PWA |
|---|---|---|
| Faisabilité | ⚠️ (fragile) | ⚠️ |

- **API disponible** : `MediaSession` et `setPositionState()` sont pris en charge par Safari iOS 15+ et Chrome (Android compris) depuis la version 81 (caniuse, MDN). Sur Android, la notification média apparaît dans le volet et sur l'écran verrouillé (doc Chrome). Sur iOS, elle apparaît dans le widget « À l'écoute » de l'écran verrouillé et du Centre de contrôle.
- **iOS : fragile en PWA installée.** Plusieurs bugs WebKit, toujours ouverts ou non résolus, concernent la lecture audio d'une web app installée en arrière-plan ou écran verrouillé : arrêt de l'audio (198277, 239602), session média impossible à relancer après une pause en arrière-plan (243258), contrôles de l'écran verrouillé perdus en fin de piste (261858), Web Audio muet au retour (291892). Il faut aussi les contournements connus : `loop = true`, gestionnaires réenregistrés à l'événement `playing`. Seul un vrai élément `<audio>` déclenche « À l'écoute », pas Web Audio.
- **Rédhibitoire sur les deux plateformes : la musique de l'utilisateur.** Un `<audio>` qui joue prend le focus audio : Spotify ou Apple Music **se met en pause** (iOS : session audio de type lecture, non mixable ; Android : perte du focus audio). Le mode qui se mixe avec les autres sons (`navigator.audioSession.type = 'ambient'` sur Safari) ne crée justement pas d'entrée « À l'écoute ». Or on écoute presque toujours de la musique à la salle. La notification média du minuteur **remplacerait** aussi celle du lecteur de musique sur l'écran verrouillé.
- **Coût** : faible à moyen (environ 1 jour), plus beaucoup de tests manuels sur appareil réel à chaque version d'iOS.
- **Risques** : détournement d'API (une « lecture » qui n'en est pas une). Apple ou Google peuvent la neutraliser, par exemple en ignorant les médias muets. Lecture continue, donc batterie. Conflit avec la musique. Contrôles lecture/pause sans sens pour un minuteur.

### 3.4 Notification mise à jour en continu (#32 et #33)

Principe : une notification « Repos : 1:23 » dont le texte change pendant le repos.

| | iOS PWA | Android Chrome PWA |
|---|---|---|
| Faisabilité | ❌ | ⚠️ (coûteux) |

- **Depuis l'appareil : impossible.** Ni la page masquée ni le service worker ne peuvent rafraîchir une notification chaque seconde (voir §2). L'API Web Notifications n'a pas de compte à rebours natif : le chronomètre Android (`setUsesChronometer`) n'est pas exposé au web. Notification Triggers (`showTrigger` / `TimestampTrigger`) aurait permis de programmer des notifications locales, mais elle s'est arrêtée à l'origin trial (Chrome 78–81). Son statut sur web.dev est toujours « Launch : not started », et elle n'existe pas dans Safari.
- **Depuis le serveur (un push toutes les N secondes)** :
  - iOS : chaque push **doit** afficher une notification, sans push silencieux (WebKit, Apple). Pas d'option fiable pour remplacer sans alerter. On aurait une rafale de notifications sonores ou vibrantes : inacceptable.
  - Android : avec `tag: 'rest'`, `renotify: false` et `silent: true`, la notification est remplacée sans alerte. Mais la granularité dépend du réseau et du mode Doze (Android ne livre en temps réel que les push `urgency: high`, et peut les limiter). Une mise à jour toutes les 15 à 30 s multiplie par 10 à 20 les appels à `send-push` pour chaque repos.
- **Coût** : moyen (boucle serveur de planification, nouvelle colonne `next_tick_at`, options de notification). **Risques** : charge serveur (§19, `pg_cron` déjà à 1 s), batterie (radio réveillée), affichage peu fiable et décalé.

### 3.5 Notification « repos en cours » à heure de fin fixe (#33, variante sobre de 3.4)

Principe : au début du repos, afficher **une seule** notification statique, par exemple « Repos jusqu'à 14:32 · Développé couché, série 3 ». Le push de fin de repos existant la **remplace** ensuite grâce au même `tag: 'rest'`.

| | iOS PWA | Android Chrome PWA |
|---|---|---|
| Faisabilité | ✅ (via push serveur) / ⚠️ (en local, à vérifier) | ✅ |

- Deux façons de la déclencher :
  1. **Push serveur immédiat** : `schedule_rest_timer` envoie un premier push tout de suite, puis celui de fin. Ça marche partout où le push marche déjà (critère n° 2 tenu depuis L0). Il faut le réseau, comme aujourd'hui.
  2. **Locale** : `registration.showNotification()` appelé par la page à l'événement `visibilitychange` → `hidden`, si un repos est en cours. Pas de serveur, et ça marche hors ligne. Sur Android c'est sûr. Sur iOS, il faut vérifier sur l'appareil que la page a encore le temps d'afficher la notification avant d'être suspendue.
- C'est une **heure de fin**, pas un compte à rebours. Pour quelqu'un qui regarde l'heure de son téléphone, c'est aussi utile qu'un compte à rebours.
- **Coût** : faible (environ une demi-journée). Il faut une option côté page ou serveur et un texte, plus un réglage pour la désactiver. L'heure de fin doit être formatée dans le fuseau de l'appareil.
- **Risques** : une notification de plus par série, donc du bruit. Ne la montrer que si l'app passe en arrière-plan (variante locale), ou la rendre silencieuse (`silent: true` sur Android ; iOS ignore cette option : son et vibration selon les réglages de l'utilisateur). Si l'utilisateur ajoute ±15 s depuis l'app, il faut la remplacer (même tag). Aucun détournement d'API, batterie négligeable.

### 3.6 Live Activities, Dynamic Island, widgets (#32 et #33)

| | iOS PWA | Android Chrome PWA |
|---|---|---|
| Faisabilité | ❌ | ❌ |

- **iOS** : les Live Activities passent par **ActivityKit**. Il faut une app native avec une extension WidgetKit en SwiftUI (`NSSupportsLiveActivities`), mises à jour par des push ActivityKit via APNs (doc Apple). Aucune API web ne les expose. Le nouveau framework « Now Playing » de la WWDC26 est lui aussi natif. Les widgets d'écran d'accueil ou d'écran verrouillé (WidgetKit) sont également réservés aux apps natives.
- **Android** : les widgets d'écran d'accueil pour PWA (« PWA widgets », `widgets` dans le manifeste) sont un projet Microsoft, livré seulement sur Windows 11. Rien n'est livré dans Chrome Android. Les notifications « en cours » avec chronomètre sont natives.
- **Seule voie** : emballer l'app dans une coque native (Capacitor + plugin Live Activities, ou TWA sur Android). Cela sort du cadre de la PWA (SPEC §1-2 : pas d'App Store, pas de compte développeur payant). Coût élevé : chaîne de build iOS, compte Apple Developer à 99 $/an, publication.

## 4. Synthèse

| Piste | #32 iOS | #32 Android | #33 iOS | #33 Android | Coût | Risque principal |
|---|---|---|---|---|---|---|
| 3.1 PiP vidéo (canvas) | ❌ bug WebKit 303885 | ⚠️ bouton avant de partir | ❌ | ❌ | Moyen | Inutile sur l'appareil cible |
| 3.2 Document PiP | ❌ | ❌ | ❌ | ❌ | – | – |
| 3.3 Media Session + audio muet | ⚠️ | ⚠️ | ⚠️ | ⚠️ | Faible à moyen | **Coupe la musique de l'utilisateur**, détournement, bugs iOS |
| 3.4 Notification mise à jour en continu | ❌ | ⚠️ | ❌ | ⚠️ | Moyen | Bruit iOS, charge serveur, fiabilité |
| 3.5 Notification statique « jusqu'à HH:MM » | (dans le volet) | (dans le volet) | ✅ | ✅ | Faible | Une notification de plus par série |
| 3.6 Live Activities / widgets | ❌ natif | ❌ natif | ❌ natif | ❌ natif | Élevé (app native) | Hors cadre PWA |

## 5. Recommandation

1. **#32 (rester visible au-dessus d'une autre app) : ne rien implémenter.** Sur l'iPhone cible, aucune piste web ne fonctionne en PWA installée : le PiP est cassé en mode standalone et Document PiP n'existe pas. Sur Android, seul un PiP vidéo déclenché par un bouton est possible, pour un coût qui ne profite pas à l'appareil principal. À réévaluer si WebKit corrige le bug 303885. Un test rapide suffit : `webkitSupportsPresentationMode('picture-in-picture')` sur une `<video>` dans l'app installée.
2. **#33 (écran verrouillé) : écarter le contournement Media Session.** Il met en pause la musique de l'utilisateur, ce qui est rédhibitoire à la salle, et il est fragile sur iOS. Écarter aussi la notification mise à jour en continu.
3. **Piste retenue, facultative (P4) : la notification statique « Repos jusqu'à HH:MM » (§3.5).** C'est le seul gain réel, peu coûteux et sans détournement d'API. Comme le push de fin de repos existe déjà, l'écran verrouillé montre l'heure de fin pendant le repos, puis l'alerte de fin. Variante locale (`visibilitychange`) d'abord, à valider sur iPhone ; repli sur un push serveur immédiat si iOS ne laisse pas le temps d'afficher la notification.

## 6. Sources

- WebKit, bug 303885 : PiP inopérant dans les web apps de l'écran d'accueil iOS — https://bugs.webkit.org/show_bug.cgi?id=303885
- WebKit, bugs PiP sur flux `MediaStream` / canvas : https://bugs.webkit.org/show_bug.cgi?id=181663, https://bugs.webkit.org/show_bug.cgi?id=206829
- caniuse, Picture-in-Picture : https://caniuse.com/picture-in-picture
- caniuse, Document Picture-in-Picture : https://caniuse.com/mdn-api_documentpictureinpicture
- Chrome for Developers, PiP vidéo (dont `canvas.captureStream()`) : https://developer.chrome.com/blog/watch-video-using-picture-in-picture/
- Chrome for Developers, PiP automatique (desktop) : https://developer.chrome.com/blog/automatic-picture-in-picture et https://developer.chrome.com/blog/automatic-picture-in-picture-media-playback
- MDN, Media Session : https://developer.mozilla.org/docs/Web/API/MediaSession et `setPositionState()` : https://developer.mozilla.org/docs/Web/API/MediaSession/setPositionState
- caniuse, `MediaSession.setPositionState` : https://caniuse.com/mdn-api_mediasession_setpositionstate
- Chrome for Developers, notifications média (écran verrouillé Android) : https://developer.chrome.com/blog/media-session/
- WebKit, audio des web apps installées en arrière-plan : https://bugs.webkit.org/show_bug.cgi?id=198277, https://bugs.webkit.org/show_bug.cgi?id=239602, https://bugs.webkit.org/show_bug.cgi?id=243258, https://bugs.webkit.org/show_bug.cgi?id=261858, https://bugs.webkit.org/show_bug.cgi?id=291892
- Retour d'expérience Media Session sur PWA iOS : https://dbushell.com/2023/03/20/ios-pwa-media-session-api/
- Chrome for Developers, Notification Triggers (origin trial terminé, pas de lancement) : https://developer.chrome.com/docs/web-platform/notification-triggers
- WebKit, Web Push pour les web apps iOS 16.4 : https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/
- Apple, ActivityKit et push Live Activities : https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications
- Apple, WWDC26 « Meet the Now Playing framework » (natif) : https://developer.apple.com/videos/play/wwdc2026/312/
