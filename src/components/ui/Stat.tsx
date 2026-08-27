import Link from "next/link";
import type { ReactNode } from "react";
import { Sparkline, type ChartTone } from "./Charts";

export function Stat({
  label,
  value,
  hint,
  tone = "accent",
  trend,
  href,
  id,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  tone?: ChartTone;
  trend?: number[];
  href?: string;
  id: string;
}) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-3">
        <p className="text-2xs font-medium uppercase tracking-wider text-faint">{label}</p>
        {href ? (
          <span className="text-faint transition-colors group-hover:text-fg" aria-hidden>
            <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 3l5 5-5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
        ) : null}
      </div>
      <p className="mt-2 font-mono text-[26px] font-medium leading-none tracking-tight text-fg">
        {value}
      </p>
      {hint ? <div className="mt-2 text-xs text-faint">{hint}</div> : null}
      {trend?.length ? (
        <div className="pointer-events-none mt-3 h-9">
          <Sparkline values={trend} tone={tone} id={id} height={36} />
        </div>
      ) : null}
    </>
  );

  const className =
    "group block rounded-xl border border-line bg-panel p-4 shadow-subtle transition-colors";

  return href ? (
    <Link href={href} className={`${className} hover:border-line-strong hover:bg-panel-hover`}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}
