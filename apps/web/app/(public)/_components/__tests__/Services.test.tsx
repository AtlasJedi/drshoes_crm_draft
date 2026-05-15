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

  it('renders tile for Naprawa butów', () => {
    render(<Services />);
    expect(screen.getByText('Naprawa butów')).toBeInTheDocument();
  });

  it('renders tile for Custom malowanie butów', () => {
    render(<Services />);
    expect(screen.getByText('Custom malowanie butów')).toBeInTheDocument();
  });

  it('renders tile for Custom kurtki', () => {
    render(<Services />);
    expect(screen.getByText('Custom kurtki')).toBeInTheDocument();
  });

  it('renders tag numbers 01 02 03', () => {
    render(<Services />);
    expect(screen.getByText('01')).toBeInTheDocument();
    expect(screen.getByText('02')).toBeInTheDocument();
    expect(screen.getByText('03')).toBeInTheDocument();
  });
});
