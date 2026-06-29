const { Client, Users } = require('node-appwrite');
const { PublicKey }     = require('@solana/web3.js');
// tweetnacl is a direct dependency of @solana/web3.js — available in node_modules
const nacl = require('tweetnacl');

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
    const msgBytes    = new TextEncoder().encode(message);
    const valid       = nacl.sign.detached.verify(msgBytes, sigBytes, pubkeyBytes);
    if (!valid) return res.status(401).json({ error: 'Invalid signature' });
  } catch {
    return res.status(401).json({ error: 'Signature verification failed' });
  }

  // 2. Find or create Appwrite user for this wallet
  if (!process.env.APPWRITE_API_KEY) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const appwrite = new Client()
    .setEndpoint(ENDPOINT)
    .setProject(PROJECT)
    .setKey(process.env.APPWRITE_API_KEY);

  const users  = new Users(appwrite);
  // Dots in IDs are rejected by Appwrite cloud — alphanumeric only
  const userId = 'sol' + pubkey.replace(/[^a-zA-Z0-9]/g, '').slice(0, 29);
  const email  = `${pubkey}@wallet.fudfun.xyz`;

  let user;
  try {
    user = await users.get(userId);
  } catch {
    try {
      // users.create(userId, email, phone, password, name) — name is 5th param
      user = await users.create(userId, email, undefined, undefined, pubkey.slice(0, 8) + '...');
    } catch (e) {
      return res.status(500).json({ error: 'Could not create account: ' + e.message });
    }
  }

  // 3. Issue a short-lived token the client can use to create a session
  try {
    const token = await users.createToken(user.$id);
    return res.status(200).json({ userId: user.$id, secret: token.secret });
  } catch (e) {
    return res.status(500).json({ error: 'Could not issue session token: ' + e.message });
  }
};
