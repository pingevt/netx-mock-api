/**
 * Webhook sender handler
 *
 * Manages webhook subscriptions and outbound delivery.
 *
 * Routes:
 *   GET  /api/webhooks               → list all subscriptions
 *   POST /api/webhooks/trigger       → manually fire an event (auth required)
 *
 * Payload shape (matches NetX webhook delivery format, with lowercase event
 * types for compatibility with Drupal's NetxWebhookEventType enum):
 *
 *   {
 *     "event": {
 *       "assetId": 101,              // present for asset events
 *       "folderId": 6,               // present for folder events
 *       "systemEventType": "asset_create",
 *       "eventId": "<uuid>",
 *       "eventTime": 1674076946,
 *       "userId": 1
 *     },
 *     "token": "dev-token-1234",
 *     "messageTime": 1674076946,
 *     "messageId": "<uuid>",
 *     "subscriptionId": 1
 *   }
 *
 * TODO: Add HMAC-SHA256 signature header (X-NetX-Signature) using a per-
 *       subscription secret so Drupal can verify the sender.
 * TODO: Add retry schedule (5m, 30m, 30m, 12h, 24h) matching NetX behavior.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

const PERSIST_DIR = process.env.PERSIST_DATA_DIR || path.join(__dirname, '..', '.data');
const CONFIG_FILE = path.join(PERSIST_DIR, 'webhooks.json');
const { webhooks: SEED_WEBHOOKS } = require('../data/webhooks');

// ─── All supported event types ─────────────────────────────────────────────
// Values are lowercase to match Drupal's NetxWebhookEventType enum.
// NetX production docs use UPPER_SNAKE_CASE — keep that in mind if integrating
// with a real NetX server.
const EVENT_TYPES = [
  'asset_create',
  'asset_delete',
  'asset_addtofolder',
  'asset_checkin',
  'asset_checkout',
  'asset_expire',
  'asset_updateattributes',
  'folder_create',
  'folder_update',
  'user_create',
  'user_expire',
  'user_update',
];

// ─── Config persistence ────────────────────────────────────────────────────

function loadConfig() {
  try {
    fs.mkdirSync(PERSIST_DIR, { recursive: true });
    if (!fs.existsSync(CONFIG_FILE)) {
      return SEED_WEBHOOKS.map(w => ({ ...w }));
    }
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (err) {
    console.warn('[Webhook] Failed to load config, using seed:', err.message);
    return SEED_WEBHOOKS.map(w => ({ ...w }));
  }
}

function saveConfig(subscriptions) {
  try {
    fs.mkdirSync(PERSIST_DIR, { recursive: true });
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(subscriptions, null, 2));
  } catch (err) {
    console.warn('[Webhook] Failed to save config:', err.message);
  }
}

// ─── Envelope builder ──────────────────────────────────────────────────────

function buildEnvelope(eventType, context, subscriptionId, token) {
  const now = Math.floor(Date.now() / 1000);
  const event = {
    systemEventType: eventType,
    eventId: uuidv4(),
    eventTime: now,
    userId: context.userId || 1,
  };

  if (context.assetId !== undefined) event.assetId = Number(context.assetId);
  if (context.folderId !== undefined) event.folderId = Number(context.folderId);

  return {
    event,
    token: token || (process.env.NETX_API_TOKEN || 'dev-token-1234'),
    messageTime: now,
    messageId: uuidv4(),
    subscriptionId,
  };
}

// ─── HTTP delivery ─────────────────────────────────────────────────────────

async function deliver(subscription, envelope) {
  const start = Date.now();
  const result = {
    subscriptionId: subscription.id,
    name: subscription.name,
    url: subscription.url,
    status: null,
    ok: false,
    durationMs: 0,
    error: null,
  };

  try {
    const response = await fetch(subscription.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'User-Agent': 'NetX-Mock-Webhook/1.0',
        // TODO: add X-NetX-Signature header with HMAC-SHA256 of body
      },
      body: JSON.stringify(envelope),
      signal: AbortSignal.timeout(10000),
    });

    result.status = response.status;
    result.ok = response.ok;
  } catch (err) {
    result.error = err.message;
  }

  result.durationMs = Date.now() - start;
  return result;
}

// ─── Core send function ────────────────────────────────────────────────────

async function sendWebhook(eventType, context = {}) {
  const subscriptions = loadConfig();
  const active = subscriptions.filter(
    s => s.enabled && (s.events.includes(eventType) || s.events.includes('*'))
  );

  const results = await Promise.all(
    active.map(sub => {
      const envelope = buildEnvelope(eventType, context, sub.id);
      console.log(`[Webhook] Firing ${eventType} → ${sub.url}`);
      return deliver(sub, envelope);
    })
  );

  results.forEach(r => {
    const icon = r.ok ? '✓' : '✗';
    const detail = r.error || `HTTP ${r.status}`;
    console.log(`[Webhook]   ${icon} ${r.name}: ${detail} (${r.durationMs}ms)`);
  });

  return results;
}

module.exports.sendWebhook = sendWebhook;
module.exports.EVENT_TYPES = EVENT_TYPES;

// ─── Routes ────────────────────────────────────────────────────────────────

// GET /api/webhooks — list subscriptions (no auth — safe for dashboard display)
router.get('/', (req, res) => {
  res.json({
    subscriptions: loadConfig(),
    eventTypes: EVENT_TYPES,
  });
});

// POST /api/webhooks/trigger — manually fire an event (requires apiToken header)
//
// Body: { "event": "asset_create", "context": { "assetId": 101 } }
router.post('/trigger', (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.replace(/^apiToken\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Missing Authorization header' });
  if (process.env.STRICT_AUTH === 'true') {
    const expected = process.env.NETX_API_TOKEN || 'dev-token-1234';
    if (token !== expected) return res.status(401).json({ error: 'Invalid API token' });
  }
  next();
}, async (req, res) => {
  const { event: eventType, context = {} } = req.body;

  if (!eventType) {
    return res.status(400).json({ error: 'event is required' });
  }

  if (!EVENT_TYPES.includes(eventType)) {
    return res.status(400).json({
      error: `Unknown event type: ${eventType}`,
      validTypes: EVENT_TYPES,
    });
  }

  try {
    const results = await sendWebhook(eventType, context);
    res.json({ fired: true, event: eventType, context, results });
  } catch (err) {
    console.error('[Webhook] Trigger error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports.router = router;
