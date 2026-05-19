/**
 * File retrieval routes
 *
 * Mirrors the NetX file access endpoints:
 *   GET /api/file/asset/:id              - Original file
 *   GET /api/file/asset/:id/thumbnail    - Thumbnail proxy
 *   GET /api/file/asset/:id/preview      - Preview proxy
 *   GET /api/file/asset/:id/zoom         - Zoom proxy
 *
 * In this mock, all file endpoints return a generated image via sharp.
 * Images are unique per asset ID and cached for performance.
 */

const express = require('express');
const router = express.Router();
const sharp = require('sharp');
const store = require('../store');
const imageGenerator = require('./imageGenerator');

function getProxyFile(asset, proxyName) {
  return asset.proxies?.find(p => p.name === proxyName)?.file || null;
}

async function sendUploadedImageVariant(res, uploadedFile, width, height) {
  if (!width || !height) {
    res.setHeader('Content-Type', uploadedFile.mimeType || 'application/octet-stream');
    return res.send(uploadedFile.buffer);
  }

  const resizedBuffer = await sharp(uploadedFile.buffer)
    .resize(width, height, { fit: 'inside', withoutEnlargement: true })
    .toBuffer();

  res.setHeader('Content-Type', uploadedFile.mimeType || 'image/png');
  return res.send(resizedBuffer);
}

// GET /api/file/asset/:id
router.get('/asset/:id', async (req, res) => {
  const asset = store.getAssetById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  try {
    const uploadedFile = store.getUploadedFile(req.params.id);
    if (uploadedFile) {
      res.setHeader('Content-Type', uploadedFile.mimeType || 'application/octet-stream');
      return res.send(uploadedFile.buffer);
    }

    const { width = 800, height = 600 } = asset.file || {};
    const buffer = await imageGenerator.generateImage(
      parseInt(req.params.id),
      width || 800,
      height || 600
    );
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    console.error('Error serving asset image:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

// GET /api/file/asset/:id/thumbnail
router.get('/asset/:id/thumbnail', async (req, res) => {
  const asset = store.getAssetById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  try {
    const uploadedFile = store.getUploadedFile(req.params.id);
    const proxy = getProxyFile(asset, 'Thumbnail');
    if (uploadedFile) {
      return await sendUploadedImageVariant(res, uploadedFile, proxy?.width || 150, proxy?.height || 150);
    }

    const buffer = await imageGenerator.getImageForProxy(
      parseInt(req.params.id),
      'Thumbnail',
      asset
    );
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    console.error('Error serving thumbnail:', error);
    res.status(500).json({ error: 'Failed to generate thumbnail' });
  }
});

// GET /api/file/asset/:id/preview
router.get('/asset/:id/preview', async (req, res) => {
  const asset = store.getAssetById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  try {
    const uploadedFile = store.getUploadedFile(req.params.id);
    const proxy = getProxyFile(asset, 'Preview');
    if (uploadedFile) {
      return await sendUploadedImageVariant(res, uploadedFile, proxy?.width || 500, proxy?.height || 500);
    }

    const buffer = await imageGenerator.getImageForProxy(
      parseInt(req.params.id),
      'Preview',
      asset
    );
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    console.error('Error serving preview:', error);
    res.status(500).json({ error: 'Failed to generate preview' });
  }
});

// GET /api/file/asset/:id/zoom
router.get('/asset/:id/zoom', async (req, res) => {
  const asset = store.getAssetById(req.params.id);
  if (!asset) return res.status(404).json({ error: 'Asset not found' });

  try {
    const uploadedFile = store.getUploadedFile(req.params.id);
    const proxy = getProxyFile(asset, 'Zoom');
    if (uploadedFile) {
      return await sendUploadedImageVariant(res, uploadedFile, proxy?.width || 1200, proxy?.height || 900);
    }

    const buffer = await imageGenerator.getImageForProxy(
      parseInt(req.params.id),
      'Zoom',
      asset
    );
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    console.error('Error serving zoom:', error);
    res.status(500).json({ error: 'Failed to generate zoom image' });
  }
});

// ── Proxy URL shorthand routes used by the module ─────────────────────────────
// The module constructs URLs like: baseUrl + proxy.file.url + "." + ext
// e.g. /view/0000/t_101.jpg
// These are also served via express.static in server.js, but we add
// a catch-all here so any /view/* path returns a generated image.

router.get('/view/*', async (req, res) => {
  // Extract asset ID from the path (e.g., /view/0000/t_101.jpg -> 101)
  const match = req.path.match(/(\d{3,})(?:\.\w+)?$/);
  const assetId = match ? parseInt(match[1]) : 1;

  try {
    const buffer = await imageGenerator.generateImage(assetId, 150, 150);
    res.setHeader('Content-Type', 'image/png');
    res.send(buffer);
  } catch (error) {
    console.error('Error serving proxy image:', error);
    res.status(500).json({ error: 'Failed to generate image' });
  }
});

module.exports = router;
