const { Connection, PublicKey } = require('@solana/web3.js');
const { Client, Databases, ID } = require('node-appwrite');

const SOLANA_RPC  = process.env.SOLANA_RPC  || 'https://api.mainnet-beta.solana.com';
const TREASURY    = process.env.TREASURY_WALLET || '3U8zuHiQqiXGKwrvrXzWtmWg2y3NSYnreyXpwTyioDPa';

const DB   = 'growthgenie';
const TIPS = 'tips';

const appwrite = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || 'https://nyc.cloud.appwrite.io/v1')
  .setProject(process.env.APPWRITE_PROJECT   || '6a2bc15c00065b3c91a0')
  .setKey(process.env.APPWRITE_API_KEY       || '');

const databases = new Databases(appwrite);

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.status(204).end(); return; }
  if (req.method !== 'POST')    { res.status(405).json({ error: 'Method not allowed' }); return; }

  const { signature, campaignId, amount, token = 'SOL', fromUserId } = req.body || {};

  if (!signature || !campaignId || !amount) {
    res.status(400).json({ error: 'signature, campaignId, and amount are required' });
    return;
  }

  try {
    const conn = new Connection(SOLANA_RPC, 'confirmed');
    const tx   = await conn.getTransaction(signature, { commitment: 'confirmed', maxSupportedTransactionVersion: 0 });

    if (!tx) {
      res.status(400).json({ error: 'Transaction not found on-chain' });
      return;
    }
    if (tx.meta?.err) {
      res.status(400).json({ error: 'Transaction failed on-chain' });
      return;
    }

    await databases.createDocument(DB, TIPS, ID.unique(), {
      campaignId,
      fromUserId: fromUserId || '',
      amount:     String(amount),
      token,
      txSignature: signature,
      timestamp:  Math.floor(Date.now() / 1000),
    });

    res.status(200).json({ ok: true });
  } catch (err) {
    console.error('send-tip error:', err);
    res.status(500).json({ error: err.message || 'Internal error' });
  }
};
