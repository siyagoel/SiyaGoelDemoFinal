import type { ReactNode } from "react";
import { areaPath, barHeights, donutSegments, linePath, project } from "@/lib/charts";

export type ChartTone = "accent" | "success" | "warning" | "danger" | "info";

const STROKE: Record<ChartTone, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
  info: "var(--info)",
};

/** Translucent companions; a `var(--token)` cannot take an alpha suffix. */
const SOFT: Record<ChartTone, string> = {
  accent: "var(--accent-soft)",
  success: "var(--success-soft)",
  warning: "var(--warning-soft)",
  danger: "var(--danger-soft)",
  info: "var(--info-soft)",
};

export function Sparkline({
  values,
  tone = "accent",
  width = 220,
  height = 56,
  id,
}: {
  values: number[];
  tone?: ChartTone;
  width?: number;
  height?: number;
  id: string;
}) {
  const points = project(values, { width, height, padding: 4 });
  const stroke = STROKE[tone];
  const last = points[points.length - 1];

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="h-full w-full overflow-visible"
      preserveAspectRatio="none"
      aria-hidden
    >
      <defs>
        <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.28" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath(points, height)} fill={`url(#${id}-fill)`} />
      <path
        d={linePath(points)}
        fill="none"
        stroke={stroke}
        strokeWidth="1.75"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
        style={{ ["--dash" as string]: "600", strokeDasharray: 600, animation: "draw 900ms ease-out both" }}
      />
      {last ? <circle cx={last.x} cy={last.y} r="2.5" fill={stroke} /> : null}
    </svg>
  );
}

export function BarChart({
  data,
  tone = "accent",
  height = 96,
}: {
  data: { label: string; value: number }[];
  tone?: ChartTone;
  height?: number;
}) {
  const heights = barHeights(
    data.map((d) => d.value),
    height,
  );
  const stroke = STROKE[tone];

  return (
    <div className="flex items-end gap-1.5" style={{ height }}>
      {data.map((point, index) => (
        <div key={point.label} className="group relative flex flex-1 flex-col justify-end">
          <div
            title={`${point.label}: ${point.value}`}
            className="w-full rounded-t-[3px] transition-opacity hover:opacity-100"
            style={{
              height: heights[index],
              background: `linear-gradient(to top, ${SOFT[tone]}, ${stroke})`,
              opacity: point.value === 0 ? 0.25 : 0.85,
              animation: `rise 420ms cubic-bezier(0.22,1,0.36,1) ${index * 22}ms both`,
            }}
          />
        </div>
      ))}
    </div>
  );
}

const DONUT_TONES: ChartTone[] = ["success", "warning", "danger", "info", "accent"];

export function Donut({
  slices,
  size = 132,
  thickness = 14,
  center,
}: {
  slices: { label: string; value: number; tone?: ChartTone }[];
  size?: number;
  thickness?: number;
  center?: ReactNode;
}) {
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const segments = donutSegments(slices, circumference, 3);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={thickness}
        />
        {segments.map((segment, index) => {
          const tone = slices.find((s) => s.label === segment.label)?.tone
            ?? DONUT_TONES[index % DONUT_TONES.length];
          return (
            <circle
              key={segment.label}
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="none"
              stroke={STROKE[tone]}
              strokeWidth={thickness}
              strokeLinecap="round"
              strokeDasharray={`${segment.dash} ${circumference - segment.dash}`}
              strokeDashoffset={segment.offset}
              style={{ animation: `fade-in 500ms ease-out ${index * 90}ms both` }}
            />
          );
        })}
      </svg>
      {center ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {center}
        </div>
      ) : null}
    </div>
  );
}

export function Meter({ value, tone = "accent" }: { value: number; tone?: ChartTone }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-overlay-2">
      <div
        className="h-full rounded-full transition-[width] duration-500"
        style={{
          width: `${clamped}%`,
          background:
            clamped === 100
              ? `linear-gradient(90deg, ${SOFT[tone]}, ${STROKE[tone]})`
              : STROKE[tone],
        }}
      />
    </div>
  );
}
