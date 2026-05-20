/**
 * Default webhook subscriptions seed
 *
 * These are loaded when .data/webhooks.json does not yet exist.
 * Event type values match Drupal's NetxWebhookEventType enum (lowercase).
 *
 * Note: NetX production docs show UPPER_SNAKE_CASE (e.g. ASSET_CREATE),
 * but the Drupal module enum uses lowercase (e.g. asset_create).
 * This mock uses lowercase to be compatible with the local Drupal receiver.
 */

module.exports = {
  webhooks: [
    {
      id: 1,
      name: 'Drupal local (DDEV)',
      url: 'http://netx-drupal.ddev.site/webhook/netx',
      events: [
        'asset_create',
        'asset_delete',
        'asset_checkin',
        'asset_checkout',
        'asset_expire',
        'asset_addtofolder',
        'asset_updateattributes',
        'folder_create',
        'folder_update',
        'user_create',
        'user_expire',
        'user_update',
      ],
      enabled: true,
    },
  ],
};
