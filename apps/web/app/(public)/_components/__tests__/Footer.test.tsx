// apps/web/app/(public)/_components/__tests__/Footer.test.tsx
// Vitest + RTL unit tests for Footer.

import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Footer } from '../Footer';

describe('Footer', () => {
  it('matches snapshot', () => {
    const { container } = render(<Footer />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders copyright text', () => {
    render(<Footer />);
    expect(screen.getByText(/© 2026 Dr Shoes/i)).toBeInTheDocument();
  });

  it('renders "made with paint & duct tape"', () => {
    render(<Footer />);
    expect(screen.getByText(/made with paint & duct tape/i)).toBeInTheDocument();
  });
});
