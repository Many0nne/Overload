# Spécification fonctionnelle : application personnelle de suivi de musculation

> Inspirée de HEVY. Spécification **non technique** : elle décrit ce que l'application fait et pour qui, pas comment elle est construite.
> Version 0.7, 21/10/2026. Nom de l'application : **Overload** (appelée « l'app » dans ce document).
> Changement 0.4 : retrait de toute la partie sociale. L'app est personnelle, chaque compte est isolé.
> Changement 0.5 : retrait de la vibration du minuteur (non disponible sur iPhone).
> Changement 0.6 : ajout des **objectifs de progression** (§7.10), fondés sur la littérature scientifique (annexe A). Les routines passent d'un nombre de reps fixe à une fourchette. L'équivalence charge ↔ reps des objectifs utilise la formule de Marzagao, et Epley reste la formule du 1RM affiché. L'ancienneté en musculation (facultative) corrige la projection.
> Changement 0.7 : nom de l'app (Q1). Report des précisions de la spec technique : code d'invitation saisissable à l'inscription (§7.1), réinitialisation du mot de passe dans le navigateur (§7.1), type de mesure figé pour le catalogue (§7.2), badge du record « plus de reps sur une séance » sur l'exercice (§7.6). Raisons affichées pour les autres types de mesure (§7.10).

---

## 1. Vision

L'app permet d'enregistrer ses séances de musculation à la salle, téléphone en main, aussi vite qu'avec un carnet papier. Elle permet ensuite de **voir sa progression**.

Elle reprend les principes de HEVY :
- **la séance d'abord** : logger une série doit prendre quelques secondes, avec les valeurs de la dernière fois déjà affichées ;
- **la progression visible** : records, graphiques et historique sont accessibles en deux touches ;
- **la progression guidée** : pour chaque exercice, l'app propose un objectif pour la prochaine séance, calculé à partir des séances passées selon des règles issues de la littérature scientifique. L'objectif est une suggestion, jamais une obligation.

Elle n'a **aucune fonction sociale** : pas d'abonnements, de fil, de likes ni de commentaires. Les données de chaque utilisateur ne sont visibles que par lui.

## 2. Contexte et utilisateurs

| Élément | Décision |
|---|---|
| Public | Usage personnel. Quelques comptes au plus (proches), **totalement indépendants** : aucun compte ne voit les données d'un autre. Pas de lancement public. |
| Appareils | iPhone en priorité. L'app doit aussi fonctionner sur Android et sur ordinateur, sans effort spécifique. |
| Langue | Français. Unités par défaut : kg et cm. |
| Coût | Aucun abonnement payant pour les utilisateurs. L'hébergement doit rester gratuit ou quasi gratuit. |

**Profils types**
- **Le régulier** : 3 à 5 séances par semaine, suit un programme (routines). Il veut logger vite et voir ses records tomber.
- **Le débutant** : il ne connaît pas tous les exercices. Il a besoin d'une bibliothèque claire (muscles ciblés, consignes).

## 3. Plateforme : application web installable (PWA)

L'app est un site web que l'on **ajoute à l'écran d'accueil** de l'iPhone (Safari › Partager › « Sur l'écran d'accueil »). Une fois ajoutée :
- elle a sa propre icône et s'ouvre en plein écran, sans barre Safari ;
- elle peut envoyer des notifications (iOS 16.4 ou plus récent) ;
- elle n'a pas besoin de l'App Store.

**Pourquoi ce choix.** Sans compte développeur Apple payant (99 $/an), une app native installée sur iPhone expire au bout de 7 jours. Une PWA évite ce problème, et une seule version couvre iPhone, Android et ordinateur.

**Limites acceptées et comment l'app les compense**

| Limite iOS | Exigence pour l'app |
|---|---|
| L'app est mise en pause quand on verrouille l'écran ou qu'on change d'app. | Le minuteur de repos et la durée de séance se basent sur l'heure réelle : au retour dans l'app, ils affichent la bonne valeur. Aucune donnée saisie n'est perdue. |
| Pas de son garanti en arrière-plan. | Une **notification** prévient de la fin du temps de repos, même écran verrouillé. Elle nécessite du réseau : hors ligne, seul le son de l'app ouverte prévient (le minuteur reste juste). |
| L'écran se met en veille pendant la séance. | Option « garder l'écran allumé pendant une séance ». |
| L'installation n'est pas guidée par un store. | Une page d'accueil explique en 3 étapes comment ajouter l'app à l'écran d'accueil, puis activer les notifications. |
| Réseau souvent mauvais en salle (sous-sol). | Une séance peut être faite **entièrement hors ligne**. La synchronisation se fait au retour du réseau. |

## 4. Périmètre

### Dans la V1
1. **Comptes** (inscription sur invitation, export, suppression)
2. **Bibliothèque d'exercices** (catalogue et exercices personnalisés)
3. **Routines** (modèles de séance, rangés en dossiers)
4. **Séance en direct** (saisie des séries, minuteur de repos)
5. **Historique** des séances
6. **Statistiques et progression** : records, graphiques, volume, calendrier, mesures corporelles
7. **Notifications** (fin de repos) et **paramètres**
8. **Objectifs de progression** : objectif de la prochaine séance par exercice, projection de tendance sur la fiche exercice

### Versions suivantes (hors V1)
- Circuits (3 exercices ou plus enchaînés ; les supersets de deux exercices sont disponibles, voir §7.4).
- Séries d'échauffement calculées automatiquement.
- Import CSV générique, et import depuis Strong (l'import HEVY est disponible, voir §7.1).
- Intégration Apple Santé / Health Connect.
- Programmes multi-semaines avec périodisation (cycles, semaines de deload planifiées). La V1 ne propose que l'objectif de la séance suivante (§7.10).
- Objectifs pour les types « poids et durée » et « distance et durée » (§7.10).
- Visuels d'exercices créés pour l'app : illustrations **SVG** ou **modèle 3D** du corps, montrant le mouvement et les muscles ciblés. Le choix entre les deux reste à faire.

---

## 5. Glossaire

| Terme | Définition |
|---|---|
| **Exercice** | Mouvement du catalogue (ex. « Développé couché (barre) »), avec son type de mesure, ses muscles ciblés et son équipement. |
| **Série** | Une ligne de saisie dans un exercice, par exemple 80 kg × 8 répétitions. Elle est « validée » quand on la coche. |
| **Type de série** | Normale, Échauffement, Dégressive (drop set) ou Échec. |
| **Séance** | Ensemble des exercices et séries réalisés, avec une date, une durée, un titre et éventuellement une note et une photo. |
| **Routine** | Modèle de séance réutilisable (exercices, nombre de séries, valeurs cibles, temps de repos). Démarrer une routine crée une séance pré-remplie. |
| **Fourchette de reps** | Nombre de répétitions visé par série, sous forme d'un minimum et d'un maximum (ex. 8–12). Une fourchette de 8–8 équivaut à un nombre fixe. |
| **Incrément** | Plus petit saut de charge possible sur un exercice (ex. 2,5 kg à la barre), selon l'équipement. |
| **Objectif** | Valeurs proposées pour chaque série d'un exercice lors de la prochaine séance (ex. 82,5 kg × 10), calculées à partir de l'historique (§7.10). |
| **Séries de travail** | Séries normales et à l'échec d'un exercice. Les échauffements et les séries dégressives en sont exclus. |
| **Dossier** | Regroupement de routines (ex. « PPL », « Full body »). |
| **Volume** | Somme de poids × répétitions des séries validées (hors échauffement). Seule la charge externe compte (voir §7.6). |
| **1RM estimé** | Charge théorique maximale pour une seule répétition, calculée à partir d'une série (formule d'Epley). Les objectifs utilisent une autre formule pour l'équivalence entre deux séries (§7.10). À 1 rep, le 1RM estimé est la charge elle-même. Au-delà de 12 reps, il n'est pas calculé (formule trop imprécise). |
| **Record (PR)** | Meilleure performance personnelle sur un exercice selon un critère donné, **strictement** meilleure que toutes les précédentes (voir §7.6). |

