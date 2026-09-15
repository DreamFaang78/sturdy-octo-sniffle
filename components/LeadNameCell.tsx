import React from 'react';

export interface LeadNameCellProps {
  name: string;
  phone?: string;
  flameCount?: number;
  className?: string;
}

export default function LeadNameCell({
  name,
  phone,
  flameCount,
  className = '',
}: LeadNameCellProps) {
  // Extract flame emoji count from name string if not explicitly passed
  const countInName = (name.match(/🔥/g) || []).length;
  const totalFlames = flameCount !== undefined ? flameCount : countInName;

  // Clean name string by stripping repetitive flame emojis
  const cleanName = name.replace(/🔥+/g, '').trim();

  return (
    <div className={`flex flex-col min-w-0 ${className}`}>
      {/* Patient Name + Optional Fixed Flame Badge Container */}
      <div className="flex flex-wrap items-baseline gap-1.5 min-w-0">
        <span
          className="font-semibold text-white text-sm leading-snug break-words"
          style={{
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
          title={cleanName}
        >
          {cleanName}
        </span>

        {totalFlames > 0 && (
          <span className="inline-flex items-center space-x-0.5 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded font-mono text-[10px] font-extrabold shrink-0 whitespace-nowrap shadow-sm">
            <span>🔥</span>
            <span>{totalFlames > 1 ? `x${totalFlames}` : 'HOT'}</span>
          </span>
        )}
      </div>

      {/* Optional Phone Number */}
      {phone && (
        <div className="text-slate-400 font-mono text-xs mt-0.5">
          {phone}
        </div>
      )}
    </div>
  );
}
