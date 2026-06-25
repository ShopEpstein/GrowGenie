const { Connection, PublicKey, LAMPORTS_PER_SOL } = require('@solana/web3.js');
const { Client, Databases, Query } = require('node-appwrite');

const TREASURY    = process.env.TREASURY_WALLET   || '3U8zuHiQqiXGKwrvrXzWtmWg2y3NSYnreyXpwTyioDPa';
const PRICE_SOL   = parseFloat(process.env.PRICE_SOL  || '0.5');
const PRICE_USDC  = parseFloat(process.env.PRICE_USDC || '50');
const USDC_MINT   = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const DB          = 'growthgenie';
const COLL        = 'campaigns';

const PRICE_LAMPORTS   = Math.floor(PRICE_SOL  * LAMPORTS_PER_SOL);
const PRICE_USDC_MICRO = Math.floor(PRICE_USDC * 1_000_000);

function appwriteClient() {
  return new Client()
    .setEndpoint(process.env.APPWRITE_ENDPOINT    || 'https://nyc.cloud.appwrite.io/v1')
    .setProject(process.env.APPWRITE_PROJECT_ID   || '6a2bc15c00065b3c91a0')
    .setKey(process.env.APPWRITE_API_KEY           || '');
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const { signature, campaignId } = req.body || {};
  if (!signature || !campaignId) {
    return res.status(400).json({ error: 'Missing signature or campaignId' });
  }
  if (!TREASURY) {
    return res.status(500).json({ error: 'Treasury wallet not configured' });
  }

  // ── 1. Fetch & confirm transaction on Solana ────────────────────
  const rpc = process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
  const connection = new Connection(rpc, 'confirmed');

  let tx;
  try {
    tx = await connection.getTransaction(signature, {
      commitment: 'confirmed',
      maxSupportedTransactionVersion: 0,
    });
  } catch (e) {
    return res.status(502).json({ error: 'Failed to reach Solana RPC' });
  }

  if (!tx)          return res.status(400).json({ error: 'Transaction not found' });
  if (tx.meta?.err) return res.status(400).json({ error: 'Transaction failed on-chain' });

  // ── 2. Check payment amount (SOL or USDC) ──────────────────────
  const msg         = tx.transaction.message;
  const accountKeys = msg.staticAccountKeys || msg.accountKeys || [];

  let validPayment = false;

  // SOL: treasury balance must increase by >= PRICE_LAMPORTS
  const tIdx = accountKeys.findIndex(k => k.toBase58?.() === TREASURY || k.toString?.() === TREASURY);
  if (tIdx !== -1) {
    const gained = (tx.meta.postBalances[tIdx] ?? 0) - (tx.meta.preBalances[tIdx] ?? 0);
    if (gained >= PRICE_LAMPORTS) validPayment = true;
  }

  // USDC SPL: treasury token account must gain >= PRICE_USDC_MICRO
  if (!validPayment) {
    const post = tx.meta.postTokenBalances || [];
    const pre  = tx.meta.preTokenBalances  || [];
    for (const p of post) {
      if (p.mint === USDC_MINT && p.owner === TREASURY) {
        const prev    = pre.find(x => x.accountIndex === p.accountIndex);
        const preAmt  = BigInt(prev?.uiTokenAmount?.amount || '0');
        const postAmt = BigInt(p.uiTokenAmount?.amount     || '0');
        if (postAmt - preAmt >= BigInt(PRICE_USDC_MICRO)) {
          validPayment = true;
          break;
        }
      }
    }
  }

  if (!validPayment) {
    return res.status(402).json({ error: 'Payment too low or wrong recipient' });
  }

  // ── 3. Guard against signature reuse ───────────────────────────
  const db = new Databases(appwriteClient());
  try {
    const existing = await db.listDocuments(DB, COLL, [
      Query.equal('txSignature', signature),
      Query.limit(1),
    ]);
    if (existing.total > 0) {
      return res.status(409).json({ error: 'Transaction already used' });
    }
  } catch (e) {
    // If the attribute doesn't exist yet just skip the check
    console.warn('txSignature query failed:', e.message);
  }

  // ── 4. Activate campaign ────────────────────────────────────────
  try {
    await db.updateDocument(DB, COLL, campaignId, {
      active:      true,
      txSignature: signature,
    });
  } catch (e) {
    console.error('Appwrite update failed:', e);
    return res.status(500).json({ error: 'Failed to activate campaign' });
  }

  return res.status(200).json({ success: true });
};
