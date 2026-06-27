const { Client, Databases } = require('node-appwrite');

const ENDPOINT = process.env.APPWRITE_ENDPOINT   || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT  = process.env.APPWRITE_PROJECT_ID  || '6a2bc15c00065b3c91a0';
const API_KEY  = process.env.APPWRITE_API_KEY     || '';
const DB       = 'growthgenie';
const COLL     = 'campaigns';

const FIELD = { skull: 'reactSkull', fire: 'reactFire', laugh: 'reactLaugh' };

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const { campaignId, reaction } = req.body || {};
  if (!campaignId || !FIELD[reaction]) {
    return res.status(400).json({ error: 'Invalid campaignId or reaction' });
  }

  const field = FIELD[reaction];
  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
  const db = new Databases(client);

  try {
    const doc    = await db.getDocument(DB, COLL, campaignId);
    const newVal = (doc[field] || 0) + 1;
    await db.updateDocument(DB, COLL, campaignId, { [field]: newVal });
    return res.status(200).json({ [field]: newVal, total: newVal });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
