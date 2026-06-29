const SCROLL_MINT = '9yfXvj9pYzS92v8JKp7K25oFFjz9emH6nHGtbBexpump';
const SOL_RPC     = 'https://api.mainnet-beta.solana.com';

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const wallet = req.query?.wallet || (req.body && req.body.wallet);
  if (!wallet) return res.status(400).json({ error: 'Missing wallet' });

  try {
    const resp = await fetch(SOL_RPC, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1,
        method: 'getTokenAccountsByOwner',
        params: [wallet, { mint: SCROLL_MINT }, { encoding: 'jsonParsed' }],
      }),
    });
    const j    = await resp.json();
    const bal  = (j.result?.value || []).reduce(
      (s, a) => s + (a.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0), 0
    );
    return res.status(200).json({ allowed: bal > 0, balance: bal, symbol: '$SCROLL' });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
};
