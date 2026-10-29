# AppSanté — ton coach santé personnel 📱

Application Android native **et** application web installable, qui croise **sommeil, humeur, bien-être numérique (temps d'écran, réseaux sociaux, déverrouillages), activité physique, fréquence cardiaque, poids et alimentation** pour :

- évaluer ton état physique (IMC, masse grasse estimée, tour de taille/taille, métabolisme, dépense) ;
- **analyser ton assiette en photo** (IA) ou **scanner un code-barres** (Open Food Facts : Nutri-Score, NOVA, additifs à surveiller, allergènes) avec un avis personnalisé ;
- te proposer un **plan heure par heure** (lumière du matin, repas, dernier café, pauses actives, marche digestive, sport au bon moment, coupure des écrans, coucher), avec **rappels** ;
- générer tes **menus de la semaine**, avec recettes et **liste de courses** par rayon ;
- **projeter ton poids et ton risque santé** à 1, 5 et 10 ans ;
- discuter avec un **coach IA** qui connaît tes données et peut consulter PubMed, Cochrane, l'OMS, l'ANSES et les grandes revues médicales ;
- noter ton sommeil en un geste : bouton **« Je vais dormir »** sur l'accueil, **widget Android** et raccourci de l'icône ; le **réveil est détecté automatiquement** dans l'appli Android (sonnerie de l'alarme ou premier déverrouillage du matin, réveils nocturnes comptés) ;
- gérer ton **sport** : activité conseillée du jour (type, durée, intensité, zone de fréquence cardiaque, heure), semaine type selon ton objectif, **séances détaillées avec exercices** (renforcement selon ton niveau et ton matériel, fractionné 10 × 1 min ou 4 × 4 min, course-marche, natation, mobilité) et **mode guidé** (minuteur, séries, repos), **chronomètre** de séance, saisie et historique (durée, calories d'après le Compendium 2024), séances Health Connect importées ;
- tenir compte de **ton lieu de vie** : qualité de l'air (indice européen, PM2,5), pollens, UV, chaleur, lever du soleil (Open-Meteo) pour choisir l'heure et le lieu de ton sport ;
- remplir ton **garde-manger en photographiant ton ticket de caisse** (qualité du panier, menus qui utilisent ce que tu as, liste de courses qui l'en déduit) ;
- cuisiner **pour toute la famille** (besoins des enfants, allergies et régimes de chacun) ;
- s'adapter **à tes goûts** (aimés, détestés, cuisines, et notes ★ données à tes repas) ;
- garder un **historique des repas** (recherche, moyennes, plats fréquents) ;
- suivre ton **transit** (échelle de Bristol) et repérer les aliments mal tolérés.

Tout repose sur une **bibliothèque de 96 publications** (OMS, Lancet, BMJ, JAMA, NEJM, Nature…) consultable dans l'appli (Santé → Science) et dans `src/science.js`. Chaque DOI a été vérifié auprès de Crossref.

## Installer

### Application Android (recommandé)
1. Sur ton téléphone, ouvre : **https://github.com/StoneTheking/AppSante/releases/latest/download/AppSante.apk**
2. Ouvre le fichier téléchargé et autorise l'installation depuis Chrome.
3. Dans l'appli : Santé → Suivi → **Autoriser Health Connect** et **Autoriser le temps d'écran** (Accès aux données d'utilisation → AppSanté).

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

AppSanté est un outil d'accompagnement, **pas un dispositif médical**. Les risques relatifs sont des ordres de grandeur issus d'études ; ils ne remplacent pas un bilan médical. L'estimation des calories par photo a une marge d'erreur de 20 à 30 %.
