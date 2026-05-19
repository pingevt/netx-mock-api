/**
 * In-memory data store
 *
 * Loads seed data and provides mutable state so that create/update/delete
 * operations during a session are reflected in subsequent reads.
 * State and uploaded files are also persisted to disk.
 */

const fs = require('fs');
const path = require('path');
const { assets } = require('./data/assets');
const { folders } = require('./data/folders');
const { attributeDefinitions, attributeValues, collections } = require('./data/attributes');

const PERSIST_DIR = process.env.PERSIST_DATA_DIR || path.join(__dirname, '.data');
const UPLOAD_DIR = path.join(PERSIST_DIR, 'uploads');
const STATE_FILE = path.join(PERSIST_DIR, 'store.json');

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function ensurePersistenceDirs() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function loadInitialState() {
  const fallback = {
    assets: deepClone(assets),
    folders: deepClone(folders),
    attributeDefinitions: deepClone(attributeDefinitions),
    attributeValues: deepClone(attributeValues),
    collections: deepClone(collections),
    uploadedFiles: new Map(),
  };

  try {
    ensurePersistenceDirs();
    if (!fs.existsSync(STATE_FILE)) {
      return fallback;
    }

    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const persisted = JSON.parse(raw);

    const uploadedFiles = new Map();
    for (const fileMeta of persisted.uploadedFiles || []) {
      const filePath = path.join(UPLOAD_DIR, fileMeta.diskFile || `${fileMeta.assetId}.bin`);
      if (!fs.existsSync(filePath)) {
        continue;
      }

      uploadedFiles.set(Number(fileMeta.assetId), {
        buffer: fs.readFileSync(filePath),
        mimeType: fileMeta.mimeType || 'application/octet-stream',
        fileName: fileMeta.fileName || `asset-${fileMeta.assetId}`,
        diskFile: fileMeta.diskFile || `${fileMeta.assetId}.bin`,
      });
    }

    return {
      assets: Array.isArray(persisted.assets) ? persisted.assets : fallback.assets,
      folders: Array.isArray(persisted.folders) ? persisted.folders : fallback.folders,
      attributeDefinitions: Array.isArray(persisted.attributeDefinitions) ? persisted.attributeDefinitions : fallback.attributeDefinitions,
      attributeValues: persisted.attributeValues || fallback.attributeValues,
      collections: Array.isArray(persisted.collections) ? persisted.collections : fallback.collections,
      uploadedFiles,
    };
  } catch (error) {
    console.warn(`[Store] Failed loading persisted state, using seed data: ${error.message}`);
    return fallback;
  }
}

const initialState = loadInitialState();

