'use client';

export function VenusAvatar({ size = 48, animated = true }: { size?: number; animated?: boolean }) {
  const s = size;
  const cx = s / 2;
  const r1 = s * 0.46;
  const r2 = s * 0.39;
  const strokeMain = s * 0.038;
  const strokeInner = s * 0.009;
  const strokeSerif = s * 0.026;
  const dotR = s * 0.026;
  const diamondSize = s * 0.07;

  // Pontos do V
  const vLeftX = cx * 0.22;
  const vRightX = cx * 1.78;
  const vTopY = s * 0.15;
  const vBottomY = s * 0.79;

  // Pontos das serifas
  const serifPad = s * 0.09;

  const animStyle = animated ? `
    @keyframes va-rot-${s} {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }
    @keyframes va-rotrev-${s} {
      from { transform: rotate(0deg); }
      to { transform: rotate(-360deg); }
    }
    @keyframes va-pulse-${s} {
      0%, 100% { opacity: 0.18; }
      50% { opacity: 0.05; }
    }
    .va-spin-${s} {
      transform-origin: ${cx}px ${cx}px;
      animation: va-rot-${s} 20s linear infinite;
    }
    .va-spinrev-${s} {
      transform-origin: ${cx}px ${cx}px;
      animation: va-rotrev-${s} 32s linear infinite;
    }
    .va-pulse-${s} {
      transform-origin: ${cx}px ${cx}px;
      animation: va-pulse-${s} 3.5s ease-in-out infinite;
    }
  ` : '';

  const diamond = (lx: number, ly: number, d: number) =>
    `M${lx} ${ly - d} L${lx + d} ${ly} L${lx} ${ly + d} L${lx - d} ${ly} Z`;

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      style={{ flexShrink: 0, display: 'block' }}
    >
      {animated && <style>{animStyle}</style>}

      {/* Halo pulsante */}
      <circle
        cx={cx} cy={cx} r={r1 + s * 0.06}
        fill="none" stroke="#C9A84C" strokeWidth="0.4" opacity="0.15"
        className={animated ? `va-pulse-${s}` : ''}
      />

      {/* Anel externo com losangos nos eixos */}
      <g className={animated ? `va-spin-${s}` : ''}>
        <circle cx={cx} cy={cx} r={r1} fill="none" stroke="#C9A84C"
          strokeWidth="0.5" strokeDasharray="2,9" opacity="0.5" />
        {[0, 90, 180, 270].map(angle => {
          const rad = (angle * Math.PI) / 180;
          const lx = cx + Math.cos(rad) * r1;
          const ly = cx + Math.sin(rad) * r1;
          const d = s * 0.038;
          return <path key={angle} d={diamond(lx, ly, d)} fill="#C9A84C" opacity="0.8" />;
        })}
      </g>

      {/* Anel contra-rotação sutil */}
      <circle
        cx={cx} cy={cx} r={r1 - s * 0.04}
        fill="none" stroke="#C9A84C"
        strokeWidth="0.3" strokeDasharray="1,13" opacity="0.2"
        className={animated ? `va-spinrev-${s}` : ''}
      />

      {/* Círculo principal */}
      <circle cx={cx} cy={cx} r={r2} fill="#080808" stroke="#C9A84C" strokeWidth="1.4" />
      {/* Anel interno sutil */}
      <circle cx={cx} cy={cx} r={r2 - s * 0.045}
        fill="none" stroke="#C9A84C" strokeWidth="0.3" opacity="0.3" />

      {/* V — preenchimento translúcido */}
      <path
        d={`M${vLeftX} ${vTopY} L${cx} ${vBottomY} L${vRightX} ${vTopY} L${vRightX - s*0.07} ${vTopY} L${cx} ${vBottomY - s*0.1} L${vLeftX + s*0.07} ${vTopY} Z`}
        fill="#C9A84C" opacity="0.1"
      />

      {/* V — stroke principal bold */}
      <path
        d={`M${vLeftX} ${vTopY} L${cx} ${vBottomY} L${vRightX} ${vTopY}`}
        fill="none" stroke="#C9A84C"
        strokeWidth={strokeMain} strokeLinecap="round" strokeLinejoin="round"
      />

      {/* V — linha interna fina (efeito duplo de luxo) */}
      <path
        d={`M${vLeftX + s*0.06} ${vTopY} L${cx} ${vBottomY - s*0.08} L${vRightX - s*0.06} ${vTopY}`}
        fill="none" stroke="#C9A84C"
        strokeWidth={strokeInner} strokeLinecap="round" strokeLinejoin="round" opacity="0.45"
      />

      {/* Serifa esquerda */}
      <line
        x1={vLeftX - serifPad} y1={vTopY}
        x2={vLeftX + serifPad} y2={vTopY}
        stroke="#C9A84C" strokeWidth={strokeSerif} strokeLinecap="round"
      />
      {/* Serifa direita */}
      <line
        x1={vRightX - serifPad} y1={vTopY}
        x2={vRightX + serifPad} y2={vTopY}
        stroke="#C9A84C" strokeWidth={strokeSerif} strokeLinecap="round"
      />

      {/* Pontos nas pontas do V */}
      <circle cx={vLeftX} cy={vTopY} r={dotR} fill="#C9A84C" />
      <circle cx={vRightX} cy={vTopY} r={dotR} fill="#C9A84C" />

      {/* Diamante na base */}
      <path
        d={diamond(cx, vBottomY + diamondSize * 0.6, diamondSize * 0.55)}
        fill="#C9A84C" opacity="0.65"
      />
    </svg>
  );
}
