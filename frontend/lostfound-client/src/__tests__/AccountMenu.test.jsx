import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import AccountMenu from '../components/AccountMenu';

describe('AccountMenu', () => {
  test('renders notification bell', () => {
    render(
      <MemoryRouter>
        <AccountMenu />
      </MemoryRouter>
    );
    const bell = screen.getByTitle('Notifications');
    expect(bell).toBeInTheDocument();
  });
});
