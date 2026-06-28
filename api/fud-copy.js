const Anthropic = require('@anthropic-ai/sdk');
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const EMOJIS = ['🚨','💀','🧵','👀','⚠️','🔥','📢','💣','🎯','😤'];

const SYSTEM = `You write viral social media posts designed to spread FUD (Fear, Uncertainty, Doubt) about a specific target.
Your posts feel like they're written by real, angry humans — not AI, not corporate PR.
Each post must come from a completely different personality and angle.`;

function fallback(who, angle, url) {
  return [
    { e:'🚨', t:`🚨 ${who} is showing major red flags the community needs to know about. DYOR before you get wrecked.\n\n${url}` },
    { e:'💀', t:`Why is nobody talking about what ${who} has been up to? These are facts. Check the receipts:\n${url}` },
    { e:'🧵', t:`Thread: everything suspicious about ${who}. Someone has to say it 🧵\n\nFull breakdown: ${url}` },
    { e:'👀', t:`I looked into ${who} so you don't have to. What I found: ${angle}\n\nReceipts: ${url}` },
    { e:'⚠️', t:`PSA: ${who} — ${angle}. The community needs to see this. 💀\n${url}` },
  ];
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const { targetName, reason, category, campaignUrl } = req.body || {};
  if (!targetName) return res.status(400).json({ error: 'Missing targetName' });

  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(200).json({ tweets: fallback(targetName, reason || '', campaignUrl || '') });
  }

  const USER = `Write 5 unique tweet-length posts about "${targetName}".
Reason/context: ${reason || 'suspicious behavior'}
Category: ${category || 'general'}
Campaign URL: ${campaignUrl || ''}

Rules:
- Each post must feel genuinely different in tone: urgent alarm, sarcastic/dismissive, investigative breakdown, community warning, personal experience
- Start each with 1-2 emojis — no two posts can start with the same emoji
- End every post with the campaign URL on its own line
- Keep each under 240 characters total (including the URL)
- Reference the specific reason/context naturally — no generic filler
- Sound like real people tweeting from the gut, not a PR person
- Vary sentence structure dramatically across all 5

Return ONLY a JSON array of 5 strings. No markdown, no code fences, no explanation.`;

  try {
    const message = await client.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1200,
      system: SYSTEM,
      messages: [{ role: 'user', content: USER }],
    });

    const raw = message.content[0]?.text?.trim() || '[]';
    let parsed;
    try {
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      parsed = JSON.parse(clean);
    } catch {
      return res.status(200).json({ tweets: fallback(targetName, reason || '', campaignUrl || '') });
    }

    const tweets = parsed.slice(0, 5).map((t, i) => {
      const s = String(t);
      const m = s.match(/^\s*([\p{Emoji_Presentation}\p{Extended_Pictographic}]+)/u);
      return { e: m?.[1]?.trim() || EMOJIS[i] || '💀', t: s };
    });

    return res.status(200).json({ tweets });
  } catch (e) {
    console.error('fud-copy error:', e.message);
    return res.status(200).json({ tweets: fallback(targetName, reason || '', campaignUrl || '') });
  }
};
