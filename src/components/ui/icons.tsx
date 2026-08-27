import type { SVGProps } from "react";

/**
 * Inline 16px stroke icons. Kept in one file so the app has a consistent icon
 * weight without an icon-library dependency.
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement> & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconShield = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 1.75l5 1.75v4c0 3-2.1 5.6-5 6.75-2.9-1.15-5-3.75-5-6.75v-4l5-1.75z" />
    <path d="M5.9 8l1.5 1.5L10.4 6.5" />
  </Icon>
);

export const IconToggle = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="1.75" y="4.75" width="12.5" height="6.5" rx="3.25" />
    <circle cx="10.75" cy="8" r="1.6" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconHistory = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M2.6 8a5.4 5.4 0 105.4-5.4A5.38 5.38 0 004 4.3" />
    <path d="M2.2 2.2v2.4h2.4" />
    <path d="M8 5.2V8l1.9 1.2" />
  </Icon>
);

export const IconGauge = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M2.4 11.4a6 6 0 1111.2 0" />
    <path d="M8 8.6l2.6-2.3" />
    <circle cx="8" cy="11.4" r="0.9" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconSearch = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="7.2" cy="7.2" r="4.2" />
    <path d="M10.4 10.4L13.4 13.4" />
  </Icon>
);

export const IconChevron = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 6l4 4 4-4" />
  </Icon>
);

export const IconArrowRight = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3 8h9.5" />
    <path d="M9 4.5L12.5 8 9 11.5" />
  </Icon>
);

export const IconCheck = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M3.2 8.4l3 3 6.6-6.8" />
  </Icon>
);

export const IconX = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Icon>
);

export const IconEscalate = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 2.6l5.4 9.4H2.6L8 2.6z" />
    <path d="M8 6.4v2.6" />
    <circle cx="8" cy="10.6" r="0.55" fill="currentColor" stroke="none" />
  </Icon>
);

export const IconUser = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="8" cy="5.6" r="2.6" />
    <path d="M3 13.2a5 5 0 0110 0" />
  </Icon>
);

export const IconLock = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="3.4" y="7" width="9.2" height="6.4" rx="1.6" />
    <path d="M5.6 7V5.2a2.4 2.4 0 014.8 0V7" />
  </Icon>
);

export const IconDownload = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 2.6v7.2" />
    <path d="M5.2 7.4L8 10.2l2.8-2.8" />
    <path d="M3 12.4h10" />
  </Icon>
);

export const IconSun = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <circle cx="8" cy="8" r="3" />
    <path d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6M3.3 3.3l1.15 1.15M11.55 11.55l1.15 1.15M12.7 3.3l-1.15 1.15M4.45 11.55L3.3 12.7" />
  </Icon>
);

export const IconMoon = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M13.2 9.6A5.6 5.6 0 016.4 2.8a5.6 5.6 0 106.8 6.8z" />
  </Icon>
);

export const IconMoney = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <rect x="1.75" y="4" width="12.5" height="8" rx="1.6" />
    <circle cx="8" cy="8" r="1.7" />
    <path d="M4.3 8h.01M11.7 8h.01" />
  </Icon>
);

export const IconSpark = (p: SVGProps<SVGSVGElement>) => (
  <Icon {...p}>
    <path d="M8 1.8l1.5 4.2 4.2 1.5-4.2 1.5L8 13.2 6.5 9 2.3 7.5 6.5 6z" />
  </Icon>
);
