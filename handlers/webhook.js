/**
 * Webhook sender handler
 *
 * Manages webhook subscriptions and outbound delivery.
 *
 * Routes:
 *   GET  /api/webhooks               → list all subscriptions
 *   POST /api/webhooks/trigger       → manually fire an event (auth required)
 *
 * Payload shape, modeled on NetX's documented webhook delivery
 * (https://support.netx.net/hc/en-us/articles/11766295044119-Webhooks):
 *
 *   {
 *     "event": {
 *       "assetId": 101,              // asset events only
 *       "folderId": 6,               // folder events only
 *       "systemEventType": "ASSET_CREATE",
 *       "eventId": "<uuid>",
 *       "eventTime": 1674076946,     // epoch seconds
 *       "userId": 1
 *     },
 *     "token": "<subscription secret>",   // only when the subscription has one
 *     "messageTime": 1674076946,
 *     "messageId": "<uuid>",
 *     "subscriptionId": 1
 *   }
 *
 * NetX has no signature header. The optional shared secret travels in the
 * body as "token", so a receiver authenticates by comparing that value.
 *
 * Not implemented: NetX's retry schedule (immediately, 5m, 30m, 30m, 12h,
 * 24h) and its habit of disabling a webhook after the last failed retry.
 * This mock delivers once.
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
// NetX sends systemEventType in UPPER_SNAKE_CASE (e.g. ASSET_CREATE). Input to
// this mock is matched case-insensitively, but deliveries always use these.
const EVENT_TYPES = [
  'ASSET_CREATE',
  'ASSET_DELETE',
  'ASSET_ADDTOFOLDER',
  'ASSET_CHECKIN',
  'ASSET_CHECKOUT',
  'ASSET_EXPIRE',
  'ASSET_UPDATEATTRIBUTES',
  'FOLDER_CREATE',
  'FOLDER_UPDATE',
  'USER_CREATE',
  'USER_EXPIRE',
  'USER_UPDATE',
];

function normalizeEventType(value) {
  return String(value || '').trim().toUpperCase();
}

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

function buildEnvelope(eventType, context, subscriptionId, secret) {
  const now = Math.floor(Date.now() / 1000);
  const event = {
    systemEventType: eventType,
    eventId: uuidv4(),
    eventTime: now,
    userId: context.userId || 1,
  };

  if (context.assetId !== undefined) event.assetId = Number(context.assetId);
  if (context.folderId !== undefined) event.folderId = Number(context.folderId);

  const envelope = {
    event,
    messageTime: now,
    messageId: uuidv4(),
    subscriptionId,
  };
  // The secret is optional on the NetX side, so the token is only sent when
  // the subscription has one.
  if (secret) envelope.token = secret;
  return envelope;
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
  const type = normalizeEventType(eventType);
  const active = subscriptions.filter(
    s => s.enabled && (s.events.includes('*') || s.events.map(normalizeEventType).includes(type))
  );

  const results = await Promise.all(
    active.map(sub => {
      const envelope = buildEnvelope(type, context, sub.id, sub.secret);
      console.log(`[Webhook] Firing ${type} → ${sub.url}`);
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
    subscriptions: loadConfig().map(({ secret, ...rest }) => ({ ...rest, hasSecret: Boolean(secret) })),
    eventTypes: EVENT_TYPES,
  });
});

// POST /api/webhooks/trigger — manually fire an event (requires apiToken header)
//
// Body: { "event": "ASSET_CREATE", "context": { "assetId": 101 } }
// The event name is case-insensitive.
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
  const { event, context = {} } = req.body;
  const eventType = normalizeEventType(event);

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
