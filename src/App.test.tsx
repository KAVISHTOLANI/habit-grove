import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

describe('Habit Grove workflow', () => {
  it('shows an empty state on Today', () => {
    localStorage.setItem('habit-grove:store', JSON.stringify({ habits: [], checkins: {} }));
    window.location.hash = '/today';
    render(<App />);
    expect(screen.getByText('No habits yet')).toBeInTheDocument();
  });

  it('creates a habit with validation, then checks in', async () => {
    localStorage.setItem('habit-grove:store', JSON.stringify({ habits: [], checkins: {} }));
    window.location.hash = '/habits';
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Every day' }));
    // Clear all days to trigger validation
    for (const d of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']) await user.click(screen.getByLabelText(d));
    await user.click(screen.getByRole('button', { name: 'Create habit' }));
    expect(screen.getByText(/Name the habit/)).toBeInTheDocument();
    expect(screen.getByText('Pick at least one day.')).toBeInTheDocument();

    await user.type(screen.getByLabelText('Habit name'), 'Drink water');
    await user.click(screen.getByRole('button', { name: 'Every day' }));
    await user.click(screen.getByRole('button', { name: 'Create habit' }));
    expect(screen.getByText(/Created “Drink water”/)).toBeInTheDocument();
    unmount();

    window.location.hash = '/today';
    render(<App />);
    expect(screen.getByTestId('today-summary')).toHaveTextContent('0 of 1');
    await user.click(screen.getByRole('button', { name: 'Check in Drink water' }));
    expect(screen.getByTestId('today-summary')).toHaveTextContent('1 of 1');
    expect(screen.getByText('1 day streak')).toBeInTheDocument();
  });

  it('loads demo data and shows weekly stats', async () => {
    localStorage.setItem('habit-grove:store', JSON.stringify({ habits: [], checkins: {} }));
    window.location.hash = '/today';
    const user = userEvent.setup();
    const { unmount } = render(<App />);
    await user.click(screen.getByRole('button', { name: 'Load demo habits' }));
    expect(screen.getByText('Walk 20 minutes')).toBeInTheDocument();
    unmount();
    window.location.hash = '/stats';
    render(<App />);
    expect(screen.getByRole('heading', { name: 'By habit' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /heatmap/ })).toBeInTheDocument();
  });
});

describe('default state', () => {
  it('opens with labelled demo habits', () => {
    window.location.hash = '/today';
    render(<App />);
    expect(screen.getAllByText('Demo data').length).toBeGreaterThan(0);
  });
});
