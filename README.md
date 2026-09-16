# Pico Design

Outil interne pour créer les produits Pico : envoyer une image, choisir un
modèle (dimensions + fond perdu + résolution d'impression), et obtenir un PDF
prêt pour impression avec le logo Pico appliqué automatiquement.

Stack : Next.js 14 (App Router, TypeScript) + Supabase (auth, base de
données, stockage de fichiers) + déploiement Vercel.

## Comment ça marche

1. Un employé se connecte (comptes créés manuellement, voir plus bas).
2. Il va dans **Générer un PDF**, choisit un modèle de produit (ex. "Cartes
   d'affaires 90×50mm") et envoie une image.
3. Le serveur redimensionne/recadre l'image à la bonne résolution
   d'impression (300 dpi par défaut), génère un PDF aux dimensions exactes
   (fond perdu inclus), superpose le logo Pico à la position configurée, et
   enregistre le tout dans Supabase Storage.
4. L'employé télécharge le PDF prêt à envoyer à l'imprimante.
5. **Modèles** permet d'ajouter de nouveaux formats de produits sans toucher
   au code (dimensions, fond perdu, position/taille du logo).
6. **Historique** liste les générations passées (succès/erreurs).

## Mise en route (première fois)

### 1. Installer les dépendances

```bash
npm install
```

### 2. Exécuter le schéma de base de données

Dans le tableau de bord Supabase (`nexhrabvgsplczdbiklk`) → **SQL Editor** →
coller le contenu de `supabase/migrations/0001_init.sql` → **Run**.

Ça crée :
- la table `profiles` (comptes employés),
- la table `templates` (modèles de produits, avec 3 exemples de départ à
  ajuster selon le vrai catalogue Pico),
- la table `jobs` (historique des générations),
- les politiques de sécurité (RLS) — tout employé connecté peut lire/écrire,
- 3 buckets de stockage : `uploads`, `outputs`, `assets`.

### 3. Ajouter le logo Pico

Dans Supabase → **Storage** → bucket `assets` → uploader le logo (PNG avec
fond transparent de préférence) sous le chemin exact :

```
assets/pico-logo.png
```

(Si ce fichier est absent, les PDF sont générés sans logo — pas d'erreur.)

### 4. Configurer les variables d'environnement

```bash
cp .env.local.example .env.local
```

Remplis `.env.local` avec les clés trouvées dans Supabase → **Project
Settings → API** :
- `NEXT_PUBLIC_SUPABASE_URL` (déjà pré-rempli : `https://nexhrabvgsplczdbiklk.supabase.co`)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` → clé "anon public"
- `SUPABASE_SERVICE_ROLE_KEY` → clé "service_role" (⚠️ secrète, ne jamais commit)

### 5. Créer les comptes employés

Pas d'auto-inscription volontairement. Dans Supabase → **Authentication →
Users → Add user**, crée un compte (courriel + mot de passe) pour toi et
chaque employé qui doit avoir accès.

### 6. Lancer en local

```bash
npm run dev
```

→ http://localhost:3000

### 7. Pousser sur GitHub

```bash
git init
git add .
git commit -m "Scaffold initial — Pico Design"
git branch -M main
git remote add origin https://github.com/edanjou/pico-design.git
git push -u origin main
```

### 8. Déployer sur Vercel

Dans le tableau de bord Vercel (projet `pico-design`) :
1. Connecte le dépôt GitHub `edanjou/pico-design` (Import Project si ce n'est
   pas déjà fait).
2. Dans **Settings → Environment Variables**, ajoute les 3 mêmes variables
   que `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`).
3. Redéploie.

## Ajuster les modèles de produits

Les 3 modèles de départ (`supabase/migrations/0001_init.sql`, section 6) sont
des exemples génériques — à remplacer par le vrai catalogue Pico. Deux
façons de faire :
- Directement dans l'app, via **Modèles → + Nouveau modèle** (une fois
  connecté).
- En modifiant/ajoutant des lignes SQL dans Supabase → Table Editor → table
  `templates`.

Chaque modèle définit :
- `width_mm` / `height_mm` : dimensions finies du produit,
- `bleed_mm` : fond perdu ajouté tout autour (zone imprimée mais rognée),
- `dpi` : résolution d'impression (300 = standard qualité photo/carte),
- `logo_position`, `logo_width_mm`, `logo_margin_mm` : où et à quelle taille
  le logo Pico est superposé.

## Structure du projet

```
app/
  login/            page de connexion
  generate/         page principale — upload image + génération PDF
  templates/         gestion des modèles de produits
  history/           historique des générations
  api/generate/      route serveur : orchestration image → PDF → storage
  api/templates/     route serveur : CRUD des modèles
lib/
  pdf/generate.ts    cœur métier : construction du PDF (pdf-lib + sharp)
  pdf/units.ts        conversions mm ↔ points ↔ pixels
  supabase/           clients Supabase (navigateur, serveur, admin)
supabase/migrations/  schéma SQL à exécuter dans Supabase
```

## Prochaines étapes suggérées

- Remplacer les modèles d'exemple par le vrai catalogue Pico.
- Ajouter la modification/suppression de modèles (seule la création est
  incluse pour l'instant).
- Ajouter un rôle "admin" restreint pour la gestion des modèles, si tous les
  employés ne doivent pas pouvoir en créer.
- Générer les types TypeScript depuis le schéma réel :
  `npx supabase gen types typescript --project-id nexhrabvgsplczdbiklk > lib/database.types.ts`
  puis remplacer le `Database = any` dans `lib/types.ts`.
