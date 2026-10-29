# AppSanté — ton coach santé personnel 📱

Application Android native **et** application web installable, qui croise **sommeil, humeur, bien-être numérique (temps d'écran, réseaux sociaux, déverrouillages), activité physique, fréquence cardiaque, poids et alimentation** pour :

- évaluer ton état physique (IMC, masse grasse estimée, tour de taille/taille, métabolisme, dépense) ;
- **analyser ton assiette en photo** (IA) ou **scanner un code-barres** (Open Food Facts : Nutri-Score, NOVA, additifs à surveiller, allergènes) avec un avis personnalisé ;
- te proposer un **plan heure par heure** (lumière du matin, repas, dernier café, pauses actives, marche digestive, sport au bon moment, coupure des écrans, coucher), avec **rappels** ;
- générer tes **menus de la semaine**, avec recettes et **liste de courses** par rayon ;
- **projeter ton poids et ton risque santé** à 1, 5 et 10 ans ;
- discuter avec un **coach IA** qui connaît tes données et peut consulter PubMed, Cochrane, l'OMS, l'ANSES et les grandes revues médicales.

Tout repose sur une **bibliothèque de 62 publications** (OMS, Lancet, BMJ, JAMA, NEJM, Nature…) consultable dans l'appli (Santé → Science) et dans `src/science.js`. Chaque DOI a été vérifié auprès de Crossref.

## Installer

### Application Android (recommandé)
1. Sur ton téléphone, ouvre : **https://github.com/StoneTheking/AppSante/releases/latest/download/AppSante.apk**
2. Ouvre le fichier téléchargé et autorise l'installation depuis Chrome.
3. Dans l'appli : Santé → Suivi → **Autoriser Health Connect** et **Autoriser le temps d'écran** (Accès aux données d'utilisation → AppSanté).

Chaque push compile un nouvel APK (GitHub Actions → Releases) qui s'installe par-dessus l'ancien sans perdre les données.

**Clé de signature.** Elle n'est jamais versionnée. Sans configuration, la CI en génère une et la conserve dans son cache. Pour une clé définitive, ajoute les secrets `ANDROID_KEYSTORE_B64` (keystore encodé en base64, alias `appsante`) et `ANDROID_KEYSTORE_PASSWORD` dans *Settings → Secrets and variables → Actions*.

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
| `src/science.js` | 62 références, 45 résultats chiffrés, équations (Mifflin-St Jeor, Hall, Deurenberg), scores, risques relatifs |
| `src/coach.js` | synthèse des données, plan du jour, activité recommandée, analyses, projections |
| `src/barcode.js` | scanner (BarcodeDetector / ZXing), Open Food Facts, additifs, allergènes |
| `src/planner.js`, `src/meals.js` | menus de la semaine, liste de courses, banque de repas |
| `src/reminders.js` | rappels (notifications locales natives / web) |
| `src/native.js` | Health Connect et temps d'écran (Capacitor) |
| `src/ai.js` | Claude : photo, captures, menus, coach avec recherche scientifique |
| `src/views/` | écrans (accueil, nutrition, santé, coach, profil, accueil du premier lancement) |
| `android/` | projet Android natif |

## Limites

AppSanté est un outil d'accompagnement, **pas un dispositif médical**. Les risques relatifs sont des ordres de grandeur issus d'études ; ils ne remplacent pas un bilan médical. L'estimation des calories par photo a une marge d'erreur de 20 à 30 %.
