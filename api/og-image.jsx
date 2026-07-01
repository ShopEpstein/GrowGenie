import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const target  = (searchParams.get('t') || 'Unknown').slice(0, 42);
  const why     = (searchParams.get('w') || '').slice(0, 110);
  const isSmear = searchParams.get('m') === 's';
  const rawImg  = searchParams.get('img');

  // Verify the banner image is actually fetchable before including it
  let imgUrl = null;
  if (rawImg) {
    try {
      const r = await fetch(rawImg, { signal: AbortSignal.timeout(3000) });
      if (r.ok) imgUrl = rawImg;
    } catch {}
  }

  const accent     = isSmear ? '#B22234' : '#FF3D00';
  const accent2    = isSmear ? '#3C3B6E' : '#FF8C00';
  const accentRgb  = isSmear ? '178,34,52' : '255,61,0';
  const accent2Rgb = isSmear ? '60,59,110' : '255,140,0';

  const badgeText  = isSmear ? 'SMEAR CAMPAIGN' : 'FUD CAMPAIGN';
  const siteLabel  = isSmear ? 'SmearFun.xyz' : 'FudFun.xyz';
  const handleText = isSmear ? '@smearfun on X' : '@fudfunn on X';
  const domainText = isSmear ? 'smearfun.xyz' : 'fudfun.xyz';

  const TEXT_WIDTH = imgUrl ? 660 : 1040;
  const targetSize = target.length > 28 ? 56 : target.length > 18 ? 68 : 80;

  return new ImageResponse(
    <div
      style={{
        width: '1200px',
        height: '630px',
        background: '#04050a',
        display: 'flex',
        position: 'relative',
        overflow: 'hidden',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      {/* left glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: `radial-gradient(ellipse 60% 70% at 10% 60%, rgba(${accentRgb}, 0.18) 0%, transparent 65%)`,
        display: 'flex',
      }} />

      {/* top-right glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: `radial-gradient(ellipse 50% 50% at 90% 10%, rgba(${accent2Rgb}, 0.12) 0%, transparent 55%)`,
        display: 'flex',
      }} />

      {/* Left text area */}
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        width: `${TEXT_WIDTH}px`,
        padding: imgUrl ? '60px 40px 80px 80px' : '60px 80px 80px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* badge row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '32px' }}>
          <div style={{
            background: `linear-gradient(135deg, ${accent}, ${accent2})`,
            borderRadius: '99px',
            padding: '10px 24px',
            fontSize: '18px',
            fontWeight: 800,
            color: '#fff',
            letterSpacing: '0.06em',
            textTransform: 'uppercase',
            display: 'flex',
          }}>
            {badgeText}
          </div>
          <div style={{ color: '#3a3d52', fontSize: '17px', fontWeight: 600, display: 'flex' }}>
            {domainText}
          </div>
        </div>

        {/* target name */}
        <div style={{
          fontSize: `${targetSize}px`,
          fontWeight: 900,
          color: '#F0F1FA',
          lineHeight: 1.08,
          marginBottom: '22px',
          letterSpacing: '-0.03em',
          display: 'flex',
        }}>
          {target}
        </div>

        {/* accent bar */}
        <div style={{
          width: '80px',
          height: '4px',
          background: `linear-gradient(90deg, ${accent}, ${accent2})`,
          borderRadius: '99px',
          marginBottom: '24px',
          display: 'flex',
        }} />

        {/* why text */}
        {why ? (
          <div style={{
            fontSize: '26px',
            color: '#8890b0',
            lineHeight: 1.45,
            maxWidth: `${TEXT_WIDTH - 140}px`,
            display: 'flex',
          }}>
            {'"'}{why}{'"'}
          </div>
        ) : null}
      </div>

      {/* Right banner image */}
      {imgUrl ? (
        <div style={{
          flex: 1,
          display: 'flex',
          overflow: 'hidden',
          position: 'relative',
        }}>
          <img
            src={imgUrl}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {/* fade from dark background into the image on the left edge */}
          <div style={{
            position: 'absolute', top: 0, left: 0, bottom: 0, width: '120px',
            background: 'linear-gradient(to right, #04050a, transparent)',
            display: 'flex',
          }} />
        </div>
      ) : null}

      {/* Footer */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '64px',
        padding: '0 80px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
        background: 'rgba(255,255,255,0.02)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <div style={{
          fontSize: '22px',
          fontWeight: 800,
          color: '#ffffff',
          letterSpacing: '-0.02em',
          display: 'flex',
        }}>
          {siteLabel}
        </div>
        <div style={{
          fontSize: '16px',
          color: '#4a4d62',
          fontWeight: 600,
          display: 'flex',
        }}>
          {handleText}
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
