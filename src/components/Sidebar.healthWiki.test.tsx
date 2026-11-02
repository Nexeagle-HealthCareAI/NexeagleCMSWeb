import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useAuthStore } from '../store/useAuthStore';

const renderSidebar = () =>
  render(
    <MemoryRouter>
      <Sidebar isOpen toggle={() => {}} isMobile={false} />
    </MemoryRouter>,
  );

describe('Sidebar Health Wiki item', () => {
  beforeEach(() => useAuthStore.setState({ permissions: [] }));

  it('is hidden without the health-wiki.manage permission', () => {
    renderSidebar();
    expect(screen.queryByRole('link', { name: /Health Wiki/ })).not.toBeInTheDocument();
  });

  it('links to /health-wiki when the permission is held', () => {
    useAuthStore.setState({ permissions: ['health-wiki.manage'] });
    renderSidebar();
    expect(screen.getByRole('link', { name: /Health Wiki/ })).toHaveAttribute('href', '/health-wiki');
  });
});
