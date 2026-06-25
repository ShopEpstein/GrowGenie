#!/usr/bin/env node
// One-time script: set password + admin label for contactfire757@gmail.com
// Usage: APPWRITE_API_KEY=your_key node scripts/setup-admin.js

const { Client, Users, Query } = require('node-appwrite');

const TARGET_EMAIL = process.env.ADMIN_EMAIL    || 'contactfire757@gmail.com';
const NEW_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const ENDPOINT     = process.env.APPWRITE_ENDPOINT   || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT      = process.env.APPWRITE_PROJECT_ID || '6a2bc15c00065b3c91a0';
const API_KEY      = process.env.APPWRITE_API_KEY;

if (!API_KEY) {
  console.error('❌  APPWRITE_API_KEY env var is required.');
  console.error('    Run: APPWRITE_API_KEY=xxx node scripts/setup-admin.js');
  process.exit(1);
}

const client = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
const users  = new Users(client);

async function main() {
  console.log(`Looking up ${TARGET_EMAIL}…`);
  const result = await users.list([Query.equal('email', TARGET_EMAIL)]);

  if (result.total === 0) {
    console.error(`❌  No user found with email ${TARGET_EMAIL}`);
    process.exit(1);
  }

  const user = result.users[0];
  console.log(`Found: ${user.$id} — ${user.name || '(no name)'}`);

  await users.updatePassword(user.$id, NEW_PASSWORD);
  console.log('✅  Password updated');

  const existing = user.labels || [];
  if (!existing.includes('admin')) {
    await users.updateLabels(user.$id, [...existing, 'admin']);
    console.log('✅  Admin label added');
  } else {
    console.log('ℹ️   Already has admin label');
  }

  console.log('🎉  Done — contactfire757@gmail.com is now admin.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
