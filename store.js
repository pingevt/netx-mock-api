/**
 * In-memory data store
 *
 * Loads seed data and provides mutable state so that create/update/delete
 * operations during a session are reflected in subsequent reads.
 * Data resets on server restart.
 */

const { assets } = require('./data/assets');
const { folders } = require('./data/folders');
const { attributeDefinitions, attributeValues, collections } = require('./data/attributes');

// Deep clone seed data so mutations don't corrupt the original require cache
const store = {
  assets: JSON.parse(JSON.stringify(assets)),
  folders: JSON.parse(JSON.stringify(folders)),
  attributeDefinitions: JSON.parse(JSON.stringify(attributeDefinitions)),
  attributeValues: JSON.parse(JSON.stringify(attributeValues)),
  collections: JSON.parse(JSON.stringify(collections)),

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
    return this.assets[idx];
  },

  deleteAsset(id) {
    const idx = this.assets.findIndex(a => a.id === Number(id));
    if (idx === -1) return false;
    this.assets.splice(idx, 1);
    return true;
  },

  createAsset(data) {
    const maxId = Math.max(0, ...this.assets.map(a => a.id));
    const asset = {
      id: maxId + 1,
      name: data.name || data.fileName?.replace(/\.[^/.]+$/, '') || 'new-asset',
      fileName: data.fileName || 'new-asset.jpg',
      creationDate: Date.now(),
      importDate: Date.now(),
      modDate: Date.now(),
      file: { name: data.fileName, size: 0, width: null, height: null, checksum: '', url: `/file/asset/${maxId + 1}` },
      proxies: [
        { name: 'Thumbnail', file: { name: `${data.fileName}-thumbnail.jpg`, size: 0, width: 150, height: 150, url: `/view/0000/t_${maxId + 1}` } },
        { name: 'Preview',   file: { name: `${data.fileName}-preview.jpg`,   size: 0, width: 500, height: 500, url: `/view/0000/p_${maxId + 1}` } },
      ],
      folders: data.folderId ? [{ id: data.folderId, name: '', path: '' }] : [],
      attributes: {},
      versions: null,
      permissions: { read: true, write: true, delete: true },
      metadata: {},
      views: null,
      relatedAssets: null,
    };
    this.assets.push(asset);
    return asset;
  },

  setAssetAttributes(id, attributes) {
    const asset = this.getAssetById(id);
    if (!asset) return false;
    Object.assign(asset.attributes, attributes);
    asset.modDate = Date.now();
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
    return folder;
  },

  updateFolder(data) {
    const idx = this.folders.findIndex(f => f.id === Number(data.id));
    if (idx === -1) return null;
    if (data.name) this.folders[idx].name = data.name;
    if (data.description !== undefined) this.folders[idx].description = data.description;
    return this.folders[idx];
  },

  deleteFolder(id) {
    const idx = this.folders.findIndex(f => f.id === Number(id));
    if (idx === -1) return false;
    this.folders.splice(idx, 1);
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
    return col;
  },

  updateCollection(data, assetIds) {
    const col = this.getCollectionById(data.id);
    if (!col) return null;
    if (data.title) col.title = data.title;
    col.assetIds = [...assetIds];
    col.itemCount = assetIds.length;
    return col;
  },

  deleteCollection(id) {
    const idx = this.collections.findIndex(c => c.id === Number(id));
    if (idx === -1) return false;
    this.collections.splice(idx, 1);
    return true;
  },

  getAssetsByCollectionId(id) {
    const col = this.getCollectionById(id);
    if (!col) return null;
    return this.getAssetsByIds(col.assetIds);
  },
};

module.exports = store;
