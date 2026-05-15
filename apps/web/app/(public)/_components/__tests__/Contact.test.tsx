// apps/web/app/(public)/_components/__tests__/Contact.test.tsx
// Vitest + RTL unit tests for Contact section.

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Contact } from '../Contact';

describe('Contact', () => {
  it('matches snapshot', () => {
    const { container } = render(<Contact />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders section with id="kontakt"', () => {
    const { container } = render(<Contact />);
    expect(container.querySelector('#kontakt')).toBeInTheDocument();
  });

  it('renders workshop address', () => {
    render(<Contact />);
    expect(screen.getByText(/ul\. Włodkowica/i)).toBeInTheDocument();
  });

  it('renders workshop hours', () => {
    render(<Contact />);
    expect(screen.getByText(/Pn.+11/i)).toBeInTheDocument();
  });

  it('renders phone number', () => {
    render(<Contact />);
    expect(screen.getByText(/\+48 794 220 118/)).toBeInTheDocument();
  });
});
