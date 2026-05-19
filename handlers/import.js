/**
 * Import routes
 *
 * Mirrors the NetX import endpoints:
 *   POST /api/import/asset          - Import new asset
 *   PUT  /api/import/asset/:id      - Reimport existing asset
 *   POST /api/import/asset/:id/version - Create new version
 *   POST /api/import/asset/:id/view    - Import a view
 */

const express = require('express');
const router = express.Router();
const multer = require('multer');
const sharp = require('sharp');
const crypto = require('crypto');
const store = require('../store');


// Store uploads in memory (no disk writes in the mock)
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 100 * 1024 * 1024 } });

// POST /api/import/asset
router.post('/asset', upload.single('file'), async (req, res) => {
  const { folderId, fileName } = req.body;
  const file = req.file;

  if (!folderId) return res.status(400).json({ error: 'folderId is required' });
  if (!file) return res.status(400).json({ error: 'file is required' });

  let metadata;
  try {
    metadata = await sharp(file.buffer).metadata();
  } catch (error) {
    return res.status(400).json({ error: 'Only image uploads are supported for asset import' });
  }

  const name = fileName || file?.originalname || 'uploaded-asset';
  const checksum = crypto.createHash('md5').update(file.buffer).digest('hex');

  const asset = store.createAsset({
    fileName: name,
    folderId: Number(folderId),
    buffer: file.buffer,
    mimeType: file.mimetype,
    size: file.size,
    width: metadata.width,
    height: metadata.height,
    checksum,
  });

  console.log(`[Import] New asset created: id=${asset.id} name=${asset.name} folder=${folderId}`);

  res.status(200).json({
    jsonrpc: '2.0',
    id: 'import',
    result: asset,
  });
});

// PUT /api/import/asset/:id  (reimport)
router.put('/asset/:id', upload.single('file'), async (req, res) => {
  const { fileName } = req.body;
  const asset = store.getAssetById(req.params.id);

  if (!asset) return res.status(404).json({ error: `Asset ${req.params.id} not found` });

  const name = fileName || req.file?.originalname || asset.fileName;
  const updated = store.updateAsset(asset.id, { fileName: name });

  if (req.file) {
    let metadata;
    try {
      metadata = await sharp(req.file.buffer).metadata();
    } catch (error) {
      return res.status(400).json({ error: 'Only image uploads are supported for asset reimport' });
    }

    const checksum = crypto.createHash('md5').update(req.file.buffer).digest('hex');
    store.setUploadedFile(asset.id, {
      buffer: req.file.buffer,
      mimeType: req.file.mimetype,
      fileName: name,
    });

    updated.file = {
      ...updated.file,
      name,
      size: req.file.size,
      width: metadata.width || null,
      height: metadata.height || null,
      checksum,
      url: `/api/file/asset/${asset.id}`,
    };
  } else {
    updated.file = {
      ...updated.file,
      name,
    };
  }

  console.log(`[Import] Asset reimported: id=${asset.id} new filename=${name}`);

  res.status(200).json({
    jsonrpc: '2.0',
    id: 'reimport',
    result: store.getAssetById(asset.id),
  });
});

// POST /api/import/asset/:id/version
router.post('/asset/:id/version', upload.single('file'), (req, res) => {
  const asset = store.getAssetById(req.params.id);
  if (!asset) return res.status(404).json({ error: `Asset ${req.params.id} not found` });

  console.log(`[Import] Version created for asset: id=${asset.id}`);

  res.status(200).json({
    jsonrpc: '2.0',
    id: 'version',
    result: { versionId: Math.floor(Math.random() * 9000) + 1000, assetId: asset.id },
  });
});

// POST /api/import/asset/:id/view
router.post('/asset/:id/view', upload.single('file'), (req, res) => {
  const asset = store.getAssetById(req.params.id);
  if (!asset) return res.status(404).json({ error: `Asset ${req.params.id} not found` });

  const { viewName = 'New View', description = '' } = req.body;
  const viewId = Math.floor(Math.random() * 9000) + 1000;

  console.log(`[Import] View created for asset: id=${asset.id} viewId=${viewId}`);

  res.status(200).json({
    jsonrpc: '2.0',
    id: 'importView',
    result: { id: viewId, name: viewName, description, assetId: asset.id },
  });
});

module.exports = router;
