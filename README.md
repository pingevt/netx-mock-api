# NetX Mock API Server

A local Node.js server that mimics the [NetX DAM JSON-RPC API](https://developer.netx.net/) for development of the `netx_media_source` Drupal module — no real NetX environment required.

## Requirements

- Node.js 18+
- npm

## Installation

```bash
cd netx-mock-api
npm install
```

## Running

```bash
# Standard start
npm start

# Development mode (auto-restarts on file changes)
npm run dev
```

The server starts at **http://localhost:3000**.

For a quick demo UI, open **http://localhost:3000/dashboard**. It wraps the JSON-RPC endpoint in a browser page with preset requests, raw responses, and a live asset gallery.

## Drupal Module Configuration

Once running, configure your NetX Source entity in Drupal:

| Field | Value |
|-------|-------|
| API URL (RPC endpoint) | `http://localhost:3000/api/rpc` |
| API Base URL | `http://localhost:3000` |
| API Token | `dev-token-1234` |

> The token value is accepted as-is. Set `STRICT_AUTH=true` in your environment to enforce it.

## Endpoints

### JSON-RPC

```
POST /api/rpc
Authorization: apiToken dev-token-1234
Content-Type: application/json
```

All requests follow the [JSON-RPC 2.0](https://www.jsonrpc.org/specification) format:

```json
{
  "jsonrpc": "2.0",
  "id": "my-request",
  "method": "getFoldersByParent",
  "params": [1, { "page": { "startIndex": 0, "size": 10 }, "data": ["folder.id", "folder.base"] }]
}
```

### Supported RPC Methods

#### Assets
| Method | Description |
|--------|-------------|
| `getAssets` | Get assets by IDs |
| `updateAsset` | Update asset name/filename |
| `getAssetsByFolder` | Get assets in a folder |
| `addAssetToFolder` | Add asset to a folder |
| `removeAssetFromFolder` | Remove asset from folder |
| `deleteAsset` | Delete an asset |
| `getAssetsByQuery` | Search with clauses and facets |

#### Folders
| Method | Description |
|--------|-------------|
| `getFolderById` | Get folder by ID |
| `getFoldersByParent` | List child folders |
| `getFoldersByNameFilter` | Search folders by name |
| `getFolderByPath` | Find folder by path string |
| `createFolder` | Create a new folder |
| `createFolderFromPath` | Create folder hierarchy from path |
| `updateFolder` | Update folder data |
| `deleteFolder` | Delete a folder |

#### Attributes
| Method | Description |
|--------|-------------|
| `getAttributes` | List attribute definitions |
| `getAssetAttributes` | Get attribute values for an asset |
| `setAssetAttributes` | Update attribute values for an asset |
| `getValuesByAttribute` | Get valid values for a pulldown/tag attribute |

#### Search
| Method | Description |
|--------|-------------|
| `getAssetsByQuery` | Complex query with `contains`, `exact`, `folder`, `exists`, `subquery` clauses |

#### Collections
| Method | Description |
|--------|-------------|
| `createCollection` | Create a collection |
| `getCollection` | Get a collection |
| `getCollections` | List all accessible collections |
| `updateCollection` | Update collection title and assets |
| `deleteCollection` | Delete a collection |
| `getAssetsByCollection` | Get assets in a collection |

#### Users & Groups (stubs)
| Method | Description |
|--------|-------------|
| `getSelf` | Get current user |
| `getUser` | Get user by ID |
| `getUsersByGroup` | List users in a group |
| `getGroup` | Get group by ID |
| `getGroupsByUser` | List groups for a user |

### File Retrieval

```
GET /api/file/asset/:id           → Original file (placeholder image)
GET /api/file/asset/:id/thumbnail → Thumbnail
GET /api/file/asset/:id/preview   → Preview
GET /api/file/asset/:id/zoom      → Zoom
```

Proxy URL pattern used by the module:
```
GET /view/0000/t_101.jpg  → Thumbnail placeholder
GET /view/0000/p_101.jpg  → Preview placeholder
```

### Import

```
POST /api/import/asset                  → Upload new asset (multipart)
PUT  /api/import/asset/:id              → Reimport existing asset
POST /api/import/asset/:id/version      → New version
POST /api/import/asset/:id/view         → Import a view
```

### Health Check (no auth)

```
GET /health
```

## Seed Data

The mock ships with realistic seed data:

### Folders
```
Root (1)
├── Images (2)
│   ├── Landscapes (6)  → 3 image assets
│   └── Portraits (7)   → 2 image assets
├── Videos (3)          → 1 video asset
├── Documents (4)       → 1 document asset
└── Logos (5)           → 2 logo assets
    └── SVG (8)
```

### Assets
| ID | Name | Type | Folder |
|----|------|------|--------|
| 101 | mountain-sunrise | JPEG | Landscapes |
| 102 | forest-path | JPEG | Landscapes |
| 103 | coastal-cliffs | JPEG | Landscapes |
| 201 | portrait-subject-a | JPEG | Portraits |
| 202 | portrait-subject-b | JPEG | Portraits |
| 301 | company-logo-full | PNG | Logos |
| 302 | company-logo-white | PNG | Logos |
| 401 | brand-video-short | MP4 | Videos |
| 501 | brand-guidelines | PDF | Documents |

### Attributes
- **Description** (TEXT)
- **Tags** (TAG, multivalue)
- **Status** (PULLDOWN: Draft, Published, Archived)
- **Photographer** (TEXT)
- **Copyright** (TEXT)
- **Web-Enterprise UUID** (TEXT)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Server port |
| `NETX_API_TOKEN` | `dev-token-1234` | Expected API token |
| `STRICT_AUTH` | `false` | If `true`, reject requests with wrong token |
| `PERSIST_DATA_DIR` | `.data` in project root | Directory used to persist store state and uploaded files |

## Notes

- **Data persists across restarts** — runtime state is written to `.data/store.json`, uploads to `.data/uploads/`
- **To reset state**, stop the server and remove `.data/`
- The `fromjs` route in the Drupal module (`/netx-media/ajax/{mediatype}/fromjs`) is a Drupal-side endpoint — it is not part of this mock server
