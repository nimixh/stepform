"use client";

/** Thin-stroke line icons in the spirit of Typeform's icon set. */
function base(props: React.SVGProps<SVGSVGElement>, children: React.ReactNode) {
  return (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export const IconPalette = (p: React.SVGProps<SVGSVGElement>) =>
  base(
    p,
    <>
      <circle cx="12" cy="12" r="9" />
      <circle cx="8.5" cy="10" r="1" fill="currentColor" />
      <circle cx="12" cy="7.5" r="1" fill="currentColor" />
      <circle cx="15.5" cy="10" r="1" fill="currentColor" />
      <path d="M12 21c-1 0-1.5-.5-1.5-1.5 0-1.5 1-2 2.5-2H15a3.5 3.5 0 0 0 3.5-3.5" />
    </>
  );

export const IconMobile = (p: React.SVGProps<SVGSVGElement>) =>
  base(
    p,
    <>
      <rect x="7" y="3" width="10" height="18" rx="2.5" />
      <line x1="11" y1="18" x2="13" y2="18" />
    </>
  );

export const IconPlay = (p: React.SVGProps<SVGSVGElement>) =>
  base(
    p,
    <>
      <polygon points="7 4.5 19 12 7 19.5" />
    </>
  );

export const IconGear = (p: React.SVGProps<SVGSVGElement>) =>
  base(
    p,
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.11-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 8.89a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.11A1.7 1.7 0 0 0 10.11 3V3a2 2 0 1 1 4 0v.09c0 .68.4 1.3 1 1.55.61.26 1.32.11 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.11c.26.61.88 1 1.55 1H21a2 2 0 1 1 0 4h-.09c-.68 0-1.3.4-1.51 1z" />
    </>
  );

export const IconLink = (p: React.SVGProps<SVGSVGElement>) =>
  base(
    p,
    <>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </>
  );

export const IconDownload = (p: React.SVGProps<SVGSVGElement>) =>
  base(
    p,
    <>
      <path d="M12 3v12" />
      <path d="M7 10l5 5 5-5" />
      <path d="M4 21h16" />
    </>
  );
