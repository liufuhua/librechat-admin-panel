import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Button, ClickUIProvider } from '@clickhouse/click-ui';
import i18n from '@/locales/i18n';
import { FormDialog } from './FormDialog';

describe('FormDialog submission boundary', () => {
  it.each([{ submitDisabled: true }, { saving: true }])('blocks submission when %j', (state) => {
    const submit = vi.fn();
    render(<ClickUIProvider theme="light"><FormDialog open title="Grant" submitLabel="Create" onSubmit={submit} onClose={vi.fn()} {...state}><input aria-label="Reason" /></FormDialog></ClickUIProvider>);
    fireEvent.submit(screen.getByLabelText('Reason').closest('form')!);
    expect(submit).not.toHaveBeenCalled();
  });

  it('cancel and secondary search do not submit; explicit create does', async () => {
    await i18n.changeLanguage('en');
    const submit = vi.fn(); const close = vi.fn(); const search = vi.fn();
    render(<ClickUIProvider theme="light"><FormDialog open title="Grant" submitLabel="Create" onSubmit={submit} onClose={close}>
      <Button type="secondary" label="Search" onClick={(event) => { event.preventDefault(); search(); }} />
    </FormDialog></ClickUIProvider>);
    fireEvent.click(screen.getByRole('button', { name: 'Search', exact: true }));
    expect(search).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel', exact: true }));
    expect(close).toHaveBeenCalledTimes(1);
    expect(submit).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Create', exact: true }));
    expect(submit).toHaveBeenCalledTimes(1);
  });
});
