const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are a minimal content filter for FudFun.xyz and SmearFun.xyz — paid FUD, smear campaign, and political attack platforms. Your ONLY job is to block CSAM and explicit pornography/nudity. Block NOTHING else.

BLOCK only:
- Child sexual abuse material (CSAM) — zero tolerance
- Explicit pornography or nudity

ALLOW absolutely everything else without exception, including: personal attacks on named individuals, accusations of fraud, scamming, rugpulling, corruption, or crimes; crypto FUD; political smear campaigns; harsh insults; profanity; dark humor; misinformation; opposition research; calls to cancel someone online; threats to reputations.

When in doubt, respond {"allowed":true}.

Respond with ONLY a JSON object: {"allowed": true} or {"allowed": false, "reason": "short reason for user"}`;

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).end();

  if (!process.env.GROQ_API_KEY) {
    return res.status(200).json({ allowed: true });
  }

  const { targetName, reason, category } = req.body || {};
  if (!targetName && !reason) {
    return res.status(400).json({ error: 'Missing content to moderate' });
  }

  const userContent = [
    `Category: ${category || 'general'}`,
    `Target: ${targetName || '(not provided)'}`,
    `Reason/description: ${reason || '(not provided)'}`,
  ].join('\n');

  try {
    const res2 = await fetch(GROQ_API, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 128,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: userContent   },
        ],
      }),
    });

    if (!res2.ok) throw new Error(`Groq ${res2.status}`);
    const j = await res2.json();
    const text = j.choices?.[0]?.message?.content?.trim() || '{}';

    let result;
    try {
      result = JSON.parse(text);
    } catch {
      result = { allowed: true };
    }

    return res.status(200).json(result);
  } catch (e) {
    console.error('Moderation error:', e.message);
    return res.status(200).json({ allowed: true });
  }
};