---

## 6. Parcours principaux

### P1. Première utilisation
1. L'utilisateur ouvre dans Safari le lien d'invitation qu'on lui a envoyé.
2. Une page explique comment ajouter l'app à l'écran d'accueil et affiche son **code d'invitation** en gros, avec un bouton « Copier ». Il l'ajoute et l'ouvre depuis l'icône.
3. Le formulaire d'inscription s'ouvre avec le code déjà rempli. Si ce n'est pas le cas (selon la version d'iOS, l'app installée ne reçoit pas toujours le code), il le colle. Il crée son compte (e-mail et mot de passe), choisit un nom affiché (ex. « Paul »), une photo (facultative), ses unités et, s'il le souhaite, son **ancienneté en musculation** (question facultative, utilisée pour la tendance projetée, §7.10).
4. L'app propose d'activer les notifications, puis de créer sa première routine ou de démarrer une séance vide.

### P2. Faire une séance depuis une routine (parcours critique)
1. Depuis l'onglet **Séance**, il touche une routine, puis « Démarrer ».
2. La séance s'ouvre avec les exercices de la routine. Pour chaque série, les **valeurs de la dernière fois** s'affichent en grisé et les champs sont pré-remplis avec l'**objectif** du jour (ex. ↑ 82,5 kg × 10), avec sa raison en une ligne (§7.10).
3. Il fait sa série, ajuste poids et répétitions si besoin, puis coche la série.
4. Le **minuteur de repos** démarre automatiquement. Il peut le réduire ou l'allonger de 15 s, ou le passer. Une notification sonne à la fin.
5. Il peut ajouter, retirer, remplacer ou réordonner un exercice ou une série à tout moment.
6. Il touche « Terminer ». Un écran récapitulatif affiche la durée, le volume, le nombre de séries, les **records battus** et les **objectifs atteints** (ex. « 5/6 exercices »).
7. Il ajoute un titre (proposé par défaut, ex. « Push – mardi »), une note et une photo, puis enregistre.
8. Si la **structure** de la séance diffère de la routine, l'app propose de **mettre à jour la routine** :
   - Ce qui compte comme une différence de structure : exercices ajoutés, retirés ou remplacés, ordre modifié, nombre ou type de séries modifié, temps de repos modifié. De simples écarts de poids ou de répétitions ne déclenchent pas la proposition.
   - La proposition résume les changements. Deux choix : « Mettre à jour la routine » (tout est repris d'un bloc) ou « Garder la routine telle quelle ».
   - En cas de mise à jour, la routine reprend la séance telle qu'elle a été faite : exercices, ordre, séries validées, et les poids réalisés deviennent les nouvelles cibles. Les séries non validées sont ignorées.
   - Les **fourchettes de reps** déjà définies sont conservées. Un exercice ajouté pendant la séance reçoit sa fourchette par défaut (§7.10).

### P3. Séance improvisée
Même parcours que P2, mais en partant d'une séance vide et en ajoutant les exercices depuis la bibliothèque. Un exercice ajouté reprend la structure de séries de la dernière fois qu'il a été fait (nombre et type de séries), sinon une seule série normale. À la fin, une feuille propose d'**enregistrer la séance comme routine** (nom modifiable, « Créer la routine » ou « Non merci »).

### P4. Consulter sa progression
1. Il ouvre un exercice, depuis son profil, son historique ou une séance.
2. Il voit ses records, un graphique d'évolution (1RM estimé, charge max, volume…) sur une période choisie, et l'historique de toutes ses séries sur cet exercice.
3. Sur le graphique du 1RM estimé, une **tendance projetée** en pointillés indique où il en sera dans 4 et 12 semaines à son rythme actuel. S'il a fixé un objectif à long terme (ex. 100 kg × 5), l'app affiche la date estimée pour l'atteindre (§7.10).

---

## 7. Fonctionnalités détaillées

### 7.1 Comptes
- Inscription par e-mail et mot de passe, avec mot de passe oublié.
  - Le lien de réinitialisation reçu par e-mail s'ouvre dans le navigateur (Safari), pas dans l'app installée. On y choisit un nouveau mot de passe, puis une page invite à revenir dans l'app pour se connecter.
- Chaque compte a un **nom affiché** (libre) et une photo facultative.
- **Isolation** : les données d'un compte (séances, routines, exercices personnalisés, mesures, statistiques) ne sont visibles par aucun autre compte. Il n'existe ni recherche d'utilisateurs, ni profil public, ni partage.
- **Administrateur** : le premier compte est créé par le propriétaire de l'app, sans invitation. Ce compte a un rôle d'administrateur qui lui permet de modifier le catalogue d'exercices. Il n'a aucun autre privilège (il ne voit pas les données des autres comptes).
- **Inscription sur invitation uniquement** :
  - Chaque membre a un **lien d'invitation personnel**. Il est réutilisable sans limite et n'expire pas. Le membre peut le régénérer, ce qui rend l'ancien lien inutilisable (utile s'il a circulé trop largement).
  - Inviter quelqu'un ne crée aucun lien entre les deux comptes.
  - Le lien contient un **code d'invitation** (ex. `RX7K-2P9Q-D4MA`). Le formulaire d'inscription a un champ « Code d'invitation » qui accepte le collage, au cas où le code ne passe pas automatiquement de Safari à l'app installée.
- Le **profil** affiche : photo, nom, nombre de séances, et le nombre de séances de la semaine sur le lien Statistiques. Le graphique hebdomadaire (au choix : durée, volume ou nombre de séances) est dans Statistiques › Aperçu (§7.6).
- **Suppression du compte** avec toutes ses données.
- **Export** de ses données : un fichier JSON complet (profil, séances, routines, exercices personnalisés, mesures), et un fichier CSV des séances lisible dans un tableur.
- **Import HEVY** : l'utilisateur choisit les fichiers CSV exportés par HEVY (séances, et mesures en option). Avant l'import, il vérifie la correspondance de chaque exercice HEVY : exercice de la bibliothèque proposé automatiquement, exercice personnalisé à créer, ou exercice ignoré. Une séance déjà importée n'est jamais dupliquée ni modifiée ; une mesure existante n'est complétée que sur ses champs vides.

