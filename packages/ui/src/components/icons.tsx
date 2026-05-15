// packages/ui/src/components/icons.tsx
// Named 1-stroke SVG icon record. Each icon is a JSX element; use as {I.search}.
// Core set (31 keys) verbatim from handoff/design/shared.jsx constant I.
// Extended set adds list + 4 craft icons (sprayCan, shoeIcon, brushIcon, jacketIcon).
// Stroke icons: fill=none, stroke=currentColor, strokeWidth=2, rounded caps.
// LOC overrun note: ~200 LOC for a single dense record per design shared.jsx precedent.
// Granulate exception documented in dispatch log 9-14.

import React from "react";

function Icn({
  children,
  size = 18,
  stroke = 2,
  viewBox = "0 0 24 24",
}: {
  children: React.ReactNode;
  size?: number;
  stroke?: number;
  viewBox?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={viewBox}
      fill="none"
      stroke="currentColor"
      strokeWidth={stroke}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {children}
    </svg>
  );
}

// ---------- Core icon record (31 keys from design/shared.jsx) ----------

export const I = {
  // navigation / actions
  search:    <Icn><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></Icn>,
  bell:      <Icn><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10 21a2 2 0 0 0 4 0" /></Icn>,
  filter:    <Icn><path d="M3 6h18l-7 8v6l-4-2v-4z" /></Icn>,
  plus:      <Icn><path d="M12 5v14" /><path d="M5 12h14" /></Icn>,
  edit:      <Icn><path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4z" /></Icn>,
  trash:     <Icn><path d="M3 6h18" /><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" /></Icn>,
  more:      <Icn><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></Icn>,
  arrow:     <Icn><path d="M5 12h14" /><path d="m13 5 7 7-7 7" /></Icn>,
  arrowLeft: <Icn><path d="M19 12H5" /><path d="m12 19-7-7 7-7" /></Icn>,
  close:     <Icn><path d="M18 6 6 18" /><path d="m6 6 12 12" /></Icn>,
  check:     <Icn><path d="M20 6 9 17l-5-5" /></Icn>,
  calendar:  <Icn><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4" /><path d="M8 2v4" /><path d="M3 10h18" /></Icn>,
  phone:     <Icn><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.33 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" /></Icn>,
  mail:      <Icn><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 6-10 7L2 6" /></Icn>,
  ig:        <Icn><rect x="2" y="2" width="20" height="20" rx="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><circle cx="17.5" cy="6.5" r="0.6" fill="currentColor" /></Icn>,
  pin:       <Icn><path d="M12 22s7-7 7-12a7 7 0 1 0-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></Icn>,
  paperclip: <Icn><path d="M21.44 11.05 12.25 20.24a6 6 0 0 1-8.49-8.49l8.57-8.57a4 4 0 0 1 5.66 5.66l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></Icn>,
  clock:     <Icn><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></Icn>,
  user:      <Icn><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></Icn>,
  zap:       <Icn><path d="M13 2 3 14h7l-1 8 10-12h-7z" /></Icn>,
  msg:       <Icn><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z" /></Icn>,
  store:     <Icn><path d="M3 9 4 4h16l1 5" /><path d="M3 9v11h18V9" /><path d="M9 20v-6h6v6" /></Icn>,
  news:      <Icn><rect x="3" y="3" width="18" height="18" rx="1" /><path d="M7 7h10" /><path d="M7 11h10" /><path d="M7 15h6" /></Icn>,
  dash:      <Icn><rect x="3" y="3" width="7" height="9" /><rect x="14" y="3" width="7" height="5" /><rect x="14" y="12" width="7" height="9" /><rect x="3" y="16" width="7" height="5" /></Icn>,
  set:       <Icn><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></Icn>,
  send:      <Icn><path d="m22 2-7 20-4-9-9-4z" /><path d="M22 2 11 13" /></Icn>,
  drag:      <Icn><circle cx="9" cy="6" r="1" fill="currentColor" /><circle cx="15" cy="6" r="1" fill="currentColor" /><circle cx="9" cy="12" r="1" fill="currentColor" /><circle cx="15" cy="12" r="1" fill="currentColor" /><circle cx="9" cy="18" r="1" fill="currentColor" /><circle cx="15" cy="18" r="1" fill="currentColor" /></Icn>,
  upload:    <Icn><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><path d="M17 8 12 3 7 8" /><path d="M12 3v12" /></Icn>,
  image:     <Icn><rect x="3" y="3" width="18" height="18" rx="2" /><circle cx="8.5" cy="8.5" r="1.5" /><path d="m21 15-5-5L5 21" /></Icn>,
  power:     <Icn><path d="M18.36 6.64a9 9 0 1 1-12.73 0" /><path d="M12 2v10" /></Icn>,
  eye:       <Icn><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></Icn>,

  // ---------- Extended set ----------
  list:      <Icn><path d="M8 6h13" /><path d="M8 12h13" /><path d="M8 18h13" /><path d="M3 6h.01" /><path d="M3 12h.01" /><path d="M3 18h.01" /></Icn>,

  // Craft icons (sidebar nav): spray can, shoe, brush, jacket
  sprayCan:  (
    <Icn>
      <rect x="6" y="9" width="10" height="12" rx="1" />
      <path d="M9 9V6h4v3" />
      <path d="M11 3h2" />
      <circle cx="20" cy="5" r="0.6" fill="currentColor" />
      <circle cx="22" cy="8" r="0.6" fill="currentColor" />
      <circle cx="20" cy="11" r="0.6" fill="currentColor" />
    </Icn>
  ),
  shoeIcon:  (
    <Icn viewBox="0 0 32 24">
      <path d="M2 18 L2 14 Q2 10 6 9 L11 8 L16 4 L20 8 L26 10 Q30 11 30 16 L30 18 Z" />
      <path d="M2 18 L30 18" />
      <path d="M11 8 L13 12" />
    </Icn>
  ),
  brushIcon: (
    <Icn>
      <path d="M14 3 L21 10 L18 13 L11 6 Z" />
      <path d="M11 6 L5 12 L7 14 L4 17 L8 21 L11 18 L13 20 L19 14" />
    </Icn>
  ),
  jacketIcon: (
    <Icn>
      <path d="M7 3 L4 6 L4 21 L20 21 L20 6 L17 3 L15 5 L12 8 L9 5 Z" />
      <path d="M12 8 L12 21" />
      <path d="M14 11 L14 14" />
    </Icn>
  ),
} as const;

export type IconKey = keyof typeof I;
