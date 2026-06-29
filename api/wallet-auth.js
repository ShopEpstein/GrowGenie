const { Client, Users } = require('node-appwrite');
const { PublicKey }     = require('@solana/web3.js');
const nacl   = require('tweetnacl');
const crypto = require('crypto');

const ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT  = '6a2bc15c00065b3c91a0';

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

  // 1. Verify ed25519 signature — proves the caller owns this wallet
  try {
    const pubkeyBytes = new PublicKey(pubkey).toBytes();
    const sigBytes    = Buffer.from(signature, 'base64');
    const msgBytes    = Buffer.from(message, 'utf8');
    const valid       = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
    if (!valid) return res.status(401).json({ error: 'Invalid signature' });
  } catch (e) {
    return res.status(401).json({ error: 'Signature verification failed: ' + e.message });
  }

  if (!process.env.APPWRITE_API_KEY) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const appwriteClient = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT)
    .setKey(process.env.APPWRITE_API_KEY);

  const users = new Users(appwriteClient);

  // Alphanumeric-only userId, no dots (Appwrite cloud rejects dots)
  const userId = 'sol' + pubkey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 29);

  // Lowercase email avoids Appwrite email validator rejecting uppercase in local part
  const email = userId.toLowerCase() + '@fudfun.xyz';

  // Password satisfies any Appwrite complexity policy:
  // prefix 'Wa1!' guarantees uppercase+lowercase+digit+special, rest is HMAC hex
  const hmac = crypto.createHmac('sha256',
    process.env.WALLET_AUTH_SECRET || process.env.APPWRITE_API_KEY
  ).update(pubkey).digest('hex');
  const password = 'Wa1!' + hmac.slice(0, 60);  // 64 chars total

  // 2. Find or create Appwrite user; sync password on every login
  try {
    await users.get(userId);
    await users.updatePassword(userId, password);
  } catch {
    try {
      await users.create(userId, email, undefined, password, pubkey.slice(0, 8) + '...');
    } catch (e) {
      return res.status(500).json({ error: 'Could not create account: ' + e.message });
    }
  }

  // 3. Return credentials for client to call account.createEmailPasswordSession()
  return res.status(200).json({ email, password, _v: 4 });
};
