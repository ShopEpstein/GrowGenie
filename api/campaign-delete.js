const { Client, Databases } = require('node-appwrite');
const crypto = require('crypto');

const ENDPOINT = process.env.APPWRITE_ENDPOINT   || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT  = process.env.APPWRITE_PROJECT_ID || '6a2bc15c00065b3c91a0';
const API_KEY  = process.env.APPWRITE_API_KEY    || '';
const DB       = 'growthgenie';

function expectedToken(pubkey) {
  const secret = API_KEY || 'fudfun-fallback-secret';
  return crypto.createHmac('sha256', secret).update(pubkey).digest('hex');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const auth  = req.headers['authorization'] || '';
  const token = auth.replace(/^Bearer\s+/i, '').trim();
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const { campaignId, pubkey } = req.body || {};
  if (!campaignId || !pubkey) return res.status(400).json({ error: 'Missing campaignId or pubkey' });

  // Verify token is the HMAC we issued at login
  const expected = expectedToken(pubkey);
  if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
    return res.status(401).json({ error: 'Invalid token' });
  }

  const adm = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
  const dbs = new Databases(adm);

  let doc;
  try {
    doc = await dbs.getDocument(DB, 'campaigns', campaignId);
  } catch {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  if (doc.clientId !== pubkey) {
    return res.status(403).json({ error: 'Not your campaign' });
  }

  await dbs.deleteDocument(DB, 'campaigns', campaignId);
  return res.status(200).json({ success: true });
};
