import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import i18n from '@/locales/i18n';
import { GrantUserChoices, type GrantUserChoice } from './GrantUserChoices';

const users: GrantUserChoice[] = [
  { id: 'synthetic-a', name: 'Synthetic A', email: 'a@example.invalid' },
  { id: 'synthetic-b', name: 'Synthetic B', email: 'b@example.invalid' },
];

function FormHarness({ onSubmit }: { onSubmit: () => void }) {
  const [selected, setSelected] = useState<GrantUserChoice | null>(null);
  return <form onSubmit={onSubmit}><GrantUserChoices users={users} selectedUser={selected} onSelect={setSelected} /></form>;
}

describe('grant user selection feedback', () => {
  it('shows explicit unselected text without automatically selecting a search result', async () => {
    await i18n.changeLanguage('zh');
    const onSelect = vi.fn();
    render(<GrantUserChoices users={users} selectedUser={null} onSelect={onSelect} />);
    expect(screen.getAllByText('点击选择')).toHaveLength(2);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { pressed: false })).toHaveLength(2);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('shows check, selected badge, strong background and live summary without submitting', async () => {
    await i18n.changeLanguage('zh');
    const submit = vi.fn();
    render(<FormHarness onSubmit={submit} />);
    fireEvent.click(screen.getByRole('button', { name: /Synthetic A/ }));
    const selected = screen.getByRole('button', { name: /Synthetic A/, pressed: true });
    expect(selected).toHaveClass('bg-teal-50', 'border-teal-600');
    expect(selected.querySelector('svg')).not.toBeNull();
    expect(screen.getByText('已选择')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('已选择：Synthetic A（a@example.invalid）');
    expect(selected).toHaveAttribute('type', 'button');
    expect(submit).not.toHaveBeenCalled();
  });

  it('moves the single selected indicator when choosing another user', async () => {
    await i18n.changeLanguage('en');
    render(<FormHarness onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Synthetic A/ }));
    fireEvent.click(screen.getByRole('button', { name: /Synthetic B/ }));
    expect(screen.getByRole('button', { name: /Synthetic A/, pressed: false })).not.toHaveClass('bg-teal-50');
    expect(screen.getByRole('button', { name: /Synthetic B/, pressed: true })).toHaveTextContent('Selected');
    expect(screen.getByRole('status')).toHaveTextContent('Selected user: Synthetic B');
    expect(screen.getAllByRole('button', { pressed: true })).toHaveLength(1);
  });

  it('keeps a truthful summary when a new search filters the selected user out', async () => {
    await i18n.changeLanguage('zh');
    const { rerender } = render(<GrantUserChoices users={users} selectedUser={users[0]} onSelect={vi.fn()} />);
    rerender(<GrantUserChoices users={[users[1]]} selectedUser={users[0]} onSelect={vi.fn()} />);
    expect(screen.getByRole('status')).toHaveTextContent('Synthetic A');
    expect(screen.getByRole('button', { name: /Synthetic B/, pressed: false })).toBeInTheDocument();
  });
});
