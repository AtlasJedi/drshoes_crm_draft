import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Services } from '../Services';

describe('Services', () => {
  it('matches snapshot', () => {
    const { container } = render(<Services />);
    expect(container.firstChild).toMatchSnapshot();
  });

  it('renders 3 service tiles', () => {
    render(<Services />);
    const tiles = screen.getAllByRole('link');
    expect(tiles.filter(el => el.getAttribute('href') === '#zamow').length).toBe(3);
  });

  it('renders tile for Usługa naprawy', () => {
    render(<Services />);
    expect(screen.getByText('Usługa naprawy')).toBeInTheDocument();
  });

  it('renders tile for Custom malowanie butów', () => {
    render(<Services />);
    expect(screen.getByText('Custom malowanie butów')).toBeInTheDocument();
  });

  it('renders tile for Custom malowanie kurtek', () => {
    render(<Services />);
    expect(screen.getByText('Custom malowanie kurtek')).toBeInTheDocument();
  });

  it('renders tag numbers 01 02 03', () => {
    render(<Services />);
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
  });
});
