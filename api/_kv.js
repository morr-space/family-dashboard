// 공용 도우미: Upstash Redis(REST) 접속과 인증 토큰 계산
const crypto = require('crypto');

const KV_URL = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
const PIN = process.env.DASHBOARD_PIN;

const configured = () => Boolean(KV_URL && KV_TOKEN && PIN);

async function kv(commands) {
  const r = await fetch(KV_URL.replace(/\/$/, '') + '/pipeline', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + KV_TOKEN, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!r.ok) throw new Error('kv ' + r.status);
  const out = await r.json();
  return out.map((x) => {
    if (x.error) throw new Error(x.error);
    return x.result;
  });
}

// PIN이 바뀌면 토큰도 자동으로 무효가 됩니다.
const tokenFor = () => crypto.createHmac('sha256', KV_TOKEN).update('fd:v1:' + PIN).digest('hex');

const same = (a, b) => {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
};

const authed = (req) => same(req.headers['x-fd-token'] || '', tokenFor());

module.exports = { kv, configured, tokenFor, authed, same, PIN };
