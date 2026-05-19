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
  { id: 1007, name: 'Color',       type: 'PULLDOWN', defaultValue: '', isMultivalue: false, modDate: Date.now() },
  { id: 1008, name: 'Usage Rights', type: 'PULLDOWN', defaultValue: 'Internal', isMultivalue: false, modDate: Date.now() },
  { id: 1009, name: 'Campaign',    type: 'TEXT',     defaultValue: '', isMultivalue: false, modDate: Date.now() },
  { id: 1010, name: 'Market',      type: 'TAG',      defaultValue: '', isMultivalue: true, modDate: Date.now() },
  { id: 1011, name: 'Priority',    type: 'PULLDOWN', defaultValue: 'Medium', isMultivalue: false, modDate: Date.now() },
];

const attributeValues = {
  1003: ['Draft', 'Published', 'Archived'],
  1002: ['landscape', 'portrait', 'logo', 'brand', 'video', 'pdf', 'sunrise', 'forest', 'coast', 'mountain', 'studio'],
  1007: ['Red', 'Orange', 'Yellow', 'Green', 'Blue', 'Purple', 'Black', 'White'],
  1008: ['Internal', 'Public', 'Licensed', 'Editorial'],
  1010: ['NA', 'EMEA', 'APAC', 'LATAM'],
  1011: ['Low', 'Medium', 'High', 'Urgent'],
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
