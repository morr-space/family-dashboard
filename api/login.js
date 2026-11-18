// POST /api/login {pin} → {token}. 15분 안에 5번 틀리면 잠시 막습니다.
const { kv, configured, tokenFor, same } = require('./_kv');

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured()) return res.status(503).json({ configured: false });
  if (req.method === 'GET') return res.status(200).json({ configured: true });
  if (req.method !== 'POST') return res.status(405).end();
  try {
    const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
    const failKey = 'fd:fail:' + ip;
    const [fails] = await kv([['GET', failKey]]);
    if (Number(fails) >= 5) return res.status(429).json({ error: 'wait' });
    const pin = String((req.body && req.body.pin) || '');
    if (!same(pin, process.env.DASHBOARD_PIN)) {
      await kv([['INCR', failKey], ['EXPIRE', failKey, '900']]);
      return res.status(401).json({ error: 'bad' });
    }
    await kv([['DEL', failKey]]);
    return res.status(200).json({ token: tokenFor() });
  } catch (e) {
    return res.status(500).json({ error: 'server' });
  }
};
