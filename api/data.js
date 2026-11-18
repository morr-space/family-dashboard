// GET /api/data?since=버전 → 바뀐 게 있으면 전체 데이터, 없으면 {same:true}
// PUT /api/data {set:{키:값}} → 저장
const { kv, configured, authed } = require('./_kv');

const ALLOW = /^md-(note|cfg3|events|gauge|say|say-custom|prog2|photo-[01])$/;

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!configured()) return res.status(503).json({ configured: false });
  if (!authed(req)) return res.status(401).json({ error: 'auth' });
  try {
    if (req.method === 'GET') {
      const since = String((req.query && req.query.since) || '');
      const [v] = await kv([['GET', 'fd:v']]);
      if (v && since === String(v)) return res.status(200).json({ same: true, v: Number(v) });
      const [all] = await kv([['HGETALL', 'fd:data']]);
      const data = {};
      for (let i = 0; i < all.length; i += 2) data[all[i]] = all[i + 1];
      return res.status(200).json({ v: Number(v || 0), data, empty: all.length === 0 });
    }
    if (req.method === 'PUT') {
      const set = (req.body && req.body.set) || {};
      const cmds = [];
      let size = 0;
      for (const [k, val] of Object.entries(set)) {
        if (!ALLOW.test(k) || typeof val !== 'string') continue;
        size += val.length;
        cmds.push(['HSET', 'fd:data', k, val]);
      }
      if (size > 900000) return res.status(413).json({ error: 'too big' });
      if (!cmds.length) return res.status(200).json({ ok: true });
      const v = Date.now();
      cmds.push(['SET', 'fd:v', String(v)]);
      await kv(cmds);
      return res.status(200).json({ ok: true, v });
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: 'server' });
  }
};
