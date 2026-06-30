import { ImageResponse } from '@vercel/og';

export const config = { runtime: 'edge' };

export default async function handler(req) {
  const { searchParams } = new URL(req.url);
  const target  = (searchParams.get('t') || 'Unknown').slice(0, 42);
  const why     = (searchParams.get('w') || '').slice(0, 110);
  const isSmear = searchParams.get('m') === 's';

  const accent  = isSmear ? '#B22234' : '#FF3D00';
  const accent2 = isSmear ? '#3C3B6E' : '#FF8C00';
  const badge   = isSmear ? '⭐ SMEAR CAMPAIGN' : '💀 FUD CAMPAIGN';

  const targetSize = target.length > 28 ? 56 : target.length > 18 ? 68 : 80;

  return new ImageResponse(
    <div
      style={{
        width: '1200px',
        height: '630px',
        background: '#04050a',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px 80px',
        position: 'relative',
        fontFamily: 'system-ui, -apple-system, sans-serif',
      }}
    >
      {/* scanline texture */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: 'repeating-linear-gradient(0deg, rgba(0,0,0,.04) 0px, rgba(0,0,0,.04) 1px, transparent 1px, transparent 2px)',
      }} />

      {/* accent glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: `radial-gradient(ellipse 65% 70% at 15% 55%, ${accent}2a 0%, transparent 65%)`,
      }} />

      {/* top-right glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        background: `radial-gradient(ellipse 50% 50% at 85% 20%, ${accent2}18 0%, transparent 55%)`,
      }} />

      {/* badge row */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '30px',
      }}>
        <div style={{
          background: `linear-gradient(135deg, ${accent}, ${accent2})`,
          borderRadius: '99px', padding: '9px 22px',
          fontSize: '20px', fontWeight: 800, color: '#fff',
          letterSpacing: '0.06em', textTransform: 'uppercase',
          boxShadow: `0 0 24px ${accent}66`,
        }}>
          {badge}
        </div>
        <div style={{
          color: '#3a3d52', fontSize: '17px', fontWeight: 600,
          letterSpacing: '0.04em',
        }}>
          {isSmear ? 'smearfun.xyz' : 'fudfun.xyz'}
        </div>
      </div>

      {/* target name */}
      <div style={{
        fontSize: `${targetSize}px`,
        fontWeight: 900,
        color: '#F0F1FA',
        lineHeight: 1.08,
        marginBottom: '20px',
        letterSpacing: '-0.03em',
      }}>
        {target}
      </div>

      {/* horizontal accent line */}
      <div style={{
        width: '80px', height: '4px',
        background: `linear-gradient(90deg, ${accent}, ${accent2})`,
        borderRadius: '99px',
        marginBottom: '20px',
        boxShadow: `0 0 12px ${accent}88`,
      }} />

      {/* why text */}
      {why ? (
        <div style={{
          fontSize: '26px', color: '#b0b3cc', lineHeight: 1.45,
          maxWidth: '900px',
        }}>
          "{why}"
        </div>
      ) : null}

      {/* footer bar */}
      <div style={{
        position: 'absolute', bottom: '0px', left: '0px', right: '0px',
        height: '64px', padding: '0 80px',
        background: 'rgba(255,255,255,.03)',
        borderTop: '1px solid rgba(255,255,255,.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div style={{
          fontSize: '22px', fontWeight: 800, color: '#ffffff',
          letterSpacing: '-0.02em',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          {isSmear ? '⭐ SmearFun.xyz' : '💀 FudFun.xyz'}
        </div>
        <div style={{
          fontSize: '16px', color: '#4a4d62', fontWeight: 600,
          letterSpacing: '0.02em',
        }}>
          {isSmear ? '@smearfunxyz on X' : '@fudfunn on X'}
        </div>
      </div>
    </div>,
    { width: 1200, height: 630 }
  );
}
