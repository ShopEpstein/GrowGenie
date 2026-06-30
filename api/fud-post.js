const { Client, Databases, ID, Query } = require('node-appwrite');
const nacl   = require('tweetnacl');
const bs58   = require('bs58');

const ENDPOINT     = process.env.APPWRITE_ENDPOINT   || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT      = process.env.APPWRITE_PROJECT_ID  || '6a2bc15c00065b3c91a0';
const API_KEY      = process.env.APPWRITE_API_KEY     || '';
const DB           = 'growthgenie';
const COLL         = 'fud_posts';
const ADMIN_WALLET = '78f1wkpK7gGH7uXvwyybGwSNkPuxEKQxPezVXBGQ7Stb';

async function aiModerate(text) {
  if (!process.env.GROQ_API_KEY || !text) return { allowed: true };
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
      body: JSON.stringify({
        model: 'llama-3.1-8b-instant',
        max_tokens: 64,
        messages: [
          { role: 'system', content: 'You are a minimal content filter for FudFun.xyz. BLOCK only: child sexual abuse material (CSAM), explicit pornography/nudity, or links to such content. ALLOW absolutely everything else — FUD, smear campaigns, insults, accusations of fraud or scamming, crypto criticism, political attacks, threats to reputations, misinformation, hate, profanity, personal attacks on named individuals. The platform is a paid FUD and cancel-culture service. Your ONLY job is to catch sexual content involving minors or explicit porn. If in doubt, respond {"allowed":true}. Respond ONLY with valid JSON: {"allowed":true} or {"allowed":false,"reason":"..."}' },
          { role: 'user',   content: text.slice(0, 500) },
        ],
      }),
    });
    if (!r.ok) return { allowed: true };
    const j = await r.json();
    return JSON.parse(j.choices?.[0]?.message?.content?.trim() || '{"allowed":true}');
  } catch { return { allowed: true }; }
}

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
        // AI moderation on the tweet URL / content
        const mod = await aiModerate(tweetUrl || username || '');
        if (!mod.allowed) return res.status(422).json({ error: mod.reason || 'Content not allowed' });
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
        const { postId, pubkey, signature, message, adminKey } = body;
        if (!postId) return res.status(400).json({ error: 'Missing postId' });

        // Admin secret bypass — no wallet signature required
        const ADMIN_SECRET = process.env.ADMIN_SECRET || '';
        if (ADMIN_SECRET && adminKey === ADMIN_SECRET) {
          await db.deleteDocument(DB, COLL, postId);
          return res.status(200).json({ success: true });
        }

        if (!pubkey || !signature || !message) return res.status(400).json({ error: 'Missing required fields' });
        // Verify message is delete:<postId> to prevent replay attacks
        if (message !== `delete:${postId}`) return res.status(400).json({ error: 'Invalid delete message' });
        try {
          const pubkeyBytes = Buffer.from(bs58.decode(pubkey));
          const sigBytes    = Buffer.from(signature, 'base64');
          const msgBytes    = Buffer.from(message, 'utf8');
          if (!nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes))
            return res.status(401).json({ error: 'Invalid wallet signature' });
        } catch {
          return res.status(401).json({ error: 'Signature verification failed' });
        }
        const post = await db.getDocument(DB, COLL, postId);
        if (post.wallet !== pubkey && pubkey !== ADMIN_WALLET) return res.status(403).json({ error: 'Not your post' });
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
