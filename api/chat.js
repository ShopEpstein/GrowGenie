const { Client, Databases, Query, ID } = require('node-appwrite');

const ENDPOINT = process.env.APPWRITE_ENDPOINT   || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT  = process.env.APPWRITE_PROJECT_ID || '6a2bc15c00065b3c91a0';
const API_KEY  = process.env.APPWRITE_API_KEY    || '';
const DB       = 'growthgenie';
const COLL     = 'war_room';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
  const dbs    = new Databases(client);

  if (req.method === 'GET') {
    const { campaignId } = req.query || {};
    if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });
    try {
      const r = await dbs.listDocuments(DB, COLL, [
        Query.equal('campaignId', campaignId),
        Query.orderAsc('timestamp'),
        Query.limit(100),
      ]);
      return res.status(200).json({ messages: r.documents });
    } catch {
      return res.status(200).json({ messages: [] });
    }
  }

  if (req.method === 'POST') {
    const { campaignId, message, username, wallet } = req.body || {};
    if (!campaignId || !message || !username) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    const clean = message.trim().slice(0, 280);
    if (!clean) return res.status(400).json({ error: 'Empty message' });
    try {
      const doc = await dbs.createDocument(DB, COLL, ID.unique(), {
        campaignId,
        message:   clean,
        username:  username.slice(0, 24),
        wallet:    (wallet || '').slice(0, 64),
        timestamp: Math.floor(Date.now() / 1000),
      });
      return res.status(200).json({ success: true, message: doc });
    } catch (e) {
      return res.status(500).json({ error: e.message });
    }
  }

  return res.status(405).end();
};
