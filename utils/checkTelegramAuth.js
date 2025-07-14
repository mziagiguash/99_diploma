const crypto = require('crypto');

function checkTelegramAuth(data) {
  const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const checkHash = data.hash;

  const sorted = Object.keys(data)
    .filter(k => k !== 'hash')
    .sort()
    .map(k => `${k}=${data[k]}`)
    .join('\n');

  const hmac = crypto.createHmac('sha256', secret).update(sorted).digest('hex');
  return hmac === checkHash;
}

module.exports = checkTelegramAuth;
