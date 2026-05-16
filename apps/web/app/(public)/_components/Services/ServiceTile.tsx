// apps/web/app/(public)/_components/Services/ServiceTile.tsx
// Single 3:4 service card — PhImg + tag number + Tape label + icon badge.
// < 50 LOC per granulate directive.

import React from 'react';
import { PhImg, Tape, I } from '@drshoes/ui';
import type { TapeColor } from '@drshoes/ui';

export interface ServiceTileProps {
  tag: '01' | '02' | '03';
  label: string;
  imgLabel: string;
  accentColor: string;
  tapeColor: TapeColor;
  iconKey: 'shoeIcon' | 'brushIcon' | 'jacketIcon';
}

export function ServiceTile({
  tag, label, imgLabel, accentColor, tapeColor, iconKey,
}: ServiceTileProps) {
  return (
    <a
      href="#zamow"
      className="zoom-card relative border-[3px] border-ink overflow-hidden bg-paper-2 no-underline text-ink shadow-[8px_8px_0_var(--ink)]"
      style={{ aspectRatio: '3/4', display: 'block' }}
    >
      <PhImg
        dark
        label={imgLabel}
        style={{ width: '100%', height: '100%', border: 'none', position: 'absolute', inset: 0 }}
      />
      {/* Large tag number top-left */}
      <div
        className="absolute top-3.5 left-3.5"
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 64,
          color: accentColor,
          lineHeight: 0.8,
          mixBlendMode: 'screen',
        }}
      >
        {tag}
      </div>
      {/* Bottom row: tape label + icon badge */}
      <div className="absolute left-3.5 right-3.5 bottom-3.5 flex items-end justify-between">
        <Tape color={tapeColor} angle={-2}>{label}</Tape>
        <div style={{ background: 'var(--paper)', padding: 8, border: '2px solid var(--ink)', color: 'var(--ink)' }}>
          {I[iconKey]}
        </div>
      </div>
    </a>
  );
}
