/**
 * Default webhook subscriptions seed
 *
 * Loaded when .data/webhooks.json does not exist yet. Edit that file (and
 * restart) to change subscribers afterwards.
 *
 * Event types are NetX's UPPER_SNAKE_CASE names. A subscription's optional
 * "secret" is sent as the body "token", like NetX does.
 *
 * The seed subscription is disabled unless WEBHOOK_URL is set, so a fresh
 * checkout never posts to a URL that was only right for one machine. Point it
 * at your Drupal site, for example:
 *
 *   WEBHOOK_URL=https://my-site.ddev.site/netx-dam/webhook/mock npm start
 *
 * and set WEBHOOK_SECRET to the value stored in the module's webhook secret key.
 */

const url = process.env.WEBHOOK_URL || 'http://localhost/netx-dam/webhook/mock';

module.exports = {
  webhooks: [
    {
      id: 1,
      name: 'Drupal (netx_dam_webhooks)',
      url,
      secret: process.env.WEBHOOK_SECRET || 'dev-webhook-secret',
      events: [
        'ASSET_CREATE',
        'ASSET_DELETE',
        'ASSET_CHECKIN',
        'ASSET_CHECKOUT',
        'ASSET_EXPIRE',
        'ASSET_ADDTOFOLDER',
        'ASSET_UPDATEATTRIBUTES',
        'FOLDER_CREATE',
        'FOLDER_UPDATE',
        'USER_CREATE',
        'USER_EXPIRE',
        'USER_UPDATE',
      ],
      enabled: Boolean(process.env.WEBHOOK_URL),
    },
  ],
};
