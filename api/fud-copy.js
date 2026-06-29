const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.3-70b-versatile';

const EMOJIS_FUD   = ['🚨','💀','🧵','👀','⚠️','🔥','📢','💣','🎯','😤'];
const EMOJIS_SMEAR = ['🚨','⭐','🧵','👀','⚠️','🗳️','📢','🇺🇸','🎯','😤'];

const SYSTEM_FUD = `You write viral social media posts designed to spread FUD (Fear, Uncertainty, Doubt) about a specific target.
Your posts feel like they're written by real, angry humans — not AI, not corporate PR.
Each post must come from a completely different personality and angle.`;

const SYSTEM_SMEAR = `You write viral political attack content designed to damage a politician's or public figure's reputation.
Your posts feel like they're written by real concerned citizens, political activists, and opposition researchers — not AI, not party operatives.
Each post must come from a completely different personality and angle.
Use civic and political language: accountability, failed promises, constituents deserve better, hold them accountable, voters deserve the truth.`;

function fallbackFud(who, angle, url) {
  return [
    { e:'🚨', t:`🚨 ${who} is showing major red flags the community needs to know about. DYOR before you get wrecked.\n\n${url}` },
    { e:'💀', t:`Why is nobody talking about what ${who} has been up to? These are facts. Check the receipts:\n${url}` },
    { e:'🧵', t:`Thread: everything suspicious about ${who}. Someone has to say it 🧵\n\nFull breakdown: ${url}` },
    { e:'👀', t:`I looked into ${who} so you don't have to. What I found: ${angle}\n\nReceipts: ${url}` },
    { e:'⚠️', t:`PSA: ${who} — ${angle}. The community needs to see this. 💀\n${url}` },
  ];
}

function fallbackSmear(who, angle, url) {
  return [
    { e:'🚨', t:`🚨 ${who} needs to be held accountable. The voters deserve to know the truth about this. Full receipts:\n\n${url}` },
    { e:'⭐', t:`Why is no one talking about ${who}'s record? These are documented facts — not opinions. Check for yourself:\n${url}` },
    { e:'🧵', t:`Thread: The case against ${who} and why constituents can't afford to ignore it 🧵\n\nFull campaign: ${url}` },
    { e:'👀', t:`I dug into ${who} so you don't have to. What I found: ${angle}\n\nThe public needs to see this: ${url}` },
    { e:'🗳️', t:`PSA: ${who} — ${angle}. Before you vote, read this. Your community is counting on you.\n${url}` },
  ];
}

async function groq(system, user) {
  const res = await fetch(GROQ_API, {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 1200,
      messages: [
        { role: 'system', content: system },
        { role: 'user',   content: user   },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Groq ${res.status}`);
  const j = await res.json();
  return j.choices?.[0]?.message?.content?.trim() || '[]';
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  const { targetName, reason, category, campaignUrl, campaignType, socialHandle } = req.body || {};
  if (!targetName) return res.status(400).json({ error: 'Missing targetName' });

  const handleLine = socialHandle ? `Target's X handle: ${socialHandle} — tag them directly in at least 3 of the 5 posts.` : '';

  const isSmear = campaignType === 'smear';
  const SYSTEM  = isSmear ? SYSTEM_SMEAR : SYSTEM_FUD;
  const EMOJIS  = isSmear ? EMOJIS_SMEAR : EMOJIS_FUD;

  if (!process.env.GROQ_API_KEY) {
    const fallback = isSmear
      ? fallbackSmear(targetName, reason || '', campaignUrl || '')
      : fallbackFud(targetName, reason || '', campaignUrl || '');
    return res.status(200).json({ tweets: fallback });
  }

  const USER = isSmear
    ? `Write 5 unique tweet-length posts targeting "${targetName}" politically.
Reason/context: ${reason || 'corruption and failed promises'}
Category: ${category || 'political accountability'}
Campaign URL: ${campaignUrl || ''}
${handleLine}

Rules:
- Angles: outraged voter, opposition researcher exposing hypocrisy, fact-checker, concerned constituent, accountability activist
- Start each with 1-2 emojis — no two posts can start with the same emoji
- End every post with the campaign URL on its own line
- Keep each under 240 characters total (including the URL)
- Reference the specific reason/context naturally — no generic filler
- Sound like real people tweeting their political frustration, not a campaign staffer
- Use civic language: accountability, failed promises, constituents deserve better, voters deserve the truth
- Vary sentence structure dramatically across all 5

Return ONLY a JSON array of 5 strings. No markdown, no code fences, no explanation.`
    : `Write 5 unique tweet-length posts about "${targetName}".
Reason/context: ${reason || 'suspicious behavior'}
Category: ${category || 'general'}
Campaign URL: ${campaignUrl || ''}
${handleLine}

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
    const raw = await groq(SYSTEM, USER);
    let parsed;
    try {
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
      parsed = JSON.parse(clean);
    } catch {
      const fallback = isSmear
        ? fallbackSmear(targetName, reason || '', campaignUrl || '')
        : fallbackFud(targetName, reason || '', campaignUrl || '');
      return res.status(200).json({ tweets: fallback });
    }

    const tweets = parsed.slice(0, 5).map((t, i) => {
      const s = String(t);
      const m = s.match(/^\s*([\p{Emoji_Presentation}\p{Extended_Pictographic}]+)/u);
      return { e: m?.[1]?.trim() || EMOJIS[i] || '💀', t: s };
    });

    return res.status(200).json({ tweets });
  } catch (e) {
    console.error('fud-copy error:', e.message);
    const fallback = isSmear
      ? fallbackSmear(targetName, reason || '', campaignUrl || '')
      : fallbackFud(targetName, reason || '', campaignUrl || '');
    return res.status(200).json({ tweets: fallback });
  }
};
