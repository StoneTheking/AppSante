# Diana Health — mesurer et améliorer ton hygiène de vie 📱

Application Android native **et** application web installable, qui croise **sommeil, humeur, bien-être numérique (temps d'écran, réseaux sociaux, déverrouillages), activité physique, fréquence cardiaque, poids et alimentation** pour :

- évaluer ton état physique (IMC, masse grasse estimée, tour de taille/taille, métabolisme, dépense) ;
- **analyser ton assiette en photo** (IA) ou **scanner un code-barres** (Open Food Facts : Nutri-Score, NOVA, additifs à surveiller, allergènes) avec un avis personnalisé ;
- te proposer un **plan heure par heure** (lumière du matin, repas, dernier café, pauses actives, marche digestive, sport au bon moment, coupure des écrans, coucher), avec **rappels** ;
- générer tes **menus de la semaine**, avec recettes et **liste de courses** par rayon ;
- **projeter ton risque santé** à 1, 5 et 10 ans ;
- discuter avec un **coach IA** qui connaît tes données et peut consulter PubMed, Cochrane, l'OMS, l'ANSES et les grandes revues médicales ;
- noter ton sommeil en un geste : bouton **« Je vais dormir »** sur l'accueil, **widget Android** et raccourci de l'icône ; le **réveil est détecté automatiquement** dans l'appli Android (sonnerie de l'alarme ou premier déverrouillage du matin, réveils nocturnes comptés) ;
- gérer ton **sport** : activité conseillée du jour (type, durée, intensité, zone de fréquence cardiaque, heure), semaine type selon ton objectif, **séances détaillées avec exercices** (renforcement selon ton niveau et ton matériel, fractionné 10 × 1 min ou 4 × 4 min, course-marche, natation, mobilité) et **mode guidé** (minuteur, séries, repos), **chronomètre** de séance, saisie et historique (durée, calories d'après le Compendium 2024), séances Health Connect importées ;
- tenir compte de **ton lieu de vie** : qualité de l'air (indice européen, PM2,5), pollens, UV, chaleur, lever du soleil (Open-Meteo) pour choisir l'heure et le lieu de ton sport ;
- remplir ton **garde-manger en photographiant ton ticket de caisse** (qualité du panier, menus qui utilisent ce que tu as, liste de courses qui l'en déduit) ;
- cuisiner **pour toute la famille** (besoins des enfants, allergies et régimes de chacun) ;
- s'adapter **à tes goûts** (aimés, détestés, cuisines, et notes ★ données à tes repas) ;
- noter tes **grignotages en un geste** (18 en-cas courants, raison : faim, ennui, stress, écran…) avec bilan et conseils ;
- garder un **historique des repas** (recherche, moyennes, plats fréquents) ;
- suivre ton **transit** (échelle de Bristol) et repérer les aliments à tester ;
- un **score d'hygiène de vie** expliqué pilier par pilier (sommeil, activité, alimentation, écrans ; l'humeur est suivie à part), avec le poids de chacun et l'action prioritaire ;
- un **plan du jour qui se recale** sur ce que tu as vraiment mangé (heure, calories restantes, grignotages) et sur ta séance prévue (horaires de travail, agenda) ;
- des **quêtes quotidiennes, une série et des badges** (façon Duolingo) et de petites animations de récompense ;
- une **caméra intégrée** qui s'ouvre instantanément pour photographier un repas (choix du type de repas, alcool détecté automatiquement) ;
- **« Mes plats »** (favoris et plats préparés à l'avance), **recettes** à la demande, **menus effaçables** jour par jour, **courses ↔ garde-manger** dans les deux sens (article coché = rangé au placard ; menus construits avec ce que tu as) ;
- des séances qui **s'adaptent à ton ressenti** (« trop dur / bien / pas assez dur »), une durée au choix et des sports à exclure ;
- un **poids estimé** d'après tes repas et ton activité, comparé à tes pesées (rappel toutes les 2 semaines) ;
- des **widgets** : « Je vais dormir » (chronomètre de la nuit, arrêt au déverrouillage du téléphone, « Je me rendors ») et « Photo du repas » ;
- un **podomètre intégré** quand Health Connect n'est pas disponible ;
- un **bilan du dimanche** (progrès par pilier, un seul objectif mesurable suivi pendant la semaine) ;
- **ce qui joue sur ton sommeil et ton humeur**, d'après tes propres jours (ex. « tu dors 40 min de plus les nuits qui suivent un jour à plus de 8 000 pas ») ;
- un plan du jour **modifiable** (détail de chaque étape, étapes masquées ou ajoutées) avec l'heure du **lever et du coucher du soleil** ;
- des **sources touchables** : ce que l'étude a montré et pourquoi elle appuie le conseil ;
- des **menus pour une journée** ou pour la semaine, une **semaine type de sport modifiable**, des exercices pour chaque sport avec **tutos vidéo** (ta propre vidéo au choix, exercices retirables) ;
- une semaine de sport calée sur **ton temps dispo** et ton format préféré (séances courtes et fréquentes ou quelques grosses séances) ;
- un plan du jour **organisé autour de tes horaires de travail**, dont chaque étape se modifie (nom, heure, note, jours) et dont les rappels suivent tes changements ;
- des **niveaux** qui montent avec les journées validées et redescendent avec les journées ratées ;
- une appli **utilisable sans clé API** : menus composés sur le téléphone, ajout rapide des repas ; la clé (payante à l'usage, distincte de l'abonnement Claude Pro) active l'analyse photo, les recettes et le coach IA ;
- une **IA gratuite possible** : une clé Google Gemini (aistudio.google.com, sans carte bancaire) marche comme une clé Claude ;
- la **recherche de produits par nom** (Open Food Facts) quand on n'a pas l'emballage, avec toutes les valeurs nutritives ;
- un **bilan sommeil de la semaine** : heures dormies, heures conseillées pour ton âge, dette de sommeil et décalage horaire social ;
- des **vidéos de démonstration** seulement pour les exercices techniques, à choisir une par une ou à importer d'une liste (`docs/videos-exercices.txt`).

Tout repose sur une **bibliothèque de 115 publications** (OMS, Lancet, BMJ, JAMA, NEJM, Nature…) consultable dans l'appli (Santé → Science) et dans `src/science.js`. Chaque DOI a été vérifié auprès de Crossref.

## Installer

### Application Android (recommandé)
1. Sur ton téléphone, ouvre : **https://github.com/StoneTheking/AppSante/releases/latest/download/AppSante.apk**
2. Ouvre le fichier téléchargé et autorise l'installation depuis Chrome.
3. Dans l'appli : Santé → Suivi → **Autoriser Health Connect** et **Autoriser le temps d'écran** (Accès aux données d'utilisation → Diana Health).

Chaque push compile un nouvel APK (GitHub Actions → Releases) qui s'installe par-dessus l'ancien sans perdre les données.

**Clé de signature.** Elle n'est jamais versionnée. Sans configuration, la CI en génère une et la conserve dans son cache. Pour une clé définitive, ajoute les secrets `ANDROID_KEYSTORE_B64` (keystore encodé en base64, alias `appsante`) et `ANDROID_KEYSTORE_PASSWORD` dans *Settings → Secrets and variables → Actions*.

### Téléphone géré par une organisation (MDM)
Si ton téléphone est inscrit dans une organisation, l'installation d'APK peut être bloquée (« Action non autorisée »). Utilise alors la version web installable ci-dessous : elle offre toutes les fonctions sauf la lecture automatique de Health Connect / Bien-être numérique et le widget (remplacé par le raccourci « Je vais dormir » sur l'icône et le bouton de l'accueil). Si ton téléphone a un **profil personnel** séparé du profil professionnel, l'APK peut s'installer depuis le Chrome du profil personnel.

### Version web
https://stonetheking.github.io/AppSante/ → menu ⋮ → *Installer l'application*. Le navigateur n'a pas accès à Health Connect ni à Bien-être numérique : il propose la lecture de captures d'écran par l'IA ou l'import CSV.

## Ce que lit l'application Android

| Source | Données |
|---|---|
| Health Connect | pas, sommeil (horaires + temps endormi), FC au repos, variabilité cardiaque, poids, séances (renforcement / intense / modéré) |
| Bien-être numérique (`UsageStatsManager`, plugin `UsageStatsPlugin.java`) | temps d'écran, réseaux sociaux, déverrouillages, usage après 22 h, applis les plus utilisées |
| Notifications locales | rappels programmés, même application fermée |

## Développement

```bash
npm install
npm run dev          # serveur local
npm test             # tests (calculs, scanner, menus, rappels, références)
npm run build        # version web dans dist/
npx cap sync android && cd android && ./gradlew assembleRelease   # APK
```

| Fichier | Rôle |
|---|---|
| `src/science.js` | 96 références, 72 résultats chiffrés, équations (Mifflin-St Jeor, Hall, Deurenberg), scores, risques relatifs |
| `src/coach.js` | synthèse des données, plan du jour, activité recommandée, analyses, projections |
| `src/barcode.js` | scanner (BarcodeDetector / ZXing), Open Food Facts, additifs, allergènes |
| `src/planner.js`, `src/meals.js` | menus de la semaine, liste de courses, banque de repas |
| `src/reminders.js` | rappels (notifications locales natives / web) |
| `src/native.js` | Health Connect et temps d'écran (Capacitor) |
| `src/ai.js` | Claude : photo, captures, menus, coach avec recherche scientifique |
| `src/workouts.js` | bibliothèque d'exercices et générateur de séances |
| `src/sport.js` | activités (MET), zones cardiaques, semaine type, séances et chronomètre |
| `src/env.js`, `src/sleep.js`, `src/pantry.js`, `src/family.js`, `src/digestion.js` | air & météo, sommeil en un geste, garde-manger, foyer & goûts, transit |
| `src/views/` | écrans (accueil, nutrition, santé, coach, profil, accueil du premier lancement) |
| `android/` | projet Android natif |

## Limites

Diana Health est un outil d'accompagnement, **pas un dispositif médical**. Les risques relatifs sont des ordres de grandeur issus d'études ; ils ne remplacent pas un bilan médical. L'estimation des calories par photo a une marge d'erreur de 20 à 30 %.
