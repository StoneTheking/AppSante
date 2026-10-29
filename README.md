# AppSanté — ton coach santé personnel 📱

Application web installable sur téléphone (PWA, Android et iPhone) qui croise **sommeil, humeur, bien-être numérique (temps d'écran, réseaux sociaux), activité physique, poids et alimentation** pour :

- évaluer ton état physique (IMC, masse grasse estimée, tour de taille/taille, métabolisme, dépense énergétique) ;
- **analyser ton assiette en photo** (aliments, portions, calories, macros, fibres, sel, niveau de transformation NOVA) et te dire si le repas est adapté à *ton* profil ;
- te proposer un **plan horaire de la journée** (lumière du matin, repas, dernier café, marche digestive, séance de sport au bon moment, coupure des écrans, coucher) qui s'adapte à ta nuit, ton humeur, ton stress et ton activité de la semaine ;
- suggérer **quoi manger maintenant** selon ce qu'il te reste à couvrir (calories, protéines, fibres, légumes) ;
- **projeter l'évolution de ton poids et de ton risque santé** sur 1, 5 et 10 ans, si rien ne change ou si tu suis les conseils ;
- discuter avec un **coach IA** qui connaît toutes tes données.

Toutes les recommandations citent leurs sources (OMS, méta-analyses du *Lancet*, *BMJ*, *Sleep*…) — liste complète dans `src/science.js` et dans l'onglet Profil.

## Installer sur ton téléphone

1. Ouvre l'adresse GitHub Pages du dépôt dans Chrome (Android) ou Safari (iPhone) :
   `https://stonetheking.github.io/AppSante/`
2. Android : menu ⋮ → **Installer l'application** (ou bouton « Installer » en haut). iPhone : bouton Partager → **Sur l'écran d'accueil**.
3. Onglet **Profil** : renseigne taille, poids, année de naissance, objectif, horaires.
4. Pour la photo d'assiette, la lecture de captures et le coach : colle une clé API Anthropic (console.anthropic.com). Elle reste sur ton téléphone.

> Si la page n'est pas encore en ligne : dans le dépôt GitHub → *Settings* → *Pages* → *Source : GitHub Actions*, puis relance l'action « Déploiement GitHub Pages ».

## Récupérer les données « Bien-être numérique »

Android ne permet pas aux applications web de lire directement Bien-être numérique ou Health Connect. Trois moyens sont donc proposés (onglet **Suivi**) :

- **Capture d'écran** de Bien-être numérique, Google Fit, Samsung Health, Fitbit, Garmin ou Temps d'écran iOS → l'IA lit les valeurs et remplit la journée ;
- **Import CSV** (export Google Fit via Takeout, ou modèle fourni) ;
- saisie manuelle rapide (check-in express sur l'accueil).

## Développement

```bash
npm install
npm run dev      # serveur local (accessible depuis le téléphone sur le même Wi-Fi)
npm test         # tests des calculs scientifiques
npm run build    # version de production dans dist/
```

Structure :

| Fichier | Rôle |
|---|---|
| `src/science.js` | Références scientifiques, équations (Mifflin-St Jeor, Hall, Deurenberg), scores, risques relatifs |
| `src/coach.js` | Synthèse des données, plan de la journée, activité recommandée, messages, projections |
| `src/meals.js` | Banque de repas équilibrés et moteur de suggestions |
| `src/ai.js` | Claude : analyse photo (sortie JSON structurée), lecture de captures, coach en streaming |
| `src/importer.js` | Import CSV (format app / Google Fit) |
| `src/main.js` | Interface (6 onglets) |

## Limites

AppSanté est un outil d'accompagnement, **pas un dispositif médical**. Les risques relatifs sont des ordres de grandeur issus d'études d'observation ; ils ne remplacent pas un bilan médical (tension, glycémie, cholestérol…). L'estimation des calories par photo a une marge d'erreur de l'ordre de 20 à 30 %.
