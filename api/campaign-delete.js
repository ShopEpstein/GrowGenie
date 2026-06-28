const { Client, Account, Databases } = require('node-appwrite');

const ENDPOINT = process.env.APPWRITE_ENDPOINT   || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT  = process.env.APPWRITE_PROJECT_ID || '6a2bc15c00065b3c91a0';
const API_KEY  = process.env.APPWRITE_API_KEY    || '';
const DB       = 'growthgenie';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  // Verify session JWT
  const auth = req.headers['authorization'] || '';
  const jwt  = auth.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) return res.status(401).json({ error: 'Missing auth token' });

  const sessionClient = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setJWT(jwt);
  const user = await new Account(sessionClient).get().catch(() => null);
  if (!user) return res.status(401).json({ error: 'Invalid session' });

  const { campaignId } = req.body || {};
  if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });

  // Fetch the campaign with admin SDK and verify ownership
  const adm = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
  const dbs = new Databases(adm);

  let doc;
  try {
    doc = await dbs.getDocument(DB, 'campaigns', campaignId);
  } catch {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  if (doc.clientId !== user.$id) {
    return res.status(403).json({ error: 'Not your campaign' });
  }

  await dbs.deleteDocument(DB, 'campaigns', campaignId);
  return res.status(200).json({ success: true });
};
