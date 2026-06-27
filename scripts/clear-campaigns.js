#!/usr/bin/env node
// Deletes ALL documents from the campaigns collection.
// Run: APPWRITE_API_KEY=your_key node scripts/clear-campaigns.js

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

async function main() {
  console.log('Fetching all campaigns…');
  const r = await req('GET', `/databases/${DB}/collections/campaigns/documents?limit=100`);
  const { documents } = JSON.parse(r.body);
  if (!documents?.length) { console.log('No campaigns found.'); return; }
  console.log(`Found ${documents.length} campaigns. Deleting…`);
  for (const doc of documents) {
    const d = await req('DELETE', `/databases/${DB}/collections/campaigns/documents/${doc.$id}`);
    if (d.status === 204) console.log(`  ✅ Deleted: ${doc.projectName || doc.$id}`);
    else console.log(`  ⚠️  Failed ${doc.$id}: ${d.status} ${d.body}`);
  }
  console.log('\nDone.');
}

main().catch(e => { console.error(e); process.exit(1); });