### 7.2 Bibliothèque d'exercices
- Le catalogue est fourni au départ : environ 150 à 250 exercices courants, en français.
  - **Source** : la base libre [free-exercise-db](https://github.com/yuhonas/free-exercise-db) (800+ exercices, domaine public), dont on retient les exercices courants.
  - Les noms et consignes, en anglais dans la source, sont **traduits et réécrits en français**. Les muscles et équipements sont ramenés aux listes ci-dessous.
  - Les photos fournies par cette base ne sont **pas reprises**. Chaque exercice est illustré par une **carte musculaire** (silhouette de face et de dos, muscle principal en couleur pleine, secondaires en couleur atténuée) : en miniature dans les listes (vue recadrée sur le muscle principal) et en entier sur la fiche de l'exercice.
- Chaque exercice a :
  - un **nom** ;
  - un **équipement** : barre, haltères, machine, poulie, poids du corps, kettlebell, bande élastique, autre ;
  - un **muscle principal** et des **muscles secondaires** : pectoraux, dos, épaules, biceps, triceps, avant-bras, abdos, quadriceps, ischios, fessiers, mollets, trapèzes, lombaires, cardio ;
  - un **type de mesure** :

    | Type | Champs saisis | Exemple |
    |---|---|---|
    | Poids et répétitions | kg, reps | Développé couché |
    | Poids du corps | reps | Pompes |
    | Poids du corps lesté | kg ajoutés, reps | Dips lestés |
    | Poids du corps assisté | kg d'assistance, reps | Tractions assistées |
    | Durée | temps | Gainage |
    | Poids et durée | kg, temps | Farmer walk |
    | Distance et durée | km, temps | Rameur, course |

  - de courtes **consignes** d'exécution (texte).
- **Pas d'illustration en V1** : les muscles ciblés sont affichés sous forme de texte (étiquettes). Les visuels existants ne conviennent pas. Des visuels propres à l'app sont prévus plus tard (voir §4, hors V1).
- **Recherche** par nom (insensible aux accents) et **filtres** par muscle, par équipement et par statut (actifs ou archivés). Les exercices récemment utilisés s'affichent en premier.
- **Exercices personnalisés** : l'utilisateur crée les siens (nom, équipement, muscles, type de mesure). Ils lui sont propres.
  - Nom, équipement, muscles et consignes restent modifiables. Le **type de mesure est figé** dès que l'exercice a été utilisé dans une séance.
  - Supprimer un exercice personnalisé déjà utilisé l'**archive** : il disparaît de la bibliothèque et des routines, mais les séances passées, les records et les graphiques restent visibles.
  - Un exercice personnalisé archivé reste retrouvable : le filtre **Archivés** de la bibliothèque les liste, et le menu de sa fiche propose **Restaurer** pour le remettre dans la bibliothèque et les sélecteurs d'exercice.
- Le catalogue est maintenu par l'administrateur (§7.1). Une modification du catalogue s'applique à tous les utilisateurs, sans toucher à leur historique.
  - Le **type de mesure d'un exercice du catalogue n'est pas modifiable** : l'administrateur ne voit pas les données des autres comptes et ne peut donc pas savoir si l'exercice a été utilisé. Pour changer de type, il crée un nouvel exercice et archive l'ancien. Les séances passées restent lisibles.
- La **fiche exercice** a trois onglets :
  - Résumé : records, graphique avec tendance projetée, objectif de la prochaine séance, et réglages de progression (incrément, fourchette par défaut, objectif à long terme) ;
  - Historique : toutes les séances où l'exercice a été fait ;
  - Consignes.

### 7.3 Routines
- Créer, modifier, dupliquer, supprimer une routine. Elle contient : nom, liste ordonnée d'exercices, et pour chaque exercice des séries cibles (type, poids, reps ou durée), un temps de repos et une note.
- Pour les types de mesure avec des répétitions, la cible de reps est une **fourchette** commune aux séries de travail de l'exercice (ex. 8–12). Elle pilote les objectifs (§7.10). Saisir un seul nombre donne une fourchette fixe (8 → 8–8).
- Les routines sont rangées dans des **dossiers** que l'on peut créer, renommer, réordonner et replier.
- Réordonner les exercices par glisser-déposer.

### 7.4 Séance en direct
**Démarrage**
- Depuis une routine ou en séance vide.
- Une seule séance en cours à la fois. Si l'utilisateur ferme l'app, la séance reste en cours, et un bandeau « Séance en cours – 00:42:13 » permet de la reprendre depuis n'importe quel écran.

**Écran de séance**
- En haut : chronomètre de durée totale, volume cumulé, nombre de séries validées, bouton « Terminer ».
- Pour chaque exercice : son nom (lien vers sa fiche), une note libre, son minuteur de repos, puis le tableau des séries avec les colonnes **Série | Précédent | (champs du type de mesure) | ✓**. Les champs dépendent du type de mesure de l'exercice :

  | Type de mesure | Colonnes de saisie |
  |---|---|
  | Poids et répétitions | kg, Reps |
  | Poids du corps | Reps |
  | Poids du corps lesté | +kg, Reps |
  | Poids du corps assisté | −kg, Reps |
  | Durée | Temps |
  | Poids et durée | kg, Temps |
  | Distance et durée | km, Temps |

  Le temps se saisit en min:s (h:min:s pour les longues durées). « Précédent » s'affiche dans le même format que les colonnes.
  - « Précédent » affiche la série équivalente de la dernière fois. La toucher recopie ses valeurs.
    - **La dernière fois** : la dernière séance faite depuis la même routine et contenant cet exercice. À défaut (séance vide, ou exercice jamais fait dans cette routine) : la dernière séance contenant cet exercice, quelle qu'elle soit.
    - **Série équivalente** : correspondance **par type de série**. La 1ʳᵉ série normale d'aujourd'hui affiche la 1ʳᵉ série normale de la dernière fois, le 1ᵉʳ échauffement le 1ᵉʳ échauffement, etc. Ajouter un échauffement ne décale donc pas les autres lignes.
    - S'il n'y a pas de série équivalente (plus de séries qu'avant, ou type absent la dernière fois), la ligne affiche « — ».
  - Les champs sont pré-remplis, par ordre de priorité, avec l'**objectif** (§7.10), sinon les valeurs de la routine, sinon les valeurs précédentes.
  - Quand un objectif existe, une ligne sous le nom de l'exercice le résume avec sa raison (ex. « ↑ 82,5 kg × 10 : 12 reps atteintes sur toutes les séries »). Les champs modifiés par l'utilisateur ne sont jamais écrasés.
  - Si un champ obligatoire est vide au moment de cocher : la coche le remplit avec la valeur « Précédent » si elle existe, sinon elle est refusée et le champ vide est mis en évidence.
  - **Superset** (#77) : le menu d'un exercice permet de le relier à l'exercice suivant (deux exercices exactement, aussi dans l'éditeur de routine). Les deux s'enchaînent sans repos entre eux : valider une série du premier ne lance pas le minuteur tant que le second a une série au même rang à faire ; le repos du second se déclenche à la fin du tour. Le groupe est défait si un des exercices est supprimé ou séparé par un déplacement.
  - Le numéro de série peut être remplacé par un type : **É** (échauffement), **D** (dégressive), **X** (échec).
  - Ajouter une série recopie les valeurs de la série précédente. Une série se supprime par glissement.
  - **Effort ressenti (RPE)**, facultatif et activable dans les paramètres (désactivé par défaut) : une colonne « RPE » s'ajoute avant la coche. Sa case reste inactive tant que la série n'est pas validée, puis affiche une jauge ; la toucher ouvre une feuille en bas d'écran : rappel de la série (« Série 1 : 60 kg × 8 »), grand chiffre, libellé (« Effort important ») et équivalent en reps en réserve (« J'aurais pu faire 2 reps de plus »), piste 6 · 6,5 · 7 … 10 à toucher ou glisser. Le choix est enregistré dès qu'on lâche la piste ; « Terminé » ou le fond referment la feuille, « Effacer le RPE » retire la valeur. Valider une série n'ouvre pas la feuille (le minuteur de repos reste visible) ; l'ignorer ne bloque rien. La case affiche ensuite la valeur (« 8,5 »). La colonne reste visible si une série de l'exercice porte déjà un RPE, même saisie désactivée. Décocher une série efface son RPE.
- Actions par exercice : remplacer, réordonner, supprimer, modifier le temps de repos.
- Un **record battu** pendant la séance est signalé immédiatement (pastille 🏆 sur le numéro de la série ; une série qui atteint l'objectif du jour porte de même une pastille 🎯. Les pastilles ne changent pas la hauteur de la ligne).

**Minuteur de repos**
- Il démarre automatiquement à la validation d'une série, avec le temps de repos de l'exercice. La valeur par défaut est réglable dans les paramètres (90 s par défaut), et le minuteur peut être désactivé (« Off »).
- Contrôles : −15 s, +15 s, Passer.
- À la fin : notification (si le téléphone a du réseau), ainsi qu'un son si l'app est ouverte.
  - Chaque fin de repos produit une nouvelle notification (les précédentes sont retirées du centre de notifications) et doit donc sonner à chaque fois, pas seulement au 1ᵉʳ repos.
  - **Limites iOS** (notifications web d'une app installée sur l'écran d'accueil) : pas de son personnalisé, seulement le son système par défaut (ou rien). Le son dépend de *Réglages → Notifications → Overload → Sons* ; un bug iOS fait parfois disparaître cette option, ce qui rend les notifications muettes : supprimer puis réajouter l'app à l'écran d'accueil la rétablit. Le mode silencieux, Ne pas déranger et les Concentrations coupent aussi le son. Le texte d'aide du réglage « Notification fin de repos » le rappelle.
  - La mention « from Overload » (ou « de Overload ») sous la notification est ajoutée par iOS aux notifications web ; ni l'app ni le serveur ne l'envoient, elle ne peut pas être retirée.
- Le minuteur reste juste même si l'app a été mise en arrière-plan.

**Haltères et kettlebells : poids d'une pièce**
- Convention unique : on saisit le poids **d'un haltère** (ou d'une kettlebell), même quand on en tient deux. 2 haltères de 15 kg se saisissent « 15 ».
- L'en-tête de la colonne de charge le rappelle (« kg / haltère », « kg / kettlebell »), ainsi que le champ de charge cible de l'éditeur de routine et de l'objectif long terme.
- Le volume compte la charge saisie telle quelle (pas de ×2, §7.6). L'import HEVY, qui suit la même convention, n'est pas converti ; l'historique déjà saisi n'est pas modifié.

**Calculateur de disques** (exercices à la barre)
- Pendant la saisie du poids d'une série, un bandeau sous la série dessine la barre chargée et indique les disques de chaque côté (« Par côté : 25 + 5 + 1,25 · barre 20 kg »). Il suit chaque chiffre tapé et disparaît à la sortie du champ.
- Le calcul vise la charge exacte avec le moins de disques possible ; une charge inatteignable affiche le reste (« 2 kg impossibles »), une charge sous la barre est signalée.
- Le menu de l'exercice (« Calculer les disques ») et sa fiche ouvrent le même calculateur, sur une charge libre réglable (− / + d'une paire du plus petit disque).
- Disques aux couleurs de compétition (rouge 25, bleu 20, jaune 15, vert 10, blanc 5).
- Plusieurs barres : olympique, femme, EZ, trap bar. La barre d'un exercice est devinée (« EZ » ou « trap bar » dans le nom, ou son identifiant source au catalogue), sinon c'est la barre par défaut. Des puces dans le calculateur changent de barre ; le choix est mémorisé pour l'exercice et synchronisé. Le calculateur s'ouvre aussi pour les exercices à la trap bar, même classés « autre ».

**Fin de séance**
- Terminer avec des séries non validées : l'app demande « Ignorer les séries non validées ? ». Une séance sans aucune série validée ne peut pas être enregistrée (proposer « Abandonner »).
- L'écran de récapitulatif contient :
  - les chiffres de la séance : durée, volume, séries, records, objectifs atteints ;
  - les champs titre, note, photo, date et heure de début et **durée** (tous modifiables).
- **Séance oubliée** : si la durée dépasse 4 h au moment de terminer, l'app propose de la corriger avant d'enregistrer.
- **Abandonner** une séance demande une confirmation et ne conserve rien.

**Saisie a posteriori**
- Il est possible de créer une séance passée, sans minuteur. L'utilisateur saisit la date, l'heure de début et la **durée**.
- Elle peut être créée même si une séance est en cours.

### 7.5 Historique
- Liste chronologique de ses séances (la plus récente en premier, chargée par pages au fil du défilement). Chaque séance affiche :
  - la date, le titre, la note et la photo ;
  - la durée, le volume, le nombre de séries et le nombre de records ;
  - les 3 premiers exercices avec leur nombre de séries.
- Détail d'une séance : toutes les séries, les records battus, la note et la photo.
- **Modifier** une séance passée (séries, titre, date…). Les records et statistiques sont recalculés :
  - un record est toujours évalué par rapport aux séances **antérieures** à sa date ;
  - modifier, déplacer ou supprimer une séance recalcule donc les badges 🏆 de cette séance **et de toutes les suivantes** sur les exercices concernés. Un record peut apparaître ou disparaître sur une séance plus récente ;
  - ces recalculs ne déclenchent aucune notification.
- **Supprimer** une séance, après confirmation.
- Enregistrer une séance passée comme routine : elle reprend la structure de la séance (exercices, ordre, séries validées, temps de repos) et ses poids et répétitions comme cibles.

### 7.6 Statistiques et progression
**Volume selon le type de mesure**
- Seule la **charge externe** entre dans le volume. Le poids de corps n'est jamais compté : cela évite de dépendre d'une pesée à jour.

  | Type de mesure | Volume d'une série |
  |---|---|
  | Poids et répétitions | kg × reps (aux haltères : poids d'un haltère × reps, §7.4) |
  | Poids du corps lesté | kg ajoutés × reps |
  | Poids du corps, assisté, durée, poids et durée, distance et durée | 0 (non compté) |

- Pour que les séances sans charge restent valorisées, le récapitulatif et l'historique affichent aussi le **nombre total de séries**.

**Records par exercice**
- Les séries d'échauffement ne comptent jamais pour les records. Les séries dégressives et à l'échec comptent, pour les records comme pour le volume.
- Un record doit être **strictement** meilleur : égaler son record ne compte pas.
- **Premier essai** : tant qu'il n'existe aucune séance antérieure sur un exercice, aucun badge 🏆 n'est affiché pour cet exercice. Les meilleures valeurs de cette séance servent de point de départ.
- **Plusieurs records dans une séance** : chaque série qui dépasse le meilleur résultat obtenu avant elle (séances antérieures et séries précédentes de la même séance) reçoit son badge. Le compteur « records » du récapitulatif et de l'historique compte au plus un record par exercice et par critère.
- « Meilleur poids à N reps » signifie **à au moins N reps** : 100 kg × 6 compte pour 1, 3 et 5 reps.
- Le record « plus de reps sur une séance » (poids du corps) porte sur l'exercice entier, pas sur une série : son badge 🏆 s'affiche à côté du nom de l'exercice.
- Records suivis selon le type de mesure :

  | Type de mesure | Records |
  |---|---|
  | Poids et répétitions | Charge max ; meilleur 1RM estimé ; meilleure série en volume (kg × reps) ; meilleur poids à 1, 3, 5, 8, 10 et 12 reps |
  | Poids du corps | Plus de reps en une série ; plus de reps sur une séance |
  | Poids du corps lesté | Charge ajoutée max ; meilleure série en volume ; plus de reps en une série |
  | Poids du corps assisté | Plus faible assistance (à au moins 1 rep) ; plus de reps en une série |
  | Durée | Plus longue durée |
  | Poids et durée | Charge max ; plus longue durée |
  | Distance et durée | Plus grande distance ; plus longue durée ; meilleure allure (min/km, ou min/mi selon les unités) sur une série |

**Graphiques par exercice**
- Courbes au choix, selon le type de mesure. Exemples pour poids et répétitions : 1RM estimé, charge max, volume de séance, meilleure série, total de répétitions. Pour les autres types, une courbe par record ci-dessus, plus le total de reps, de durée ou de distance par séance.
- Périodes : 1 mois, 3 mois, 1 an, tout.

**Statistiques globales** (onglet Profil › Statistiques)
- Quatre vues dans un sélecteur segmenté : **Aperçu**, **Muscles**, **Progrès**, **Séances**. La vue ouverte et la période sont gardées dans l'adresse de la page, pour revenir au même endroit depuis une fiche exercice.
- **Période** commune aux vues Muscles, Progrès et Séances : 30 jours (par défaut), 3 mois, 1 an ou tout. Elle n'est pas mémorisée d'une visite à l'autre. Un écart compare à la fenêtre précédente de même durée ; sans séance dans cette fenêtre, il affiche « pas de période précédente ».
- **Aperçu** :
  - totaux depuis le début : séances, heures, volume, séries, reps, exercices différents ;
  - 30 derniers jours comparés aux 30 précédents : séances, durée moyenne, volume, records ;
  - séances, durée et volume par semaine (histogramme sur 12 semaines, mesure au choix mémorisée) ;
  - **calendrier** des jours d'entraînement et série de semaines consécutives avec au moins une séance.
- **Muscles** :
  - carte musculaire colorée en 4 niveaux selon les séries de la période (niveau relatif au muscle le plus travaillé) ;
  - séries ou volume par **groupe musculaire** : un muscle principal compte pour 1 série et 100 % du volume, un muscle secondaire pour 0,5 et 50 % ;
  - équilibres en séries : pousser (pectoraux, épaules, triceps) / tirer (dos, biceps, trapèzes, avant-bras), et haut / bas du corps (quadriceps, ischios, fessiers, mollets). Abdos, lombaires et cardio n'y entrent pas.
- **Progrès** :
  - records battus par mois (6 derniers mois ; 12 pour « 1 an » ; depuis le premier record, 24 au plus, pour « tout »), au plus un par séance, exercice et critère ;
  - taux d'objectifs de séance atteints sur la période (§7.10), au global et par raison de l'objectif ;
  - objectifs à long terme : 1RM estimé de la dernière semaine entraînée rapporté au 1RM estimé visé, et date estimée. Chaque ligne ouvre la fiche de l'exercice ;
  - records récents (ci-dessous).
- **Séances** :
  - durée moyenne et RPE moyen (séries notées, hors échauffement), avec l'écart à la période précédente ;
  - répartition des séries validées par type (normale, échauffement, dégressive, échec) ;
  - zones de répétitions des séries de travail chargées (poids et reps, lesté) : 1-5, 6-12, 13 et plus. Affichées à partir de 3 séances sur la période ;
  - routines les plus utilisées (5 au plus, séances libres regroupées).
- **Données absentes** : un bloc dont la fonction est désactivée (RPE, objectifs de progression) et qui n'a aucune donnée est masqué, avec une ligne qui renvoie aux paramètres. Sinon, un état vide explique ce qui manque (« Encore 2 séances »).
- Volumes cumulés : en kg (ou lb) en dessous de 10 000, puis en tonnes (« 94,6 t ») ou milliers de lb (« 208,6 k lb »).
- Le profil n'affiche plus l'histogramme : son lien Statistiques indique les séances de la semaine en cours.
- Règles de date communes : une séance appartient au jour de son **début** (même si elle se termine après minuit), dans le fuseau horaire de l'appareil. La semaine va du lundi au dimanche. La semaine en cours ne casse pas la série de semaines tant qu'elle n'est pas terminée.
- Liste des records battus récemment, du plus récent au plus ancien (10 lignes au plus, une par exercice et par séance), groupée sous un en-tête de jour : « Aujourd'hui », « Hier » ou « Il y a N j » (jusqu'à 6 jours) suivi de la date, puis la date seule (avec l'année si ce n'est pas l'année en cours).
  - Chaque ligne donne le nom de l'exercice (2 lignes au plus), le critère principal battu en clair (premier dans l'ordre de la table des records), sa valeur et le **gain** sur l'ancien record, à droite. La meilleure série en volume s'affiche comme une série (« 100 kg × 5 ») et son gain en volume (« +20 kg vol. »).
  - Le gain se mesure contre le meilleur résultat **d'avant la séance**, même si le critère a été battu plusieurs fois dans la séance. Pour l'assistance et l'allure, il est négatif (« −0:08 /km »). Sans ancien résultat sur ce critère (ex. premier passage à 12 reps), la ligne affiche « 🏆 nouveau ».
  - Les autres critères battus dans la même séance sont affichés en pastilles, avec leur valeur (« 1RM estimé 115,5 kg », « à 5 reps 100 kg »). Les paliers « meilleur poids à N reps » qui se suivent et sont battus avec la même charge forment une seule pastille (« à 1, 3 et 5 reps 65 kg »).
  - Valeurs et gains dans les unités de l'utilisateur. Toute la ligne ouvre la fiche de l'exercice.

**Mesures corporelles**
- Saisie datée de : poids, % de masse grasse, et tours (cou, épaules, poitrine, bras G/D, taille, hanches, cuisse G/D, mollet G/D).
- Graphique d'évolution pour chaque mesure.

### 7.7 Notifications
- Seule notification de l'app : la **fin du temps de repos** (« Repos terminé – Développé couché, série 3 »).
- Désactivable dans les paramètres.

### 7.8 Paramètres
- Unités : kg ou lb, cm ou in, km ou mi.
  - L'utilisateur voit **tout** dans ses unités (valeurs converties).
  - Une valeur s'affiche exactement comme elle a été saisie dans l'unité de saisie. Une fois convertie, elle est arrondie au dixième, sans zéro inutile (100 kg → 220,5 lb ; 225 lb → 102,1 kg).
  - Changer d'unité ne modifie pas l'historique, seulement son affichage.
  - Les records se comparent sur les valeurs exactes : un arrondi de conversion ne crée jamais de faux record.
  - Les champs acceptent les décimales (virgule ou point).
- Temps de repos par défaut, son du minuteur, garder l'écran allumé pendant une séance.
- Thème clair, sombre ou automatique (sombre par défaut, usage en salle).
- Notification de fin de repos : activée ou non.
- Objectifs de progression : activés ou non (activés par défaut). Désactivés, les champs se pré-remplissent comme sans objectif et la tendance projetée est masquée.
- Saisir l'effort ressenti (RPE) : désactivé par défaut (§7.4). Un RPE déjà enregistré (saisi ou importé de HEVY) reste affiché et pris en compte par les objectifs même si la saisie est désactivée.
- Par exercice (fiche de l'exercice, #124) : « Noter l'effort (RPE) » et « Objectif de progression », actifs par défaut (sauf l'« Échauffement » du catalogue, où les deux sont désactivés). RPE désactivé : ni colonne ni bouton RPE en séance, même avec la saisie globale active ou des RPE déjà enregistrés ; ces RPE sont masqués (pas effacés) dans l'historique et les statistiques, et ignorés par les objectifs. Objectif désactivé : ni objectif calculé, affiché ou pré-rempli en séance, ni prochain objectif ou objectif à long terme sur la fiche ; records, volume et historique inchangés.
- Disques : barres (poids de chacune, par défaut olympique 20 kg / 45 lb, femme 15 / 35, EZ 10 / 25, trap bar 25 / 55, et barre par défaut) et disques disponibles, réglés séparément pour le kg et le lb (§7.4).
- Ancienneté en musculation, modifiable à tout moment : « Je débute », « Moins de 6 mois », « 6 mois à 1 an », « 1 à 2 ans », « 2 à 5 ans », « Plus de 5 ans », ou « Non renseignée ».
- Compte : e-mail, mot de passe, lien d'invitation (copier, régénérer), export des données, import HEVY, suppression du compte, déconnexion.

### 7.9 Plusieurs appareils et hors ligne
**Séance en cours**
- Une séance en cours appartient à l'appareil sur lequel elle a été démarrée. C'est le seul où elle se modifie.
- Sur un autre appareil du même compte, un bandeau indique « Séance en cours sur un autre appareil ». Il propose « Reprendre ici », avec un avertissement : les saisies pas encore synchronisées sur l'autre appareil seront perdues. Après la reprise, l'autre appareil affiche la séance en lecture seule et ne peut plus la modifier.
- On ne peut pas démarrer une deuxième séance tant qu'une séance est en cours sur le compte.
- Exception hors ligne : un appareil hors ligne ne peut pas savoir qu'une séance est en cours ailleurs. Si deux séances ont été démarrées ainsi, elles sont toutes deux conservées et enregistrées comme deux séances distinctes. Rien n'est perdu.

**Modifications hors ligne**
- Toute action faite hors ligne est conservée et envoyée au retour du réseau : séance, routine, exercice personnalisé, mesure, paramètre.
- Si un même élément (une séance passée, une routine) a été modifié sur deux appareils avant synchronisation, **la modification la plus récente l'emporte** pour l'élément entier, sans fusion. « Plus récente » s'entend selon l'heure de la modification sur l'appareil, pas l'heure de synchronisation. Ce cas est rare avec un seul utilisateur par compte.
- Les éléments en attente sont signalés par un indicateur discret (§9).

### 7.10 Objectifs de progression
**Principes**
- L'objectif est **proposé**, jamais imposé : il pré-remplit les champs et l'utilisateur reste libre de les modifier. Les recommandations actuelles (ACSM 2026) ne rendent la progression nécessaire que pour continuer à progresser à long terme.
- Il est **calculé au démarrage de la séance** à partir de l'historique, sur l'appareil, donc aussi hors ligne. Il est ensuite **figé dans la séance**, ce qui permet de compter les objectifs atteints et de savoir ce qui était visé la dernière fois. Modifier ou supprimer une séance passée change les objectifs des séances à venir, mais pas ceux des séances déjà faites, et ne déclenche aucune notification.
- Il est **expliqué** : chaque objectif affiche sa raison en une ligne (voir le tableau des cas ci-dessous).
- **Référence** : l'objectif se calcule à partir de la séance de référence, qui est « la dernière fois » au sens du §7.4. On considère les séries de travail de l'exercice (normales et à l'échec) et on les fait correspondre par rang, comme pour « Précédent ». Si la séance prévoit plus de séries que la référence, les séries en plus reprennent l'objectif de la dernière série de référence.
- **Premier essai** : sans séance antérieure sur l'exercice, il n'y a pas d'objectif (même règle que pour les records). Les champs se pré-remplissent avec la routine.
- Les **échauffements** et les **séries dégressives** n'ont pas d'objectif de progression : ils se pré-remplissent avec la valeur précédente.
- Une **série à l'échec** (X) compte comme une série de travail. Les reps réalisées sont considérées comme la limite réelle, sans hypothèse de reps en réserve.
- **Effort ressenti** : quand la dernière série de travail de la référence porte un RPE, il module la double progression (voir « Effort ressenti » ci-dessous). Sans RPE, les règles s'appliquent telles quelles.

**Réglages par exercice** (fiche exercice › Résumé, propres à chaque utilisateur)
- **Incrément**. Valeurs par défaut selon l'équipement, modifiables :

  | Équipement | kg | lb |
  |---|---|---|
  | Barre | 2,5 | 5 |
  | Haltères, kettlebell | 2 | 5 |
  | Machine, poulie | 5 | 10 |
  | Poids du corps lesté ou assisté, autre | 2,5 | 5 |

  Ces valeurs se situent dans les fourchettes de la NSCA (1 à 2 kg pour le haut du corps, 2 à 4 kg pour le bas du corps) et respectent la règle de l'ACSM (+2 à 10 %) pour la plupart des charges.
- **Fourchette par défaut** : elle s'utilise quand l'exercice n'a pas de fourchette dans la routine, par exemple en séance vide. À défaut, c'est la fourchette de la dernière routine qui contient l'exercice, sinon **8–12**, la plage recommandée par l'ACSM pour les débutants.

**Poids et répétitions : double progression**

On note W la charge de chaque série de travail de la séance de référence, r les reps réalisées, [min, max] la fourchette et i l'incrément. La reprise et le plateau s'évaluent **par exercice** et s'appliquent à toutes les séries de travail. Sinon, le cas se choisit **série par série**, d'après la série de même rang de la référence : une série nettement plus lourde que la précédente progresse depuis sa propre performance, et non depuis la série plus légère (ex. 50 kg × 10 puis 60 kg × 8 donne 50 kg × 11 puis 60 kg × 9).

| Cas (évalués dans cet ordre) | Objectif de chaque série | Raison affichée |
|---|---|---|
| **Reprise** : plus de 4 semaines sans faire l'exercice | Charge de référence réduite de 5 % entre 4 et 8 semaines d'arrêt, 10 % entre 8 et 12, 15 % entre 12 et 16, 20 % au-delà, puis arrondie à l'incrément inférieur. Reps de référence. | « ↓ Reprise après 6 semaines » |
| **Plateau** : 2 séances consécutives avec au moins une série sous *min* à la même charge, ou 3 séances consécutives à la même charge où le total de reps des 2 dernières n'a pas dépassé celui de la première | Charge −10 %, arrondie à l'incrément inférieur. Reps = *min*. | « ↓ Plateau : on repart un peu plus léger » |
| **Montée de charge** : la série a atteint *max* | Charge W + i. Reps r′ = le nombre de reps à W + i **équivalent** à W × *max* selon la formule de Marzagao (voir ci-dessous), arrondi à l'inférieur et borné entre *min* et *max*. Si *max* > 30, hors du domaine de la formule, r′ = *min*. | « ↑ 12 reps atteintes sur toutes les séries » |
| **Échec isolé** : la série est sous *min* (première fois à cette charge) | Mêmes charge et reps visées que la dernière fois. | « = On consolide » |
| **Progression en reps** : tous les autres cas | Même charge. Reps = min(*max*, r + 1), et au moins *min*. | « ↑ +1 rep par série » |

Si toutes les séries tombent dans le même cas, sa raison s'affiche. Sinon, la raison est « ↑ Objectif ajusté série par série ». Les séries prévues en plus reprennent le cas et l'objectif de la dernière série de référence. Les séries de référence en trop sont ignorées.

**Équivalence charge ↔ reps (formule de Marzagao 2026)**
- La formule donne la charge maximale équivalente : M(w, r) = w × (1 + (r − 1)^0,85 / k(w)), avec k(w) = max(0,5 ; −2,55 + 4,58 × ln w) et w **en kg**. Les charges en lb sont converties avant le calcul.
- On l'inverse pour trouver les reps à la nouvelle charge w′ : r′ = 1 + (k(w′) × (M(w, max) / w′ − 1))^(1/0,85).
- Pourquoi elle et pas Epley :
  - Marzagao a optimisé sa formule pour que deux séries d'une même personne (par exemple 80 kg × 8 et 90 kg × 5) donnent le même résultat. C'est exactement ce que demande le passage d'une charge à l'autre.
  - Sur 303 494 séries, elle réduit l'incohérence de 17 à 22 % par rapport à Epley, Brzycki, Wathen et Mayhew.
  - Elle rend compte d'un fait que les formules classiques ignorent : sur les charges légères, comme les exercices d'isolation, chaque rep pèse plus lourd.
- **Le 1RM estimé affiché reste celui d'Epley** (records, graphiques, projection, objectif à long terme). La formule de Marzagao n'a pas été validée sur de vrais 1RM, et sur les charges légères elle donne des valeurs 10 à 40 % plus hautes que la méta-analyse de Nuzzo 2024. On l'utilise donc seulement pour comparer deux séries entre elles, jamais comme valeur absolue.

Exemples :
- Fourchette 8–12, référence 80 kg × 12 / 12 / 12, incrément 2,5 kg. On a M = 115,1 et r′ = 10,8, d'où l'objectif **82,5 kg × 10** sur les 3 séries.
- Même fourchette, référence 80 kg × 12 / 11 / 9. Objectif : **80 kg × 12 / 12 / 10**.
- Fourchette 4–6, référence 100 kg × 6 / 6 / 6. On a r′ = 5,2, d'où l'objectif **102,5 kg × 5**.
- Fourchette 8–12, élévations latérales à 10 kg × 12 / 12 / 12, incrément 2 kg. On a r′ = 8,6, d'où l'objectif **12 kg × 8**. Epley aurait donné 5 reps, ce qui est irréaliste pour +2 kg.

**Effort ressenti (RPE)**

Seul compte le RPE de la **dernière série de travail** de la référence (la plus fatiguée) ; il module le cas de chaque série. Reprise et plateau restent prioritaires et ignorent le RPE ; une série sous *min* reste consolidée.

| Cas | Effet | Raison affichée |
|---|---|---|
| Série en montée de charge, RPE ≤ 7 | Charge W + 2i (assisté : assistance −2i), reps r′ calculées pour cette charge. | « ↑ 12 reps atteintes sur toutes les séries, effort facile (RPE 7) » |
| Série en montée de charge, RPE 10 | Mêmes charge et reps, une seule fois : si la série de même rang avait déjà atteint *max* à la séance précédente à la même charge, elle monte normalement. | « = Maximum atteint à RPE 10 : on le confirme » |
| Série en progression de reps, RPE ≤ 7 | Reps = min(*max*, r + 2). Même règle en poids du corps. | « ↑ +2 reps par série, effort facile (RPE 6,5) » |

Ces seuils (constantes `RPE_*` de `progressionConfig.ts`) sont des heuristiques, comme ceux de la Q8 : l'estimation des reps restantes se trompe d'environ 1 rep (Halperin et al. 2021), d'où des effets limités aux extrêmes de l'échelle.

Pourquoi la double progression : faire progresser les reps à charge fixe donne des gains comparables à faire progresser la charge (Plotkin et al. 2022). Elle évite aussi les sauts de charge trop grands sur les petits poids. Le déclencheur est la fourchette atteinte sur toutes les séries, comme dans la règle du « 2-for-2 » de la NSCA. Il faut deux échecs avant de baisser, parce qu'une performance varie naturellement de 2 à 4 % d'une séance à l'autre.

**Autres types de mesure**

| Type | Règle |
|---|---|
| Poids du corps lesté | Double progression comme ci-dessus, sur les kg ajoutés. Après une montée de charge, reps = *min* (le poids de corps n'est pas connu, donc la formule d'équivalence ne s'applique pas). Raisons identiques au tableau ci-dessus. |
| Poids du corps assisté | Double progression inversée : quand une série atteint *max*, son assistance baisse d'un incrément et les reps reviennent à *min* (« ↑ Assistance −2,5 kg »). Un plateau remonte l'assistance d'un incrément (« ↓ Plateau : un peu plus d'assistance »). |
| Poids du corps | Reps de chaque série + 1, plafonnées à *max* si une fourchette est définie (« ↑ +1 rep par série »). Les mêmes cas de reprise (reps −10 % au-delà de 4 semaines) et de plateau (on garde les mêmes reps, « = On consolide ») s'appliquent. |
| Durée | Durée de chaque série + 5 %, arrondie à 5 s près, avec au moins 5 s de plus (« ↑ +5 % de durée »). C'est une heuristique, la littérature étant faible sur ce point. |
| Poids et durée, distance et durée | Pas d'objectif en V1 (voir §4). Les champs se pré-remplissent avec la valeur précédente. |

Les objectifs se calculent sur les valeurs exactes et s'affichent dans l'unité de l'utilisateur. L'incrément est un multiple dans cette unité.

**Objectifs atteints**
- Un exercice a atteint son objectif si chaque série de travail qui avait un objectif est validée avec une charge au moins égale à l'objectif (une assistance au plus égale pour l'assisté) **et** des reps ou une durée au moins égales.
- Le récapitulatif et l'historique affichent « objectifs atteints : n / m exercices ». Les exercices sans objectif ne comptent pas.
- **Objectif manqué** : chaque série enregistre ses reps réalisées et garde son objectif figé à part. L'utilisateur saisit ce qu'il a vraiment fait (9 reps pour un objectif de 10), et le fait d'avoir manqué l'objectif s'en **déduit** : il ne se saisit pas. Dans le détail d'une séance passée, une série validée qui a manqué son objectif affiche discrètement l'objectif visé (« 80 kg × 9 · obj. 80 kg × 10 »). Celles qui l'ont atteint affichent ✓.
- **Échec et algorithme** : pour le plateau, un « échec » est une série de travail **sous le min de la fourchette**, que la série ait eu un objectif ou non. Un objectif manqué sans passer sous le min (9 reps pour 10 visées dans une fourchette 8–12) n'est pas un échec : la progression continue normalement.
- **Série à l'échec (X)** : c'est une nature saisie à la main, qui veut dire que la série a été volontairement menée jusqu'à l'échec. Elle est indépendante de l'objectif et ne change pas le calcul (voir plus haut). Sans objectif (progression désactivée, premier essai), c'est la seule information d'échec disponible.

**Tendance projetée** (fiche exercice, type poids et répétitions uniquement)
- **Données** : le meilleur 1RM estimé de chaque semaine calendaire, calculé sur les séries de travail de 12 reps au plus. Prendre le maximum par semaine atténue le bruit d'une séance à l'autre.
- **Modèle** : linéaire-log, 1RM(t) = a + b × ln(t), ajusté par moindres carrés. Ce modèle décrit l'évolution de la force sur plusieurs années : progression rapide au début, puis ralentissement et plateau vers 1 à 2 ans (Steele et al. 2022, Latella et al. 2024).
- **Origine du temps** : t est le nombre de semaines écoulées depuis le **début de l'entraînement**, plus 1. Sans cette correction, un pratiquant confirmé qui découvre l'app serait traité comme un débutant, et la projection serait trop optimiste.
  - Si l'ancienneté est renseignée, le début de l'entraînement est la date de saisie de l'ancienneté moins une durée forfaitaire :

    | Ancienneté | Durée retenue |
    |---|---|
    | Je débute | 0 |
    | Moins de 6 mois | 3 mois |
    | 6 mois à 1 an | 9 mois |
    | 1 à 2 ans | 18 mois |
    | 2 à 5 ans | 3,5 ans |
    | Plus de 5 ans | 6 ans |

  - Si ce début tombe après la première séance enregistrée sur l'exercice, on retient cette première séance.
  - Si l'ancienneté n'est pas renseignée, le début de l'entraînement est la première séance enregistrée sur l'exercice, et la fiche le signale : « Renseigne ton ancienneté pour une projection plus juste ».
  - Le même début s'applique à tous les exercices. C'est une approximation pour un exercice découvert récemment par un pratiquant confirmé, mais la force générale acquise s'y transfère en partie.
- **Conditions d'affichage** : au moins 6 semaines avec des données, réparties sur au moins 8 semaines. Si b ≤ 0, l'app affiche « Stable sur la période » et ne trace pas de projection.
- **Affichage** :
  - une courbe en pointillés jusqu'à +12 semaines, jamais au-delà ;
  - une ligne « Rythme actuel : +1,8 kg de 1RM estimé par mois », qui est la dérivée du modèle aujourd'hui (b / t, ramenée au mois).
- **Garde-fou** : le gain projeté est plafonné à 4 % du 1RM estimé actuel par mois, soit environ +50 % par an. C'est l'ordre de grandeur haut observé chez les débutants la première année (Steele et al. 2022).

**Objectif à long terme** (facultatif, un par exercice)
- L'utilisateur saisit une performance visée : charge × reps, de 1 à 12 reps. Elle est convertie en 1RM estimé (Epley).
- L'app résout a + b × ln(t) = 1RM visé et affiche le mois estimé (« vers mars 2027 »). Au-delà d'un an, ou sans tendance positive, elle affiche « Plus d'un an au rythme actuel ».
- L'objectif est **atteint** dès qu'une série de travail le réalise, avec la même règle « à au moins N reps » que les records (§7.6). L'app le signale par un badge 🎯 sur la série.

---

## 8. Navigation

Barre d'onglets en bas, à 3 onglets :

| Onglet | Contenu |
|---|---|
| **Accueil** | Résumé de la semaine (séances, série de semaines consécutives) et historique des séances |
| **Séance** | Démarrer une séance vide, routines et dossiers, bibliothèque d'exercices |
| **Profil** | Profil, statistiques, mesures, records, paramètres |

Quand une séance est en cours, elle est accessible depuis tous les onglets par un bandeau persistant.

---

## 9. Exigences de qualité

**Rapidité de saisie**
- Valider une série pré-remplie (objectif compris) : **1 toucher**.
- Modifier un poids puis valider : 3 touchers au plus.
- Les champs numériques ouvrent le pavé numérique du téléphone.

**Fiabilité**
- Aucune perte de données si l'app est fermée, le téléphone verrouillé ou le réseau coupé pendant une séance.
- Une séance faite hors ligne est synchronisée automatiquement au retour du réseau. Un indicateur discret signale les éléments non synchronisés.
- Le même compte est utilisable sur deux appareils (ex. iPhone et ordinateur). Les données sont les mêmes partout après synchronisation.

**Performance**
- L'écran de séance s'ouvre en moins d'1 seconde.
- L'historique et les statistiques se chargent en moins de 2 secondes en 4G.

**Ergonomie**
- Pensée pour une main, en salle : grandes zones tactiles, contraste élevé, thème sombre par défaut.
- Lisible avec la taille de texte agrandie d'iOS.

**Données personnelles**
- Aucune donnée d'un compte n'est visible par un autre compte, administrateur compris.
- Export et suppression complète du compte disponibles en autonomie.
- Pas de publicité ni de traqueur tiers.

**Propriété intellectuelle**
- Ne pas reprendre le nom, le logo, les illustrations ni les textes de HEVY. Le catalogue d'exercices et ses descriptions sont rédigés pour l'app.
- Le catalogue part de free-exercise-db (Unlicense, domaine public) : réutilisation et modification libres, sans attribution obligatoire.
- Les tracés de la carte musculaire viennent de [MuscleMap](https://github.com/melihcolpan/MuscleMap) (licence MIT) : la notice de licence est conservée dans le fichier généré et dans le JS livré.

---

## 10. Critères de réussite de la V1
1. Une séance complète de 6 exercices et 20 séries se logge sans hésitation et sans perte, y compris en mode avion.
2. Le minuteur de repos notifie correctement sur un iPhone verrouillé connecté au réseau.
3. Une séance terminée sur l'iPhone apparaît sur un autre appareil du même compte en moins d'une minute (en ligne).
4. Les records et graphiques d'un exercice sont justes après modification ou suppression d'une séance passée.
5. L'app remplace l'outil précédent pendant au moins 4 semaines d'usage réel.
6. Sur ces 4 semaines, les objectifs proposés sont validés tels quels, ou dépassés, pour la majorité des exercices. Sinon, les seuils du §7.10 sont recalibrés (voir Q8).

---

## 11. Questions ouvertes
| # | Question | Recommandation |
|---|---|---|
| Q1 | Nom et identité visuelle de l'app ? | **Tranché** (v0.7) : « Overload » (la surcharge progressive, principe des objectifs de progression). Identité visuelle : celle de la maquette (thème sombre, accent bleu). |
| Q2 | Photo de séance : 1 seule ou plusieurs ? | 1 photo en V1, pour limiter le stockage gratuit. |
| Q3 | Inscription ouverte à tous ou uniquement sur invitation ? | **Tranché** : sur invitation (voir §7.1). |
| Q4 | Faut-il récupérer son historique HEVY existant ? | **Tranché** : import CSV HEVY disponible (voir §7.1). |
| Q5 | Illustrations des exercices en V1 ? | **Tranché** : non. Les consignes et les muscles ciblés sont affichés en texte. Des visuels propres (SVG ou modèle 3D) sont prévus après la V1. |
| Q6 | Visuels d'exercices après la V1 : SVG ou modèle 3D ? | À décider plus tard. Les SVG sont plus simples à produire et plus légers. Un modèle 3D est plus riche mais demande plus de travail et pèse plus lourd sur mobile. |
| Q7 | Fonctions sociales (abonnements, fil, likes, partage) ? | **Tranché** (v0.4) : non. App personnelle, comptes isolés. |
| Q8 | Les seuils heuristiques du §7.10 sont-ils bons ? Il s'agit de la baisse de 10 % en cas de plateau, du barème de reprise, des +5 % sur la durée et du plafond de la projection. | Ce sont des valeurs de départ, prudentes et compatibles avec la littérature, mais aucune étude ne les fixe précisément. À réévaluer après 4 semaines d'usage réel (§10, critère 6). |
| Q9 | Faut-il demander l'ancienneté d'entraînement à l'inscription ? | **Tranché** (v0.6) : oui, en question facultative et modifiable dans les paramètres. Elle fixe l'origine du temps de la projection (§7.10). Sans elle, la projection part de la première séance enregistrée, et le garde-fou de 4 %/mois limite le biais. |
| Q10 | Ajouter un ressenti de difficulté (RPE ou RIR) pour affiner les objectifs ? | **Tranché** (v0.6) : non en V1. **Revu** (issue #19) : RPE 6–10 par demi-point, saisie facultative désactivée par défaut, effet limité aux extrêmes de l'échelle (§7.10). L'estimation des reps restantes reste imprécise d'environ 1 rep (Halperin et al. 2021). |
| Q11 | Quand une série est-elle un échec, et qu'enregistre-t-on (reps réalisées ou objectif) ? | **Tranché** (#20) : on enregistre les reps réalisées et on garde l'objectif à part. L'objectif manqué s'en déduit, et l'historique l'affiche. Pour l'algorithme, un échec reste une série sous le min de la fourchette. La nature X (menée à l'échec) est une information sans effet sur le calcul (voir §7.10, Objectifs atteints). |

---

## Annexe A. Références scientifiques des objectifs (§7.10)

| Référence | Ce qu'on en retient |
|---|---|
| ACSM (2009). *Progression Models in Resistance Training for Healthy Adults*. Med Sci Sports Exerc 41(3). | +2 à 10 % de charge quand on fait 1 à 2 reps de plus que la cible. Plage de 8 à 12 RM pour les débutants. |
| Currier et al. (2026). *ACSM Position Stand. Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults*. Med Sci Sports Exerc 58(4):851-872. | La progression n'est nécessaire que pour continuer à progresser à long terme. Aller jusqu'à l'échec n'est pas nécessaire. D'où des objectifs proposés plutôt qu'imposés. |
| Baechle & Earle, NSCA. *Essentials of Strength Training and Conditioning*. | Règle du « 2-for-2 ». Incréments de 1 à 2 kg (haut du corps) et de 2 à 4 kg (bas du corps), un peu plus pour les confirmés. |
| Plotkin et al. (2022). *Progressive overload without progressing load?* PeerJ 10:e14142. | Progresser en reps ou en charge donne des gains similaires, ce qui fonde la double progression. |
| Nuzzo, Pinto, Nosaka & Steele (2024). *Maximal Number of Repetitions at Percentages of the 1RM*. Sports Med 54:303-321. | Relation reps ↔ %1RM (environ 5 reps à 90 %, 9 à 80 %, 15 à 70 %), peu modifiée par le sexe, l'âge ou le niveau. Justifie la conversion de charge par Epley sur 1 à 12 reps. |
| Marzagao (2026). *A Weight-Dependent 1RM Prediction Equation…* arXiv:2603.17495 (préprint). | Epley n'est pas issue d'une étude empirique. La formule de Marzagao, qui dépend de la charge, réduit de 17 à 22 % l'incohérence entre séries d'une même personne. Elle n'a pas été validée sur de vrais 1RM. On l'utilise donc seulement pour l'équivalence charge ↔ reps des objectifs, et Epley reste la formule du 1RM affiché. |
| Steele et al. (2022). *Long-Term Time-Course of Strength Adaptation…* Res Q Exerc Sport. | 14 690 pratiquants suivis jusqu'à environ 7 ans. Le modèle linéaire-log décrit bien la progression : +30 à 50 % la 1ʳᵉ année, puis un plateau vers 1 à 2 ans. Fonde le modèle de projection et son plafond. |
| Latella et al. (2020). *Long-term strength adaptation: a 15-year analysis of powerlifting athletes*. JSCR. Latella et al. (2024), Sports Med 54. | Environ 0,1 à 0,2 kg/jour, et les plus forts progressent deux fois moins vite. +7,5 à 12,5 % la 1ʳᵉ année, environ +20 % en 10 ans. Grande variabilité entre individus, d'où un ajustement sur l'historique propre de l'utilisateur. |
| Bosquet et al. (2013). *Effect of training cessation on muscular performance: a meta-analysis*. Scand J Med Sci Sports. | Force maximale presque intacte jusqu'à environ 4 semaines d'arrêt, puis des pertes qui augmentent avec la durée de l'arrêt. Fonde le barème de reprise. |
| Bell et al. (2023). *Integrating Deloading into Strength and Physique Sports Training Programmes: a Delphi consensus*. Sports Med Open 9:87. | Consensus d'experts sur le deload, sans valeur chiffrée validée. La baisse de 10 % en cas de plateau est donc une heuristique (Q8). |
| Halperin et al. (2021). *Accuracy in Predicting Repetitions to Task Failure in Resistance Exercise*. Sports Med. Helms et al. (2018). Front Physiol 9:247. | L'estimation des reps restantes se trompe d'environ 1 rep, avec une forte variabilité. L'autorégulation par RPE donne un léger avantage, mais les résultats ne concordent pas. RIR et RPE restent hors V1 (Q10). |
