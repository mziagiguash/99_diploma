const crypto = require('crypto');

function checkTelegramAuth(data) {
  const secret = crypto.createHash('sha256').update(process.env.TELEGRAM_BOT_TOKEN).digest();
  const checkHash = data.hash;

  const dataCheckString = Object.keys(data)
    .filter(key => key !== 'hash')
    .sort()
    .map(key => `${key}=${data[key]}`)
    .join('\n');

  const hmac = crypto.createHmac('sha256', secret).update(dataCheckString).digest('hex');

  // Важно: Telegram присылает hash в hex, сравниваем в нижнем регистре
  return hmac === checkHash;
}

module.exports = checkTelegramAuth;
