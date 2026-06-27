const { Client, Account, Databases, Users, Query } = require('node-appwrite');

const ENDPOINT = process.env.APPWRITE_ENDPOINT    || 'https://nyc.cloud.appwrite.io/v1';
const PROJECT  = process.env.APPWRITE_PROJECT_ID  || '6a2bc15c00065b3c91a0';
const API_KEY  = process.env.APPWRITE_API_KEY     || '';
const DB       = 'growthgenie';

function adminClient() {
  return new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setKey(API_KEY);
}

// Verify the incoming JWT belongs to a user with the 'admin' label
async function verifyAdmin(req) {
  const auth = req.headers['authorization'] || '';
  const jwt  = auth.replace(/^Bearer\s+/i, '').trim();
  if (!jwt) throw Object.assign(new Error('Missing auth token'), { status: 401 });

  const sessionClient = new Client().setEndpoint(ENDPOINT).setProject(PROJECT).setJWT(jwt);
  const account = new Account(sessionClient);
  const user = await account.get().catch(() => null);
  if (!user) throw Object.assign(new Error('Invalid session'), { status: 401 });
  if (!user.labels?.includes('admin')) throw Object.assign(new Error('Not an admin'), { status: 403 });
  return user;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    await verifyAdmin(req);
  } catch (e) {
    return res.status(e.status || 401).json({ error: e.message });
  }

  const adm = adminClient();
  const dbs = new Databases(adm);
  const usr = new Users(adm);

  // ── GET requests ────────────────────────────────────────────────
  if (req.method === 'GET') {
    const { action, cursor } = req.query;

    if (action === 'campaigns') {
      const queries = [Query.orderDesc('$createdAt'), Query.limit(100)];
      if (cursor) queries.push(Query.cursorAfter(cursor));
      const r = await dbs.listDocuments(DB, 'campaigns', queries);
      return res.status(200).json(r);
    }

    if (action === 'users') {
      const queries = [Query.orderDesc('$createdAt'), Query.limit(100)];
      if (cursor) queries.push(Query.cursorAfter(cursor));
      const r = await usr.list(queries);
      // Strip sensitive fields before returning
      const sanitized = r.users.map(u => ({
        $id: u.$id, name: u.name, email: u.email,
        status: u.status, labels: u.labels,
        $createdAt: u.$createdAt,
      }));
      return res.status(200).json({ total: r.total, users: sanitized });
    }

    if (action === 'pending') {
      const r = await dbs.listDocuments(DB, 'campaigns', [
        Query.equal('reviewStatus', 'pending'),
        Query.orderDesc('$createdAt'),
        Query.limit(100),
      ]);
      return res.status(200).json(r);
    }

    if (action === 'stats') {
      const [camps, allUsers, active, pending] = await Promise.all([
        dbs.listDocuments(DB, 'campaigns', [Query.limit(1)]),
        usr.list([Query.limit(1)]),
        dbs.listDocuments(DB, 'campaigns', [Query.equal('active', true), Query.limit(1)]),
        dbs.listDocuments(DB, 'campaigns', [Query.equal('reviewStatus', 'pending'), Query.limit(1)]).catch(() => ({ total: 0 })),
      ]);
      return res.status(200).json({
        totalCampaigns:  camps.total,
        activeCampaigns: active.total,
        totalUsers:      allUsers.total,
        pendingCount:    pending.total,
      });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  // ── POST requests ───────────────────────────────────────────────
  if (req.method === 'POST') {
    const { action, campaignId, userId } = req.body || {};

    if (action === 'delete-all-campaigns') {
      let deleted = 0;
      let docs;
      do {
        const r = await dbs.listDocuments(DB, 'campaigns', [Query.limit(100)]);
        docs = r.documents;
        await Promise.all(docs.map(d => dbs.deleteDocument(DB, 'campaigns', d.$id)));
        deleted += docs.length;
      } while (docs.length === 100);
      return res.status(200).json({ deleted });
    }

    if (action === 'delete-campaign') {
      if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });
      await dbs.deleteDocument(DB, 'campaigns', campaignId);
      return res.status(200).json({ success: true });
    }

    if (action === 'toggle-campaign') {
      if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });
      const doc = await dbs.getDocument(DB, 'campaigns', campaignId);
      await dbs.updateDocument(DB, 'campaigns', campaignId, { active: !doc.active });
      return res.status(200).json({ success: true, active: !doc.active });
    }

    if (action === 'update-campaign') {
      if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });
      const { updates } = req.body;
      if (!updates || typeof updates !== 'object') return res.status(400).json({ error: 'Missing updates' });
      const allowed = ['fudTarget', 'smearTarget', 'projectName', 'title', 'tag', 'fudCategory', 'active', 'tipWallet', 'accentColor'];
      const safe = Object.fromEntries(Object.entries(updates).filter(([k]) => allowed.includes(k)));
      await dbs.updateDocument(DB, 'campaigns', campaignId, safe);
      return res.status(200).json({ success: true });
    }

    if (action === 'approve-campaign') {
      if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });
      await dbs.updateDocument(DB, 'campaigns', campaignId, { active: true, reviewStatus: 'approved' });
      return res.status(200).json({ success: true });
    }

    if (action === 'reject-campaign') {
      if (!campaignId) return res.status(400).json({ error: 'Missing campaignId' });
      await dbs.updateDocument(DB, 'campaigns', campaignId, { active: false, reviewStatus: 'rejected' });
      return res.status(200).json({ success: true });
    }

    if (action === 'ban-user') {
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      await usr.updateStatus(userId, false);
      return res.status(200).json({ success: true });
    }

    if (action === 'unban-user') {
      if (!userId) return res.status(400).json({ error: 'Missing userId' });
      await usr.updateStatus(userId, true);
      return res.status(200).json({ success: true });
    }

    return res.status(400).json({ error: 'Unknown action' });
  }

  return res.status(405).end();
};
