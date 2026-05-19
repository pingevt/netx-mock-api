/**
 * Image generator for mock asset files
 *
 * Generates unique images for each asset ID with distinct colors and patterns.
 * Caches generated images in memory to avoid regeneration.
 */

const sharp = require('sharp');

// Cache for generated images: { `${assetId}_${size}`: Buffer }
const imageCache = new Map();

/**
 * Get a deterministic color palette based on asset ID
 */
function getColorPalette(assetId) {
  const palettes = [
    { bg: '#FF6B6B', accent: '#FFE66D', text: '#FFFFFF' }, // Red/Yellow
    { bg: '#4ECDC4', accent: '#44A08D', text: '#FFFFFF' }, // Teal
    { bg: '#45B7D1', accent: '#96CEB4', text: '#FFFFFF' }, // Blue/Green
    { bg: '#F38181', accent: '#AA96DA', text: '#FFFFFF' }, // Pink/Purple
    { bg: '#95E1D3', accent: '#F38181', text: '#000000' }, // Mint/Pink
    { bg: '#FCBAD3', accent: '#A8E6CF', text: '#000000' }, // Rose/Green
    { bg: '#FFD3B6', accent: '#FFAAA5', text: '#000000' }, // Peach/Coral
    { bg: '#8EC5FC', accent: '#E0C3FC', text: '#FFFFFF' }, // Blue/Purple
    { bg: '#F6D5A8', accent: '#F7938F', text: '#000000' }, // Gold/Coral
    { bg: '#A8D8EA', accent: '#AA96DA', text: '#FFFFFF' }, // Sky/Purple
  ];
  return palettes[assetId % palettes.length];
}

/**
 * Generate a gradient SVG background
 */
function createGradientSvg(width, height, palette, assetId) {
  const gradientId = `grad-${assetId}`;
  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${gradientId}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${palette.bg};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${palette.accent};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#${gradientId})" />
    </svg>
  `;
}

/**
 * Add geometric patterns to SVG
 */
function addPatterns(svg, width, height, assetId) {
  const patterns = [
    // Circles
    () => {
      let circles = '';
      for (let i = 0; i < 15; i++) {
        const x = Math.sin(assetId + i) * width;
        const y = Math.cos(assetId - i) * height;
        const r = 20 + ((assetId * i) % 40);
        const opacity = 0.1 + ((assetId + i) % 10) / 20;
        circles += `<circle cx="${Math.abs(x) % width}" cy="${Math.abs(y) % height}" r="${r}" fill="white" opacity="${opacity}" />`;
      }
      return circles;
    },
    // Wavy lines
    () => {
      let lines = '';
      for (let i = 0; i < 5; i++) {
        const amplitude = 20 + ((assetId + i) % 40);
        const frequency = 0.01 + ((assetId - i) % 5) * 0.01;
        let path = 'M';
        for (let x = 0; x < width; x += 20) {
          const y = height / 2 + amplitude * Math.sin(x * frequency + assetId);
          path += `${x},${Math.round(y)} `;
        }
        lines += `<path d="${path}" stroke="white" stroke-width="2" fill="none" opacity="0.15" />`;
      }
      return lines;
    },
    // Diagonal stripes
    () => {
      let stripes = '';
      const stripeWidth = 30 + ((assetId) % 20);
      for (let i = -height; i < width; i += stripeWidth) {
        stripes += `<line x1="${i}" y1="0" x2="${i + height}" y2="${height}" stroke="white" stroke-width="8" opacity="0.1" />`;
      }
      return stripes;
    },
  ];

  const pattern = patterns[assetId % patterns.length];
  return svg.replace('</svg>', `${pattern()}</svg>`);
}

/**
 * Generate a unique image for an asset
 *
 * @param {number} assetId - Asset ID (used for deterministic generation)
 * @param {number} width - Image width in pixels
 * @param {number} height - Image height in pixels
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function generateImage(assetId, width, height) {
  const cacheKey = `${assetId}_${width}x${height}`;

  // Return from cache if available
  if (imageCache.has(cacheKey)) {
    return imageCache.get(cacheKey);
  }

  try {
    const palette = getColorPalette(assetId);
    let svg = createGradientSvg(width, height, palette, assetId);
    svg = addPatterns(svg, width, height, assetId);

    // Render SVG and convert to PNG
    const buffer = await sharp(Buffer.from(svg))
      .png()
      .toBuffer();

    // Cache the result
    imageCache.set(cacheKey, buffer);
    return buffer;
  } catch (error) {
    console.error(`Error generating image for asset ${assetId}:`, error);
    // Return a minimal fallback 1x1 PNG
    return Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );
  }
}

/**
 * Get image for a specific proxy type
 *
 * @param {number} assetId - Asset ID
 * @param {string} proxyName - 'Thumbnail', 'Preview', or 'Zoom'
 * @param {object} assetData - Asset data object with file dimensions
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function getImageForProxy(assetId, proxyName, assetData) {
  // Look up the dimensions from the asset's proxies
  const proxy = assetData.proxies?.find(p => p.name === proxyName);

  if (!proxy || !proxy.file) {
    // Fallback to default sizes
    const sizes = {
      Thumbnail: { width: 150, height: 150 },
      Preview: { width: 500, height: 500 },
      Zoom: { width: 1200, height: 1200 },
    };
    const size = sizes[proxyName] || { width: 400, height: 300 };
    return generateImage(assetId, size.width, size.height);
  }

  return generateImage(assetId, proxy.file.width, proxy.file.height);
}

/**
 * Clear the image cache (useful for testing)
 */
function clearCache() {
  imageCache.clear();
}

module.exports = {
  generateImage,
  getImageForProxy,
  clearCache,
};
