const nacl = require('tweetnacl');
const bs58 = require('bs58');

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const { pubkey, signature, message } = req.body || {};
  if (!pubkey || !signature || !message) {
    return res.status(400).json({ error: 'Missing pubkey, signature or message' });
  }

  try {
    const pubkeyBytes = Buffer.from(bs58.decode(pubkey));
    const sigBytes    = Buffer.from(signature, 'base64');
    const msgBytes    = Buffer.from(message, 'utf8');
    const valid       = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
    if (!valid) return res.status(401).json({ error: 'Invalid signature' });
  } catch (e) {
    return res.status(401).json({ error: 'Verification failed: ' + e.message });
  }

  return res.status(200).json({ verified: true, pubkey, _v: 5 });
};
