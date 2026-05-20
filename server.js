/**
 * NetX Mock API Server
 *
 * Mimics the NetX DAM JSON-RPC API (https://developer.netx.net/)
 * for local development of the netx_media_source Drupal module.
 *
 * Endpoints:
 *   POST /api/rpc            - JSON-RPC 2.0 API
 *   GET  /api/file/asset/:id              - Download original asset
 *   GET  /api/file/asset/:id/thumbnail    - Asset thumbnail
 *   GET  /api/file/asset/:id/preview      - Asset preview
 *   GET  /api/file/asset/:id/zoom         - Asset zoom
 *   POST /api/import/asset                - Import new asset
 *   PUT  /api/import/asset/:id            - Reimport existing asset
 *   GET  /view/...                        - Proxy file URLs (used by module)
 *
 * Auth: Send any non-empty value as: Authorization: apiToken <token>
 *       Use NETX_API_TOKEN env var to set expected token (default: dev-token-1234)
 */

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const { handleRpc } = require('./handlers/rpc');
const fileRoutes = require('./handlers/files');
const importRoutes = require('./handlers/import');
const { router: webhookRoutes } = require('./handlers/webhook');


const app = express();
const PORT = process.env.PORT || 3000;
const EXPECTED_TOKEN = process.env.NETX_API_TOKEN || 'dev-token-1234';

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(cors());
app.use(morgan('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve placeholder images used as proxy files
app.use('/view', express.static(path.join(__dirname, 'public/view')));
app.use('/zoom', express.static(path.join(__dirname, 'public/view')));
app.use('/file', express.static(path.join(__dirname, 'public/assets')));

// ─── Auth Middleware ──────────────────────────────────────────────────────────

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^apiToken\s+/i, '').trim();

  if (!token) {
    return res.status(401).json({ error: 'Missing Authorization header' });
  }

  // In dev mode accept any non-empty token, or enforce the expected token.
  if (process.env.STRICT_AUTH === 'true' && token !== EXPECTED_TOKEN) {
    return res.status(401).json({ error: 'Invalid API token' });
  }

  req.apiToken = token;
  next();
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// Demo dashboard
app.get('/', (req, res) => {
  res.redirect('/dashboard');
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

// JSON-RPC endpoint
app.post('/api/rpc', requireAuth, handleRpc);

// File retrieval — no auth required (browser img tags need to load these)
app.use('/api/file', fileRoutes);

// Import endpoints
app.use('/api/import', requireAuth, importRoutes);

// Webhook subscriptions (GET /api/webhooks open; POST /api/webhooks/trigger auth-checked in router)
app.use('/api/webhooks', webhookRoutes);

// Health check (no auth required)
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    server: 'NetX Mock API',
    version: '1.0.0',
    token: EXPECTED_TOKEN,
    docs: 'https://developer.netx.net/',
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('');
  console.log('  ┌─────────────────────────────────────────────┐');
  console.log('  │         NetX Mock API Server                │');
  console.log('  ├─────────────────────────────────────────────┤');
  console.log(`  │  URL:   http://localhost:${PORT}               │`);
  console.log(`  │  RPC:   http://localhost:${PORT}/api/rpc        │`);
  console.log(`  │  Demo:  http://localhost:${PORT}/dashboard      │`);
  console.log(`  │  Token: ${EXPECTED_TOKEN}                 │`);
  console.log('  │                                             │');
  console.log('  │  Health: GET /health                        │');
  console.log('  └─────────────────────────────────────────────┘');
  console.log('');
  console.log('  Configure your Drupal NetX Source:');
  console.log(`    API URL:   http://localhost:${PORT}/api/rpc`);
  console.log(`    Base URL:  http://localhost:${PORT}`);
  console.log(`    API Token: ${EXPECTED_TOKEN}`);
  console.log('');
});
