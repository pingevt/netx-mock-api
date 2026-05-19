/**
 * RPC method implementations
 *
 * Each export matches a NetX API method name exactly.
 * Params arrive as the raw array from the JSON-RPC body.
 *
 * Data filtering: the module always requests specific data fields
 * (e.g. "asset.base", "asset.proxies"). We always return everything
 * in the mock - no need to strip fields for dev purposes.
 */

const store = require('../store');


// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Paginate an array using NetX page options: { startIndex, size }
 */
function paginate(arr, pageOpts = {}) {
  const startIndex = Number(pageOpts.startIndex ?? 0);
  const size = Number(pageOpts.size ?? 20);
  const sliced = arr.slice(startIndex, startIndex + size);
  return { results: sliced, size: arr.length };
}

/**
 * Extract page options from a NetX options object
 */
function getPageOpts(options) {
  return options?.page || {};
}

// ─── Asset Methods ────────────────────────────────────────────────────────────

/**
 * getAssets([assetIds], options)
 */
function getAssets(params) {
  const [assetIds] = params;
  if (!Array.isArray(assetIds)) throw new Error('assetIds must be an array');
  return store.getAssetsByIds(assetIds);
}

/**
 * updateAsset(assetData, options)
 */
function updateAsset(params) {
  const [assetData] = params;
  if (!assetData?.id) throw new Error('Asset id required');
  const updated = store.updateAsset(assetData.id, assetData);
  if (!updated) throw new Error(`Asset ${assetData.id} not found`);
  return updated;
}

/**
 * getAssetsByFolder(folderId, recursive, options)
 */
function getAssetsByFolder(params) {
  const [folderId, recursive, options] = params;
  const assets = store.getAssetsByFolderId(folderId, recursive);
  return paginate(assets, getPageOpts(options));
}

/**
 * addAssetToFolder(assetId, folderId, options)
 */
