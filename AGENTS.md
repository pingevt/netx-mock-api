# netx-mock-api — Agent Guidelines

## Project Overview

A Node.js/Express mock server that mimics the [NetX DAM JSON-RPC 2.0 API](https://developer.netx.net/) for local development of the `netx_media_source` Drupal module. Not for production use.

## Architecture

| File | Purpose |
|------|---------|
| `server.js` | Express app, middleware, route mounting |
| `store.js` | In-memory data store with CRUD — resets on restart |
| `handlers/rpc.js` | JSON-RPC 2.0 dispatcher |
| `handlers/methods.js` | RPC method implementations (getAssets, getFoldersByParent, etc.) |
| `handlers/files.js` | File/thumbnail routes — unauthenticated, proxies placehold.co |
| `handlers/import.js` | Asset import routes (multipart) |
| `handlers/webhook.js` | Webhook subscriptions and outbound delivery (`GET /api/webhooks`, `POST /api/webhooks/trigger`) |
| `data/assets.js` | 17 seed assets across 5 content types |
| `data/folders.js` | 8 seed folders in a hierarchy rooted at ID 1 |
| `data/attributes.js` | Attribute definitions and collections |
| `data/webhooks.js` | Default webhook subscription seed (one Drupal DDEV subscriber) |

## Key Conventions

- **Auth**: `Authorization: apiToken <token>` header required on `/api/rpc` and `/api/import`. File routes (`/api/file/`) are **unauthenticated** — browser `<img>` tags need direct access
- **Default token**: `dev-token-1234` (set `NETX_API_TOKEN` env var to override)
- **RPC envelope**: Always `{ jsonrpc: "2.0", id, method, params }` in, `{ jsonrpc: "2.0", id, result }` or `{ ..., error }` out
- **Proxy URLs**: Asset proxy URLs use `/api/file/asset/:id/thumbnail` etc. — not `/view/...` paths
- **Folder root**: Root folder is always ID `1`; `getFoldersByParent(1)` returns top-level folders

## Folder / Asset ID Map

| ID | Name | Parent | Assets |
|----|------|--------|--------|
| 1 | Root | — | — |
| 2 | Images | 1 | — |
| 3 | Videos | 1 | 401, 402 |
| 4 | Documents | 1 | 501, 502 |
| 5 | Logos | 1 | 301–305 |
| 6 | Landscapes | 2 | 101–105 |
| 7 | Portraits | 2 | 201–203 |
| 8 | SVG | 5 | 304, 305 |

## Running

```bash
node server.js
# Health check:
curl http://localhost:3000/health
# Test RPC:
curl -X POST http://localhost:3000/api/rpc \
  -H "Content-Type: application/json" \
  -H "Authorization: apiToken dev-token-1234" \
  -d '{"jsonrpc":"2.0","id":"t","method":"getFoldersByParent","params":[1,{}]}'
```

## Adding Seed Data

Add entries to `data/assets.js` and/or `data/folders.js`. Proxy URLs must match the pattern `/api/file/asset/:id/thumbnail` (not custom paths). Restart the server to reload.

## Commit Convention

This repo follows [Conventional Commits](https://www.conventionalcommits.org/).

```
<type>(<scope>): <short summary>
```

| Type | Use for |
|------|---------|
| `feat` | New endpoint, method, or seed data |
| `fix` | Bug fix |
| `docs` | Documentation / AGENTS.md / README only |
| `refactor` | Code restructure, no behavior change |
| `chore` | Dependencies, tooling |

Optional scopes: `rpc`, `files`, `store`, `data`, `auth`

Examples:
```
feat(data): add 5 landscape assets to seed data
fix(files): remove auth requirement from file routes
feat(rpc): implement setAssetAttributes method
```

## Paired With

`netx_media_source` Drupal module at `/Users/peteinge/Modules/netx_media_source`. Configure the `NetxSource` entity with:
- **API URL Base**: `http://host.docker.internal:3000/api/rpc` (PHP/server-side)
- **Public Base URL**: `http://localhost:3000` (browser-side, for thumbnails)
- **Token**: key entity containing `dev-token-1234`
