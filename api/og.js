const { Client, Databases } = require('node-appwrite');

const ENDPOINT = 'https://nyc.cloud.appwrite.io/v1';
const PROJECT  = '6a2bc15c00065b3c91a0';
const DB       = 'growthgenie';
const COLL     = 'campaigns';

function esc(s) {
  return String(s || '').replace(/[<>&"']/g, c => (
    { '<':'&lt;', '>':'&gt;', '&':'&amp;', '"':'&quot;', "'":'&#39;' }[c]
  ));
}

module.exports = async (req, res) => {
  const id = req.query.id || req.query.c;
  if (!id) return res.redirect('/');

  const dest = `/campaign.html?c=${encodeURIComponent(id)}`;

  let camp = null;
  try {
    const appwrite = new Client()
      .setEndpoint(ENDPOINT)
      .setProject(PROJECT)
      .setKey(process.env.APPWRITE_API_KEY);
    const dbs = new Databases(appwrite);
    camp = await dbs.getDocument(DB, COLL, id);
  } catch {}

  if (!camp) return res.redirect(dest);

  const who      = camp.fudTarget || camp.smearTarget || camp.projectName || 'Unknown';
  const why      = (camp.tag || '').slice(0, 200) || 'The community needs to see this.';
  const isSmear  = camp.campaignType === 'smear';
  const thumb    = camp.bannerUrl || camp.socialPreviewThumb || '';
  const proto    = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const host     = req.headers.host || 'fudfun.xyz';
  const baseUrl  = `${proto}://${host}`;

  // Always generate a dynamic OG image; use campaign banner as override if it exists
  const ogImageUrl = thumb
    ? thumb
    : `${baseUrl}/api/og-image?t=${encodeURIComponent(who)}&w=${encodeURIComponent(why.slice(0, 110))}&m=${isSmear ? 's' : 'f'}`;

  const verb     = isSmear ? "getting Smeared" : "getting FUD'd";
  const icon     = isSmear ? '⭐' : '💀';
  const siteName = isSmear ? 'SmearFun.xyz' : 'FudFun.xyz';
  const ogTitle  = `${icon} ${who} is ${verb} | ${siteName}`;
  const ogDesc   = `${why.slice(0, 160)} — Join the campaign on ${siteName}`;
  const ogUrl    = `${baseUrl}/c/${encodeURIComponent(id)}`;

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=60, s-maxage=300');
  res.status(200).send(`<!DOCTYPE html><html lang="en">
<head>
<meta charset="utf-8"/>
<title>${esc(ogTitle)}</title>
<meta name="description" content="${esc(ogDesc)}"/>

<!-- Open Graph -->
<meta property="og:type"         content="website"/>
<meta property="og:site_name"    content="${esc(siteName)}"/>
<meta property="og:url"          content="${esc(ogUrl)}"/>
<meta property="og:title"        content="${esc(ogTitle)}"/>
<meta property="og:description"  content="${esc(ogDesc)}"/>
<meta property="og:image"        content="${esc(ogImageUrl)}"/>
<meta property="og:image:width"  content="1200"/>
<meta property="og:image:height" content="630"/>

<!-- Twitter Card -->
<meta name="twitter:card"        content="summary_large_image"/>
<meta name="twitter:site"        content="${isSmear ? '@smearfun' : '@fudfunn'}"/>
<meta name="twitter:title"       content="${esc(ogTitle)}"/>
<meta name="twitter:description" content="${esc(ogDesc)}"/>
<meta name="twitter:image"       content="${esc(ogImageUrl)}"/>

<!-- Redirect users to the real campaign page -->
<meta http-equiv="refresh" content="0;url=${esc(dest)}"/>
<script>location.replace(${JSON.stringify(dest)})</script>
</head>
<body style="background:#04050a;color:#fff;font-family:sans-serif;display:grid;place-items:center;min-height:100vh">
  <p>Redirecting…</p>
</body>
</html>`);
};
