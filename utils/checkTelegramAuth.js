const crypto = require('crypto');

function checkTelegramAuth(data) {
  const { hash, ...rest } = data;
  const token = process.env.TELEGRAM_BOT_TOKEN;

  const secret = crypto.createHash('sha256').update(token).digest();
  const sorted = Object.keys(rest)
    .sort()
    .map(key => `${key}=${rest[key]}`)
    .join('\n');

  const hmac = crypto
    .createHmac('sha256', secret)
    .update(sorted)
    .digest('hex');

  return hmac === hash;
}

module.exports = checkTelegramAuth;
