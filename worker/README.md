# CORS Proxy — Cloudflare Worker

Ce worker relaie les requêtes vers `api.notion.com` en ajoutant les headers CORS nécessaires.

## Déploiement (gratuit, 100 000 req/jour)

### Étape 1 — Créer un compte Cloudflare
Rends-toi sur [cloudflare.com](https://cloudflare.com) et crée un compte gratuit.

### Étape 2 — Créer un Worker
1. Dans le dashboard Cloudflare → **Workers & Pages** → **Create Worker**
2. Donne un nom à ton worker (ex: `notion-proxy`)
3. Clique sur **Deploy** (le code par défaut sera remplacé à l'étape suivante)

### Étape 3 — Coller le code
1. Clique sur **Edit code** (ou **Quick edit**)
2. Supprime tout le code existant
3. Colle le contenu de `cors-proxy.js`
4. Clique sur **Deploy**

### Étape 4 — Copier l'URL
Ton worker est accessible à l'URL :
```
https://<nom-du-worker>.<ton-sous-domaine>.workers.dev
```

Dans les paramètres du dashboard, entre l'URL du proxy comme suit :
```
https://<nom-du-worker>.<ton-sous-domaine>.workers.dev/notion
```

Le `/notion` à la fin est important — c'est le préfixe du routage.

## Test rapide

```bash
curl "https://<ton-worker>.workers.dev/notion/users/me" \
  -H "Authorization: Bearer secret_XXXX" \
  -H "Notion-Version: 2022-06-28"
```

## Alternative sans Worker (dégradée)

Si tu ne configures pas de Worker, l'app utilise automatiquement `corsproxy.io` comme fallback.
Ce service public est moins fiable (rate limits, pas de garantie de disponibilité).
Il est **fortement recommandé** de déployer ton propre Worker.
