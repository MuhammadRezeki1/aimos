"use client";

export type ChartSegment = { label: string; value: number; color: string };

function percent(value: number, total: number) {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function ChartDonut({
  segments,
  centerValue,
  centerLabel,
  size = 168,
  thickness = 22,
  showLegend = true,
}: {
  segments: ChartSegment[];
  centerValue?: string;
  centerLabel?: string;
  size?: number;
  thickness?: number;
  showLegend?: boolean;
}) {
  const total = segments.reduce((sum, seg) => sum + (seg.value || 0), 0);
  const radius = (size - thickness) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  const dominant = [...segments].sort((a, b) => b.value - a.value)[0];
  const resolvedValue =
    centerValue ?? (dominant && total ? `${percent(dominant.value, total)}%` : "0%");
  const resolvedLabel = centerLabel ?? (dominant ? dominant.label : "");

  return (
    <div className="chart-donut">
      <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Distribusi data">
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#eef2f7" strokeWidth={thickness} />
        {total > 0
          ? segments.map((seg) => {
              if (!seg.value) return null;
              const dash = (seg.value / total) * circumference;
              const node = (
                <circle
                  key={seg.label}
                  cx={cx}
                  cy={cy}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={thickness}
                  strokeDasharray={`${dash} ${circumference - dash}`}
                  strokeDashoffset={-offset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                />
              );
              offset += dash;
              return node;
            })
          : null}
        <text x={cx} y={cy - 4} textAnchor="middle" className="chart-donut-value">
          {resolvedValue}
        </text>
        <text x={cx} y={cy + 16} textAnchor="middle" className="chart-donut-label">
          {resolvedLabel}
        </text>
      </svg>

      {showLegend ? (
        <ul className="chart-legend">
          {segments.map((seg) => (
            <li key={seg.label}>
              <span className="chart-legend-dot" style={{ background: seg.color }} />
              <span className="chart-legend-name">{seg.label}</span>
              <strong>{percent(seg.value, total)}%</strong>
              <small>{seg.value}</small>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
