/**
 * Seed data - Folders
 *
 * Mimics a realistic NetX folder hierarchy.
 * Root is always ID 1.
 */

const folders = [
  {
    id: 1,
    parentId: null,
    name: 'Root',
    description: 'Root folder',
    path: '',
    children: { assetCount: 0, folderCount: 4 },
  },
  {
    id: 2,
    parentId: 1,
    name: 'Images',
    description: 'Photography and images',
    path: 'Images',
    children: { assetCount: 3, folderCount: 2 },
  },
  {
    id: 3,
    parentId: 1,
    name: 'Videos',
    description: 'Video assets',
    path: 'Videos',
    children: { assetCount: 2, folderCount: 0 },
  },
  {
    id: 4,
    parentId: 1,
    name: 'Documents',
    description: 'PDF and document assets',
    path: 'Documents',
    children: { assetCount: 2, folderCount: 0 },
  },
  {
    id: 5,
    parentId: 1,
    name: 'Logos',
    description: 'Brand logos and icons',
    path: 'Logos',
    children: { assetCount: 4, folderCount: 1 },
  },
  {
    id: 6,
    parentId: 2,
    name: 'Landscapes',
    description: 'Landscape photography',
    path: 'Images/Landscapes',
    children: { assetCount: 5, folderCount: 0 },
  },
  {
    id: 7,
    parentId: 2,
    name: 'Portraits',
    description: 'Portrait photography',
    path: 'Images/Portraits',
    children: { assetCount: 3, folderCount: 0 },
  },
  {
    id: 8,
    parentId: 5,
    name: 'SVG',
    description: 'Vector logo files',
    path: 'Logos/SVG',
    children: { assetCount: 2, folderCount: 0 },
  },
];

module.exports = { folders };
