const GROQ_API = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL    = 'llama-3.1-8b-instant';

const SYSTEM_PROMPT = `You are a content moderation system for FudFun.xyz, a social satire platform where users post comedic "FUD" (Fear, Uncertainty, Doubt) about public figures, exes, bosses, and other targets.

Your job is to determine if submitted content is ALLOWED or BLOCKED.

BLOCK if the content contains:
- Sexual content, pornography, or explicit material
- Child sexual abuse material (CSAM) — always block, zero tolerance
- Detailed personal information (home address, phone numbers, SSN, financial account numbers — i.e. real doxxing)
- Credible threats of violence or calls for physical harm
- Content that is clearly illegal (e.g. hiring a hitman, selling drugs/weapons)
- Hate speech targeting a protected group with no satirical context

ALLOW (even if edgy):
- Venting about an ex, boss, family member, or public figure
- Harsh but non-violent criticism
- Satire, parody, dark humor
- Strong language and profanity
- Claims like "my boss is a scammer" or "my ex cheated on me"
- Business criticism ("this company scammed me")
- Political commentary

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
