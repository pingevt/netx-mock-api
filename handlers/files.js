/**
 * File retrieval routes
 *
 * Mirrors the NetX file access endpoints:
 *   GET /api/file/asset/:id              - Original file
 *   GET /api/file/asset/:id/thumbnail    - Thumbnail proxy
 *   GET /api/file/asset/:id/preview      - Preview proxy
 *   GET /api/file/asset/:id/zoom         - Zoom proxy
 *
 * In this mock, all file endpoints return a generated placeholder image
 * via placehold.co (requires internet) or a local placeholder PNG.
 */

const express = require('express');
const router = express.Router();
const store = require('../store');

const https = require('https');
const http = require('http');

/**
 * Redirect to a placeholder image service.
 * In a fully offline setup you could serve a local PNG instead.
 */
function servePlaceholder(res, width = 800, height = 600, label = 'Asset') {
  const safeLabel = encodeURIComponent(label.replace(/[^a-zA-Z0-9 -]/g, '').slice(0, 30));
  // placehold.co returns a PNG with the text overlaid
  const url = `https://placehold.co/${width}x${height}/3a86ff/ffffff/png?text=${safeLabel}`;

  // Try to proxy the image; on failure serve a minimal data URI response
  const client = url.startsWith('https') ? https : http;
  const request = client.get(url, (proxyRes) => {
    res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'image/png');
    proxyRes.pipe(res);
  });

  request.on('error', () => {
    // Fallback: 1x1 transparent PNG
    const tiny = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
    res.setHeader('Content-Type', 'image/png');
    res.send(tiny);
  });
}

function getProxyFile(asset, proxyName) {
  return asset.proxies?.find(p => p.name === proxyName)?.file || null;
}

// GET /api/file/asset/:id
router.get('/asset/:id', (req, res) => {
  const asset = store.getAssetById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const { width = 800, height = 600 } = asset.file || {};
  servePlaceholder(res, width || 800, height || 600, asset.name);
});

// GET /api/file/asset/:id/thumbnail
router.get('/asset/:id/thumbnail', (req, res) => {
  const asset = store.getAssetById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const proxy = getProxyFile(asset, 'Thumbnail');
  servePlaceholder(res, proxy?.width || 150, proxy?.height || 150, asset.name);
});

// GET /api/file/asset/:id/preview
router.get('/asset/:id/preview', (req, res) => {
  const asset = store.getAssetById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const proxy = getProxyFile(asset, 'Preview');
  servePlaceholder(res, proxy?.width || 500, proxy?.height || 500, asset.name);
});

// GET /api/file/asset/:id/zoom
router.get('/asset/:id/zoom', (req, res) => {
  const asset = store.getAssetById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  const proxy = getProxyFile(asset, 'Zoom');
  servePlaceholder(res, proxy?.width || 1200, proxy?.height || 900, asset.name);
});

// ── Proxy URL shorthand routes used by the module ─────────────────────────────
// The module constructs URLs like: baseUrl + proxy.file.url + "." + ext
// e.g. /view/0000/t_101.jpg
// These are also served via express.static in server.js, but we add
// a catch-all here so any /view/* path returns a placeholder.

router.get('/view/*', (req, res) => {
  servePlaceholder(res, 150, 150, 'Proxy');
});

module.exports = router;
