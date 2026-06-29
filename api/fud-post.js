const { Client, Databases, ID, Query } = require('node-appwrite');
const crypto = require('crypto');

const ENDPOINT = process.env.APPWRITE_ENDPOINT   || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT  = process.env.APPWRITE_PROJECT_ID  || '6a2bc15c00065b3c91a0';
const API_KEY  = process.env.APPWRITE_API_KEY     || '';
const DB       = 'growthgenie';
const COLL     = 'fud_posts';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
  const db     = new Databases(client);

  try {
    if (req.method === 'GET') {
      const campaignId = req.query?.campaignId;
      if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });
      const r = await db.listDocuments(DB, COLL, [
        Query.equal('campaignId', campaignId),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ]);
      return res.status(200).json(r);
    }

    if (req.method === 'POST') {
      const body   = req.body || {};
      const action = body.action;

      if (action === 'submit') {
        const { campaignId, username, wallet, xHandle, tweetUrl } = body;
        if (!campaignId || (!username && !wallet))
          return res.status(400).json({ error: 'Missing campaignId or identity' });
        const doc = await db.createDocument(DB, COLL, ID.unique(), {
          campaignId,
          username:     (username || 'anon').slice(0, 32),
          wallet:       (wallet   || '').slice(0, 64),
          xHandle:      (xHandle  || '').slice(0, 64),
          tweetUrl:     (tweetUrl || '').slice(0, 512),
          tipsReceived: '0',
          tipCount:     0,
          timestamp:    Math.floor(Date.now() / 1000),
        });
        return res.status(201).json(doc);
      }

      if (action === 'tip') {
        const { postId, amount } = body;
        if (!postId || !amount) return res.status(400).json({ error: 'Missing postId or amount' });
        const existing = await db.getDocument(DB, COLL, postId);
        const prev     = parseFloat(existing.tipsReceived || '0');
        const updated  = await db.updateDocument(DB, COLL, postId, {
          tipsReceived: (prev + parseFloat(amount)).toFixed(4),
          tipCount:     (existing.tipCount || 0) + 1,
        });
        return res.status(200).json(updated);
      }

      if (action === 'delete') {
        const { postId, pubkey } = body;
        if (!postId || !pubkey) return res.status(400).json({ error: 'Missing postId or pubkey' });
        const auth  = req.headers['authorization'] || '';
        const token = auth.replace(/^Bearer\s+/i, '').trim();
        const expected = crypto.createHmac('sha256', API_KEY || 'fudfun-fallback-secret').update(pubkey).digest('hex');
        try {
          if (!crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected)))
            return res.status(401).json({ error: 'Invalid token' });
        } catch {
          return res.status(401).json({ error: 'Invalid token' });
        }
        const post = await db.getDocument(DB, COLL, postId);
        if (post.wallet !== pubkey) return res.status(403).json({ error: 'Not your post' });
        await db.deleteDocument(DB, COLL, postId);
        return res.status(200).json({ success: true });
      }

      return res.status(400).json({ error: 'Unknown action' });
    }

    return res.status(405).end();
  } catch (e) {
    console.error('fud-post error:', e.message);
    return res.status(500).json({ error: e.message });
  }
};
