#!/usr/bin/env node
// Run this once after deployment to seed the @fudfunn self-promo campaign:
//   APPWRITE_API_KEY=your_key node scripts/create-fudfunn-campaign.js

const { Client, Databases, ID } = require('node-appwrite');

const ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT  = '6a2bc15c00065b3c91a0';
const DB       = 'growthgenie';
const COLL     = 'campaigns';

async function main() {
  const key = process.env.APPWRITE_API_KEY;
  if (!key) { console.error('Set APPWRITE_API_KEY env var'); process.exit(1); }

  const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(key);
  const dbs = new Databases(client);

  const doc = {
    slug:         'fudfun-xyz',
    clientId:     'fudfunn',
    projectName:  'FudFun.xyz',
    title:        'FUD: FudFun.xyz',
    tag:          'This platform lets degens and political activists launch viral FUD and smear campaigns in seconds. No VC funding. No censorship. Fully on-chain. The only FUD platform that pays you back in SOL. Someone had to build it.',
    logo:         '💀',
    campaignType: 'fudfund',
    fudTarget:    'FudFun.xyz',
    fudCategory:  'fun',
    socialLink:   'https://x.com/fudfunn',
    tipWallet:    null,
    active:       true,
    accentColor:  '#FF3D00',
  };

  try {
    const created = await dbs.createDocument(DB, COLL, ID.unique(), doc);
    console.log('✅ Campaign created:', created.$id);
    console.log('   URL: https://fudfun.xyz/c/' + created.$id);
  } catch (e) {
    console.error('❌ Failed:', e.message);
  }
}

main();
