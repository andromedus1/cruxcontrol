import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { App } from './App.tsx';

describe('App', () => {
  it('renders the honest local workspace without fabricated climbs', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'My climbs' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'No saved climbs yet' })).toBeInTheDocument();
  });
});
