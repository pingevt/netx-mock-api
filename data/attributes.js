/**
 * Seed data - Attributes & Collections
 */

const attributeDefinitions = [
  { id: 1001, name: 'Description', type: 'TEXT',     defaultValue: '', isMultivalue: false, modDate: Date.now() },
  { id: 1002, name: 'Tags',        type: 'TAG',      defaultValue: '', isMultivalue: true,  modDate: Date.now() },
  { id: 1003, name: 'Status',      type: 'PULLDOWN', defaultValue: 'Draft', isMultivalue: false, modDate: Date.now() },
  { id: 1004, name: 'Photographer',type: 'TEXT',     defaultValue: '', isMultivalue: false, modDate: Date.now() },
  { id: 1005, name: 'Copyright',   type: 'TEXT',     defaultValue: '', isMultivalue: false, modDate: Date.now() },
  { id: 1006, name: 'Web-Enterprise UUID', type: 'TEXT', defaultValue: '', isMultivalue: false, modDate: Date.now() },
];

const attributeValues = {
  1003: ['Draft', 'Published', 'Archived'],
  1002: ['landscape', 'portrait', 'logo', 'brand', 'video', 'pdf', 'sunrise', 'forest', 'coast', 'mountain', 'studio'],
};

const collections = [
  {
    id: 1,
    title: 'Brand Assets',
    itemCount: 4,
    assetIds: [301, 302, 501, 401],
    permissions: { read: true, write: true, delete: true },
  },
  {
    id: 2,
    title: 'Landscape Photography',
    itemCount: 3,
    assetIds: [101, 102, 103],
    permissions: { read: true, write: true, delete: false },
  },
];

module.exports = { attributeDefinitions, attributeValues, collections };
