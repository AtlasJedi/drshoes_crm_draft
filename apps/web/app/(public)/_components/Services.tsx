// apps/web/app/(public)/_components/Services.tsx
// Paper-background section showcasing three service categories.
// Design source: handoff/design/landing.jsx — Services() function.
// < 80 LOC per granulate directive.

import React from 'react';
import { Tape } from '@repo/ui';
import { ServiceTile } from './Services/ServiceTile';
import type { ServiceTileProps } from './Services/ServiceTile';

type ServiceEntry = Omit<ServiceTileProps, never>;

const SERVICES: ServiceEntry[] = [
  {
    tag: '01',
    label: 'Naprawa butów',
    imgLabel: 'naprawa · vibram doszyty',
    accentColor: 'var(--acid)',
    tapeColor: 'acid',
    iconKey: 'shoeIcon',
  },
  {
    tag: '02',
    label: 'Custom malowanie butów',
    imgLabel: 'custom · AF1 bandana',
    accentColor: 'var(--pink)',
    tapeColor: 'pink',
    iconKey: 'brushIcon',
  },
  {
    tag: '03',
    label: 'Custom kurtki',
    imgLabel: 'custom · Carhartt back',
    accentColor: 'var(--blue)',
    tapeColor: 'blue',
    iconKey: 'jacketIcon',
  },
];

export function Services() {
  return (
    <section
      className="relative bg-paper"
      style={{ padding: '100px 28px 120px' }}
    >
      <div className="max-w-[1280px] mx-auto">
        {/* Header row */}
        <div className="flex justify-between items-end mb-9 gap-4 flex-wrap">
          <div>
            <Tape color="paper" angle={-2}>co robimy</Tape>
            <h2
              className="t-display"
              style={{ fontSize: 96, margin: '16px 0 0' }}
            >
              Trzy <span style={{ color: 'var(--pink)' }}>rzeczy</span>.<br />
              Robimy je dobrze.
            </h2>
          </div>
          <p
            className="t-mono"
            style={{ fontSize: 13, maxWidth: 360, color: 'rgba(0,0,0,0.7)', lineHeight: 1.5, margin: 0 }}
          >
            Każda para to inna historia. Przed wyceną pisz na DM lub wypełnij
            formularz — odpowiadamy w 24h.
          </p>
        </div>

        {/* 3-column tile grid */}
        <div className="grid grid-cols-3 gap-[22px]">
          {SERVICES.map((svc) => (
            <ServiceTile key={svc.tag} {...svc} />
          ))}
        </div>
      </div>
    </section>
  );
}