const store = {
  assets: initialState.assets,
  uploadedFiles: initialState.uploadedFiles,
  folders: initialState.folders,
  attributeDefinitions: initialState.attributeDefinitions,
  attributeValues: initialState.attributeValues,
  collections: initialState.collections,

  persist() {
    this._persistState();
  },

  _persistState() {
    try {
      ensurePersistenceDirs();

      const uploadedFiles = [];
      for (const [assetId, fileData] of this.uploadedFiles.entries()) {
        const diskFile = fileData.diskFile || `${assetId}.bin`;
        const diskPath = path.join(UPLOAD_DIR, diskFile);

        if (fileData.buffer) {
          fs.writeFileSync(diskPath, fileData.buffer);
        }

        uploadedFiles.push({
          assetId,
          mimeType: fileData.mimeType || 'application/octet-stream',
          fileName: fileData.fileName || `asset-${assetId}`,
          diskFile,
        });
      }

      fs.writeFileSync(
        STATE_FILE,
        JSON.stringify({
          assets: this.assets,
          folders: this.folders,
          attributeDefinitions: this.attributeDefinitions,
          attributeValues: this.attributeValues,
          collections: this.collections,
          uploadedFiles,
        }, null, 2)
      );
    } catch (error) {
      console.warn(`[Store] Failed to persist state: ${error.message}`);
    }
  },

  // ── Assets ──────────────────────────────────────────────────────────────

  getAssetById(id) {
    return this.assets.find(a => a.id === Number(id)) || null;
  },

  getAssetsByIds(ids) {
    return ids.map(id => this.getAssetById(id)).filter(Boolean);
  },

  getAssetsByFolderId(folderId, recursive = false) {
    const directFolderIds = recursive
      ? this._descendantFolderIds(Number(folderId))
      : [Number(folderId)];

    return this.assets.filter(a =>
      a.folders && a.folders.some(f => directFolderIds.includes(f.id))
    );
  },

  _descendantFolderIds(folderId) {
    const ids = [folderId];
    const children = this.folders.filter(f => f.parentId === folderId);
    children.forEach(c => ids.push(...this._descendantFolderIds(c.id)));
    return ids;
  },

  searchAssets({ keyword, folderId, recursive, attributeName, attributeValue, exact }) {
    return this.assets.filter(asset => {
      let match = true;

      if (keyword) {
        const kw = keyword.toLowerCase();
        const inName = asset.name.toLowerCase().includes(kw);
        const inFile = asset.fileName.toLowerCase().includes(kw);
        const inTags = asset.attributes?.['Tags']?.some(t => t.toLowerCase().includes(kw));
        const inDesc = asset.attributes?.['Description']?.some(d => d.toLowerCase().includes(kw));
        match = match && (inName || inFile || inTags || inDesc);
      }

      if (folderId !== undefined) {
        const folderIds = recursive
          ? this._descendantFolderIds(Number(folderId))
          : [Number(folderId)];
        match = match && asset.folders?.some(f => folderIds.includes(f.id));
      }

      if (attributeName && attributeValue) {
        const vals = asset.attributes?.[attributeName] || [];
        match = match && (exact
          ? vals.includes(attributeValue)
          : vals.some(v => v.toLowerCase().includes(attributeValue.toLowerCase()))
        );
      }

      return match;
    });
  },

  updateAsset(id, data) {
    const idx = this.assets.findIndex(a => a.id === Number(id));
    if (idx === -1) return null;
    if (data.name) this.assets[idx].name = data.name;
    if (data.fileName) this.assets[idx].fileName = data.fileName;
    this.assets[idx].modDate = Date.now();
    this._persistState();
    return this.assets[idx];
  },

  deleteAsset(id) {
    const numericId = Number(id);
    const idx = this.assets.findIndex(a => a.id === numericId);
    if (idx === -1) return false;

    const existingUpload = this.uploadedFiles.get(numericId);
    if (existingUpload?.diskFile) {
      const diskPath = path.join(UPLOAD_DIR, existingUpload.diskFile);
      if (fs.existsSync(diskPath)) {
        fs.unlinkSync(diskPath);
      }
    }

    this.assets.splice(idx, 1);
    this.uploadedFiles.delete(numericId);
    this._persistState();
    return true;
  },

  createAsset(data) {
    const maxId = Math.max(0, ...this.assets.map(a => a.id));
    const newId = maxId + 1;
    const fallbackFileName = data.fileName || 'new-asset.jpg';
    const extension = fallbackFileName.includes('.') ? fallbackFileName.split('.').pop().toLowerCase() : 'jpg';
    const width = Number.isFinite(data.width) ? data.width : null;
    const height = Number.isFinite(data.height) ? data.height : null;
    const folder = data.folderId ? this.getFolderById(data.folderId) : null;
    const asset = {
      id: newId,
      name: data.name || fallbackFileName.replace(/\.[^/.]+$/, '') || 'new-asset',
      fileName: fallbackFileName,
      creationDate: Date.now(),
      importDate: Date.now(),
      modDate: Date.now(),
      file: {
        name: fallbackFileName,
        size: Number(data.size) || 0,
        width,
        height,
        checksum: data.checksum || '',
        url: `/api/file/asset/${newId}`,
      },
      proxies: [
        { name: 'Thumbnail', file: { name: `${assetFileBaseName(fallbackFileName)}-thumbnail.${extension}`, size: 0, width: 150, height: 150, url: `/api/file/asset/${newId}/thumbnail` } },
        { name: 'Preview',   file: { name: `${assetFileBaseName(fallbackFileName)}-preview.${extension}`, size: 0, width: 500, height: 500, url: `/api/file/asset/${newId}/preview` } },
        { name: 'Zoom',      file: { name: `${assetFileBaseName(fallbackFileName)}-zoom.${extension}`, size: 0, width: 1200, height: 1200, url: `/api/file/asset/${newId}/zoom` } },
      ],
      folders: folder ? [{ id: folder.id, name: folder.name, path: folder.path }] : [],
      attributes: {},
      versions: null,
      permissions: { read: true, write: true, delete: true },
      metadata: {},
      views: null,
      relatedAssets: null,
    };
    this.assets.push(asset);

    if (data.buffer) {
      this.uploadedFiles.set(newId, {
        buffer: data.buffer,
        mimeType: data.mimeType || 'application/octet-stream',
        fileName: fallbackFileName,
        diskFile: `${newId}.bin`,
      });
    }

    this._persistState();

    return asset;
  },

  getUploadedFile(assetId) {
    return this.uploadedFiles.get(Number(assetId)) || null;
  },

  setUploadedFile(assetId, fileData) {
    const numericId = Number(assetId);
    this.uploadedFiles.set(numericId, {
      ...fileData,
      diskFile: `${numericId}.bin`,
    });
    this._persistState();
  },

  setAssetAttributes(id, attributes) {
    const asset = this.getAssetById(id);
    if (!asset) return false;
    Object.assign(asset.attributes, attributes);
    asset.modDate = Date.now();
    this._persistState();
    return true;
  },

  // ── Folders ─────────────────────────────────────────────────────────────

  getFolderById(id) {
    return this.folders.find(f => f.id === Number(id)) || null;
  },

  getFoldersByParentId(parentId) {
    return this.folders.filter(f => f.parentId === Number(parentId));
  },

  getFoldersByNameFilter(filter) {
    const lc = filter.toLowerCase();
    return this.folders.filter(f => f.name.toLowerCase().includes(lc));
  },

  getFolderByPath(path) {
    return this.folders.find(f => f.path === path) || null;
  },

  createFolder(data) {
    const maxId = Math.max(0, ...this.folders.map(f => f.id));
    const parent = this.getFolderById(data.parentId);
    const folder = {
      id: maxId + 1,
      parentId: Number(data.parentId),
      name: data.name,
      description: data.description || '',
      path: parent ? `${parent.path}/${data.name}`.replace(/^\//, '') : data.name,
      children: { assetCount: 0, folderCount: 0 },
    };
    this.folders.push(folder);
    this._persistState();
    return folder;
  },

  updateFolder(data) {
    const idx = this.folders.findIndex(f => f.id === Number(data.id));
    if (idx === -1) return null;
    if (data.name) this.folders[idx].name = data.name;
    if (data.description !== undefined) this.folders[idx].description = data.description;
    this._persistState();
    return this.folders[idx];
  },

  deleteFolder(id) {
    const idx = this.folders.findIndex(f => f.id === Number(id));
    if (idx === -1) return false;
    this.folders.splice(idx, 1);
    this._persistState();
    return true;
  },

  // ── Collections ──────────────────────────────────────────────────────────

  getCollectionById(id) {
    return this.collections.find(c => c.id === Number(id)) || null;
  },

  createCollection(data, assetIds) {
    const maxId = Math.max(0, ...this.collections.map(c => c.id));
    const col = {
      id: maxId + 1,
      title: data.title,
      itemCount: assetIds.length,
      assetIds: [...assetIds],
      permissions: { read: true, write: true, delete: true },
    };
    this.collections.push(col);
    this._persistState();
    return col;
  },

  updateCollection(data, assetIds) {
    const col = this.getCollectionById(data.id);
    if (!col) return null;
    if (data.title) col.title = data.title;
    col.assetIds = [...assetIds];
    col.itemCount = assetIds.length;
    this._persistState();
    return col;
  },

  deleteCollection(id) {
    const idx = this.collections.findIndex(c => c.id === Number(id));
    if (idx === -1) return false;
    this.collections.splice(idx, 1);
    this._persistState();
    return true;
  },

  getAssetsByCollectionId(id) {
    const col = this.getCollectionById(id);
    if (!col) return null;
    return this.getAssetsByIds(col.assetIds);
  },
};

function assetFileBaseName(fileName) {
  return fileName.replace(/\.[^/.]+$/, '');
}

module.exports = store;