function addAssetToFolder(params) {
  const [assetId, folderId] = params;
  const asset = store.getAssetById(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  const folder = store.getFolderById(folderId);
  if (!folder) throw new Error(`Folder ${folderId} not found`);

  const alreadyIn = asset.folders?.some(f => f.id === Number(folderId));
  if (!alreadyIn) {
    asset.folders = asset.folders || [];
    asset.folders.push({ id: folder.id, name: folder.name, description: folder.description, path: folder.path, children: null });
    store.persist();
  }
  return asset;
}

/**
 * removeAssetFromFolder(assetId, folderId, options)
 */
function removeAssetFromFolder(params) {
  const [assetId, folderId] = params;
  const asset = store.getAssetById(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  asset.folders = (asset.folders || []).filter(f => f.id !== Number(folderId));
  store.persist();
  return asset;
}

/**
 * deleteAsset(assetId)
 */
function deleteAsset(params) {
  const [assetId] = params;
  if (!store.deleteAsset(assetId)) throw new Error(`Asset ${assetId} not found`);
  return {};
}

// ─── Folder Methods ───────────────────────────────────────────────────────────

/**
 * getFolderById(folderId, options)
 */
function getFolderById(params) {
  const [folderId] = params;
  const folder = store.getFolderById(folderId);
  if (!folder) throw new Error(`Folder ${folderId} not found`);
  return folder;
}

/**
 * getFoldersByParent(parentId, options)
 */
function getFoldersByParent(params) {
  const [parentId, options] = params;
  const folders = store.getFoldersByParentId(parentId);
  return paginate(folders, getPageOpts(options));
}

/**
 * getFoldersByNameFilter(filter, options)
 */
function getFoldersByNameFilter(params) {
  const [filter, options] = params;
  const folders = store.getFoldersByNameFilter(filter);
  return paginate(folders, getPageOpts(options));
}

/**
 * getFolderByPath(path, options)
 */
function getFolderByPath(params) {
  const [path] = params;
  const folder = store.getFolderByPath(path);
  if (!folder) throw new Error(`Folder at path "${path}" not found`);
  return folder;
}

/**
 * createFolder(folderData, options)
 */
function createFolder(params) {
  const [folderData] = params;
  if (!folderData?.parentId || !folderData?.name) throw new Error('parentId and name required');
  return store.createFolder(folderData);
}

/**
 * createFolderFromPath(path, options)
 */
function createFolderFromPath(params) {
  const [path] = params;
  const parts = path.split('/');
  let parentId = 1;
  let folder = null;

  for (const part of parts) {
    const existing = store.getFolderByPath(parts.slice(0, parts.indexOf(part) + 1).join('/'));
    if (existing) {
      parentId = existing.id;
      folder = existing;
    } else {
      folder = store.createFolder({ parentId, name: part });
      parentId = folder.id;
    }
  }
  return folder;
}

/**
 * updateFolder(folderData, options)
 */
function updateFolder(params) {
  const [folderData] = params;
  if (!folderData?.id) throw new Error('id required');
  const updated = store.updateFolder(folderData);
  if (!updated) throw new Error(`Folder ${folderData.id} not found`);
  return updated;
}

/**
 * deleteFolder(folderId, options)
 */
function deleteFolder(params) {
  const [folderId] = params;
  if (!store.deleteFolder(folderId)) throw new Error(`Folder ${folderId} not found`);
  return {};
}

// ─── Attribute Methods ────────────────────────────────────────────────────────

/**
 * getAttributes(options)
 */
function getAttributes(params) {
  const [options] = params;
  return paginate(store.attributeDefinitions, getPageOpts(options));
}

/**
 * getAssetAttributes(assetId)
 */
function getAssetAttributes(params) {
  const [assetId] = params;
  const asset = store.getAssetById(assetId);
  if (!asset) throw new Error(`Asset ${assetId} not found`);
  return asset.attributes || {};
}

/**
 * setAssetAttributes(assetId, attributes)
 */
function setAssetAttributes(params) {
  const [assetId, attributes] = params;
  if (!store.setAssetAttributes(assetId, attributes)) throw new Error(`Asset ${assetId} not found`);
  return {};
}

/**
 * getValuesByAttribute(attributeId, options)
 */
function getValuesByAttribute(params) {
  const [attributeId, options] = params;
  const values = (store.attributeValues[attributeId] || []).map(v => ({ value: v }));
  return paginate(values, getPageOpts(options));
}

// ─── Search Methods ───────────────────────────────────────────────────────────

/**
 * getAssetsByQuery(query, facets?, options)
 *
 * Supports the clause-based query structure the module uses:
 *  - contains field:keywords
 *  - exact attribute/field
 *  - folder clause
 *  - subquery
 *  - exists attribute
 */
function getAssetsByQuery(params) {
  // Params can be [query, options] or [query, facets, options]
  // Detect by checking if second param has 'page' or 'data' keys vs 'facets'/'filterMode'
  let query, facets, options;

  if (params.length === 1) {
    [query] = params;
  } else if (params.length === 2) {
    [query, options] = params;
    // If second param looks like facets, shift
    if (options?.facets || options?.filterMode) {
      facets = options;
      options = undefined;
    }
  } else {
    [query, facets, options] = params;
  }

  let results = [...store.assets];

  // Process each clause
  const clauses = query?.query || [];
  for (const clause of clauses) {
    const { operator } = clause;

    if (clause.contains) {
      const { field, attribute, value } = clause.contains;
      const matched = store.searchAssets({ keyword: value });
      const matchedIds = new Set(matched.map(a => a.id));
      if (operator === 'and') {
        results = results.filter(a => matchedIds.has(a.id));
      } else if (operator === 'or') {
        const existing = new Set(results.map(a => a.id));
        matched.forEach(a => { if (!existing.has(a.id)) results.push(a); });
      } else if (operator === 'not') {
        results = results.filter(a => !matchedIds.has(a.id));
      }
    }

    if (clause.exact) {
      const { field, attribute, value } = clause.exact;
      const attrName = attribute || field;
      const matched = store.searchAssets({ attributeName: attrName, attributeValue: value, exact: true });
      const matchedIds = new Set(matched.map(a => a.id));
      if (operator === 'and') {
        results = results.filter(a => matchedIds.has(a.id));
      } else if (operator === 'or') {
        const existing = new Set(results.map(a => a.id));
        matched.forEach(a => { if (!existing.has(a.id)) results.push(a); });
      } else if (operator === 'not') {
        results = results.filter(a => !matchedIds.has(a.id));
      }
    }

    if (clause.folder) {
      const { folderId, recursive } = clause.folder;
      const matched = store.getAssetsByFolderId(folderId, recursive);
      const matchedIds = new Set(matched.map(a => a.id));
      if (operator === 'and') {
        results = results.filter(a => matchedIds.has(a.id));
      } else if (operator === 'or') {
        const existing = new Set(results.map(a => a.id));
        matched.forEach(a => { if (!existing.has(a.id)) results.push(a); });
      } else if (operator === 'not') {
        results = results.filter(a => !matchedIds.has(a.id));
      }
    }

    if (clause.exists) {
      const { attribute } = clause.exists;
      if (operator === 'and') {
        results = results.filter(a => a.attributes?.[attribute]?.length > 0);
      }
    }

    if (clause.subquery) {
      // Recursively process subquery
      const subResult = getAssetsByQuery([clause.subquery]);
      const matchedIds = new Set(subResult.results.map(a => a.id));
      if (operator === 'and') {
        results = results.filter(a => matchedIds.has(a.id));
      }
    }
  }

  return paginate(results, getPageOpts(options));
}

// ─── Collection Methods ───────────────────────────────────────────────────────

/**
 * createCollection(collectionData, assetIds, options)
 */
function createCollection(params) {
  const [collectionData, assetIds = []] = params;
  return store.createCollection(collectionData, assetIds);
}

/**
 * deleteCollection(collectionId)
 */
function deleteCollection(params) {
  const [collectionId] = params;
  if (!store.deleteCollection(collectionId)) throw new Error(`Collection ${collectionId} not found`);
  return {};
}

/**
 * getCollection(collectionId, options)
 */
function getCollection(params) {
  const [collectionId] = params;
  const col = store.getCollectionById(collectionId);
  if (!col) throw new Error(`Collection ${collectionId} not found`);
  const { assetIds, ...rest } = col;
  return rest;
}

/**
 * getCollections(options)
 */
function getCollections(params) {
  const [options] = params;
  const cols = store.collections.map(({ assetIds, ...rest }) => rest);
  return paginate(cols, getPageOpts(options));
}

/**
 * updateCollection(collectionData, assetIds, options)
 */
function updateCollection(params) {
  const [collectionData, assetIds = []] = params;
  const updated = store.updateCollection(collectionData, assetIds);
  if (!updated) throw new Error(`Collection ${collectionData.id} not found`);
  const { assetIds: _, ...rest } = updated;
  return rest;
}

/**
 * getAssetsByCollection(collectionId, options)
 */
function getAssetsByCollection(params) {
  const [collectionId, options] = params;
  const assets = store.getAssetsByCollectionId(collectionId);
  if (!assets) throw new Error(`Collection ${collectionId} not found`);
  return paginate(assets, getPageOpts(options));
}

// ─── User/Group Methods (stubs) ───────────────────────────────────────────────
// The module doesn't use these, but they're included for completeness.

const mockUser = { userId: 1, username: 'dev-user', userType: 9, firstName: 'Dev', lastName: 'User', email: 'dev@example.com', organization: 'Mock', password1: null, password2: null };

function getSelf() { return mockUser; }
function getUser(params) { return { ...mockUser, userId: Number(params[0]) || 1 }; }
function getUsersByGroup(params) { return paginate([mockUser], getPageOpts(params[1])); }
function getGroup(params) { return { groupId: Number(params[0]) || 1, name: 'dev-group' }; }
function getGroupsByUser(params) { return paginate([{ groupId: 1, name: 'dev-group' }], getPageOpts(params[1])); }

// Misc
function getLocations(params) {
  return paginate([
    { locationId: 1, name: 'Internal Repository', locationType: 1001, defaultLocation: 1, active: 1 },
  ], getPageOpts(params[0]));
}

// ─── Export ───────────────────────────────────────────────────────────────────

module.exports = {
  // Assets
  getAssets,
  updateAsset,
  getAssetsByFolder,
  addAssetToFolder,
  removeAssetFromFolder,
  deleteAsset,

  // Folders
  getFolderById,
  getFoldersByParent,
  getFoldersByNameFilter,
  getFolderByPath,
  createFolder,
  createFolderFromPath,
  updateFolder,
  deleteFolder,

  // Attributes
  getAttributes,
  getAssetAttributes,
  setAssetAttributes,
  getValuesByAttribute,

  // Search
  getAssetsByQuery,

  // Collections
  createCollection,
  deleteCollection,
  getCollection,
  getCollections,
  updateCollection,
  getAssetsByCollection,

  // Users & Groups
  getSelf,
  getUser,
  getUsersByGroup,
  getGroup,
  getGroupsByUser,

  // Misc
  getLocations,
};
