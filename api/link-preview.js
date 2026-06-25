const https = require('https');
const http  = require('http');

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    const mod = url.startsWith('https') ? https : http;
    mod.get(url, { headers: { 'User-Agent': 'FudFun/1.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try { resolve(JSON.parse(data)); }
        catch (e) { reject(new Error('Invalid JSON from oEmbed')); }
      });
    }).on('error', reject);
  });
}

function detectPlatform(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'twitter.com' || host === 'x.com') return 'twitter';
    if (host === 'tiktok.com')                       return 'tiktok';
    return null;
  } catch { return null; }
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET')    return res.status(405).end();

  const { url } = req.query;
  if (!url) return res.status(400).json({ error: 'Missing url parameter' });

  const platform = detectPlatform(url);
  if (!platform) {
    return res.status(400).json({ error: 'Only X/Twitter and TikTok URLs are supported' });
  }

  let oembedUrl;
  if (platform === 'twitter') {
    oembedUrl = `https://publish.twitter.com/oembed?url=${encodeURIComponent(url)}&omit_script=true&dnt=true`;
  } else {
    oembedUrl = `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  }

  try {
    const data = await fetchJson(oembedUrl);
    return res.status(200).json({
      platform,
      authorName:  data.author_name  || null,
      authorUrl:   data.author_url   || null,
      title:       data.title        || null,
      html:        data.html         || null,
      thumbnailUrl: data.thumbnail_url || null,
      providerName: data.provider_name || platform,
    });
  } catch (e) {
    return res.status(502).json({ error: 'Failed to fetch oEmbed data', detail: e.message });
  }
};
