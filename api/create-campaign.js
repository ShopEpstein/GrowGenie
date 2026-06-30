const { Client, Databases, ID } = require('node-appwrite');

const ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT  = '6a2bc15c00065b3c91a0';
const DB       = 'growthgenie';
const COLL     = 'campaigns';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  if (!process.env.APPWRITE_API_KEY) {
    return res.status(500).json({ error: 'Server not configured' });
  }

  const body = req.body || {};
  const { target, why, category, wallet, social, banner, bounty, clientId, campaignType } = body;

  if (!target || !why) {
    return res.status(400).json({ error: 'Missing target or why' });
  }

  const isSmear = campaignType === 'smear';
  const slug = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const EMOJI = { hate:'💀', coin:'🪙', ex:'💔', boss:'😤', family:'😈', boredom:'😒', fun:'😂', profit:'💰' };

  const doc = {
    slug:         slug(target),
    clientId:     (clientId || 'anon').slice(0, 64),
    projectName:  target.slice(0, 100),
    title:        `${isSmear ? 'SMEAR' : 'FUD'}: ${target}`.slice(0, 100),
    tag:          why.slice(0, 500),
    logo:         isSmear ? '⭐' : (EMOJI[category] || '💀'),
    campaignType: isSmear ? 'smear' : 'fudfund',
    fudTarget:    target.slice(0, 100),
    fudCategory:  category || 'hate',
    tipWallet:    wallet || null,
    active:       true,
    accentColor:  isSmear ? '#B22234' : '#FF3D00',
  };

  if (social)  doc.socialLink = social.slice(0, 500);
  if (banner)  doc.bannerUrl  = banner.slice(0, 500);
  if (bounty && parseFloat(bounty) > 0) doc.bountyPool = String(parseFloat(bounty));

  try {
    const client = new Client()
      .setEndpoint(ENDPOINT)
      .setProject(PROJECT)
      .setKey(process.env.APPWRITE_API_KEY);

    const dbs = new Databases(client);
    const created = await dbs.createDocument(DB, COLL, ID.unique(), doc);
    return res.status(200).json(created);
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
