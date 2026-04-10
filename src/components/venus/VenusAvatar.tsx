"use client";

export function VenusAvatar({ size = 48, animated = true }: { size?: number; animated?: boolean }) {
  const s = size;
  const cx = s / 2;
  const r1 = s * 0.47;
  const r2 = s * 0.4;
  const r3 = s * 0.42;

  return (
    <svg width={s} height={s} viewBox={`0 0 ${s} ${s}`} style={{ flexShrink: 0 }}>
      <defs>
        {animated && (
          <>
            <style>{`
              @keyframes venus-rot { from { transform: rotate(0deg); transform-origin: ${cx}px ${cx}px; } to { transform: rotate(360deg); transform-origin: ${cx}px ${cx}px; } }
              @keyframes venus-rotrev { from { transform: rotate(0deg); transform-origin: ${cx}px ${cx}px; } to { transform: rotate(-360deg); transform-origin: ${cx}px ${cx}px; } }
              @keyframes venus-pulse { 0%,100%{opacity:0.3} 50%{opacity:0.08} }
              .va-spin { animation: venus-rot 18s linear infinite; transform-origin: ${cx}px ${cx}px; }
              .va-spinrev { animation: venus-rotrev 28s linear infinite; transform-origin: ${cx}px ${cx}px; }
              .va-pulse { animation: venus-pulse 3s ease-in-out infinite; }
            `}</style>
          </>
        )}
      </defs>

      <circle cx={cx} cy={cx} r={r1 + 4} fill="none" stroke="#C9A84C" strokeWidth="0.4" opacity="0.15" className={animated ? "va-pulse" : ""} />

      <g className={animated ? "va-spin" : ""}>
        <circle cx={cx} cy={cx} r={r1} fill="none" stroke="#C9A84C" strokeWidth="0.5" strokeDasharray="2,8" opacity="0.5" />
        {[0, 90, 180, 270].map((angle) => {
          const rad = (angle * Math.PI) / 180;
          const lx = cx + Math.cos(rad) * r1;
          const ly = cx + Math.sin(rad) * r1;
          const d = s * 0.04;
          return (
            <path
              key={angle}
              d={`M${lx} ${ly - d} L${lx + d} ${ly} L${lx} ${ly + d} L${lx - d} ${ly} Z`}
              fill="#C9A84C"
              opacity="0.7"
            />
          );
        })}
      </g>

      <circle cx={cx} cy={cx} r={r3} fill="none" stroke="#C9A84C" strokeWidth="0.3" strokeDasharray="1,12" opacity="0.25" className={animated ? "va-spinrev" : ""} />

      <circle cx={cx} cy={cx} r={r2} fill="#080808" stroke="#C9A84C" strokeWidth="1.2" />
      <circle cx={cx} cy={cx} r={r2 - s * 0.04} fill="none" stroke="#C9A84C" strokeWidth="0.3" opacity="0.3" />

      <path
        d={`M${cx * 0.38} ${s * 0.16} Q${cx * 0.4} ${s * 0.16} ${cx * 0.44} ${s * 0.17} L${cx * 0.92} ${s * 0.72} Q${cx * 0.94} ${s * 0.75} ${cx} ${s * 0.76}`}
        fill="none"
        stroke="#C9A84C"
        strokeWidth={s * 0.018}
        strokeLinecap="round"
      />
      <path
        d={`M${cx * 1.62} ${s * 0.16} Q${cx * 1.6} ${s * 0.16} ${cx * 1.56} ${s * 0.17} L${cx * 1.08} ${s * 0.72} Q${cx * 1.06} ${s * 0.75} ${cx} ${s * 0.76}`}
        fill="none"
        stroke="#C9A84C"
        strokeWidth={s * 0.018}
        strokeLinecap="round"
      />

      <line x1={cx * 0.29} y1={s * 0.16} x2={cx * 0.47} y2={s * 0.16} stroke="#C9A84C" strokeWidth={s * 0.012} strokeLinecap="round" />
      <line x1={cx * 1.53} y1={s * 0.16} x2={cx * 1.71} y2={s * 0.16} stroke="#C9A84C" strokeWidth={s * 0.012} strokeLinecap="round" />

      <circle cx={cx} cy={s * 0.76} r={s * 0.02} fill="#C9A84C" />
      <circle cx={cx * 0.38} cy={s * 0.16} r={s * 0.015} fill="#C9A84C" />
      <circle cx={cx * 1.62} cy={s * 0.16} r={s * 0.015} fill="#C9A84C" />
    </svg>
  );
}
