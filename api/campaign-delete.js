const { Client, Databases } = require('node-appwrite');
const nacl   = require('tweetnacl');
const bs58   = require('bs58');

const ENDPOINT     = process.env.APPWRITE_ENDPOINT   || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT      = process.env.APPWRITE_PROJECT_ID || '6a2bc15c00065b3c91a0';
const API_KEY      = process.env.APPWRITE_API_KEY    || '';
const DB           = 'growthgenie';
const ADMIN_WALLET = '78f1wkpK7gGH7uXvwyybGwSNkPuxEKQxPezVXBGQ7Stb';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { campaignId, pubkey, signature, message } = req.body || {};
  if (!campaignId || !pubkey || !signature || !message) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Verify message is scoped to this campaign to prevent signature replay
  if (message !== `delete:${campaignId}`) {
    return res.status(400).json({ error: 'Invalid delete message' });
  }

  // Verify ed25519 wallet signature
  try {
    const pubkeyBytes = Buffer.from(bs58.decode(pubkey));
    const sigBytes    = Buffer.from(signature, 'base64');
    const msgBytes    = Buffer.from(message, 'utf8');
    if (!nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes)) {
      return res.status(401).json({ error: 'Invalid wallet signature' });
    }
  } catch {
    return res.status(401).json({ error: 'Signature verification failed' });
  }

  const adm = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
  const dbs = new Databases(adm);

  let doc;
  try {
    doc = await dbs.getDocument(DB, 'campaigns', campaignId);
  } catch {
    return res.status(404).json({ error: 'Campaign not found' });
  }

  if (doc.clientId !== pubkey && pubkey !== ADMIN_WALLET) {
    return res.status(403).json({ error: 'Not your campaign' });
  }

  await dbs.deleteDocument(DB, 'campaigns', campaignId);
  return res.status(200).json({ success: true });
};
