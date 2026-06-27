#!/usr/bin/env node
// Run: APPWRITE_API_KEY=your_key node scripts/provision-schema.js

const https = require('https');

const BASE    = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT = '6a2bc15c00065b3c91a0';
const DB      = 'growthgenie';
const KEY     = process.env.APPWRITE_API_KEY;

if (!KEY) { console.error('Set APPWRITE_API_KEY env var'); process.exit(1); }

function req(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const opts = {
      hostname: 'nyc.cloud.appwrite.io',
      path: `/v1${path}`,
      method,
      headers: {
        'X-Appwrite-Project': PROJECT,
        'X-Appwrite-Key': KEY,
        'Content-Type': 'application/json',
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const r = https.request(opts, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve({ status: res.statusCode, body: d }));
    });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function addStr(key, size) {
  const r = await req('POST', `/databases/${DB}/collections/campaigns/attributes/string`, { key, size, required: false });
  if (r.status === 201) console.log(`  ✅ ${key}`);
  else if (r.status === 409) console.log(`  ℹ️  ${key} already exists`);
  else console.log(`  ⚠️  ${key}: ${r.status} ${r.body}`);
  await sleep(400);
}

async function addBool(key) {
  const r = await req('POST', `/databases/${DB}/collections/campaigns/attributes/boolean`, { key, required: false });
  if (r.status === 201) console.log(`  ✅ ${key}`);
  else if (r.status === 409) console.log(`  ℹ️  ${key} already exists`);
  else console.log(`  ⚠️  ${key}: ${r.status} ${r.body}`);
  await sleep(400);
}

async function main() {
  console.log('Provisioning campaigns collection attributes…');
  await addStr('campaignType', 32);
  await addStr('fudTarget', 128);
  await addStr('smearTarget', 128);
  await addStr('fudCategory', 32);
  await addStr('tipWallet', 128);
  await addStr('txSignature', 128);
  await addStr('socialLink', 2048);
  await addStr('socialPreviewName', 128);
  await addStr('socialPreviewThumb', 2048);
  await addStr('socialPreviewPlatform', 32);
  await addStr('reviewStatus', 32);
  await addBool('active');
  console.log('\nDone! Attributes may take ~30s to become available in Appwrite.');
}

main().catch(e => { console.error(e); process.exit(1); });
