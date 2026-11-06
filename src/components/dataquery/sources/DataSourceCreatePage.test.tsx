import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import type * as t from '@/types';
import { createDataQuerySourceFn, setDataQuerySourceEnabledFn, testDataQuerySourceFn, updateDataQuerySourceCredentialFn } from '@/server';
import { DataSourceCreatePage } from './DataSourceCreatePage';

const navigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
  useNavigate: () => navigate,
  useBlocker: vi.fn(),
}));
vi.mock('@clickhouse/click-ui', () => ({
  Button: ({ label, disabled, onClick }: { label: string; disabled?: boolean; onClick: () => void }) => (
    <button disabled={disabled} onClick={onClick}>{label}</button>
  ),
}));
vi.mock('@/hooks', () => ({ useLocalize: () => (key: string) => key }));
vi.mock('@/utils', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));
vi.mock('@/server', () => ({
  createDataQuerySourceFn: vi.fn(),
  testDataQuerySourceFn: vi.fn(),
  setDataQuerySourceEnabledFn: vi.fn(),
  updateDataQuerySourceCredentialFn: vi.fn(),
}));
vi.mock('./CredentialFields', () => ({
  CredentialFields: ({ credential, onChange }: {
    credential: t.DataQueryCredentialInput; onChange: (credential: t.DataQueryCredentialInput) => void;
  }) => <>
    <input aria-label="synthetic password" type="password" value={credential.password} onChange={(event) => onChange({ ...credential, password: event.target.value })} />
    <button onClick={() => onChange({ ...credential, host: 'localhost', database: 'synthetic', username: 'readonly', password: 'synthetic-only' })}>fill synthetic credentials</button>
  </>,
}));

const source = { source_key: 'wizard_test', name: 'Synthetic wizard', source_type: 'postgresql', environment: 'dev',
  owner_team: null, risk_level: 'medium', enabled: false, last_connection_status: 'failed', last_connection_code: 'network_unreachable' } as t.DataQuerySource;

function mount(initialSource?: t.DataQuerySource) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false }, queries: { retry: false } } });
  render(<QueryClientProvider client={client}><DataSourceCreatePage initialSource={initialSource} /></QueryClientProvider>);
}

function nextToCredentials() {
  fireEvent.change(screen.getByLabelText('com_data_query_source_name'), { target: { value: 'Synthetic wizard' } });
  fireEvent.change(screen.getByLabelText(/com_data_query_source_key/), { target: { value: 'wizard_test' } });
  fireEvent.click(screen.getByRole('button', { name: 'com_ui_next' }));
}

async function createAndReachScope() {
  nextToCredentials();
  fireEvent.click(screen.getByRole('button', { name: 'fill synthetic credentials' }));
  fireEvent.change(screen.getByLabelText('com_data_query_reason'), { target: { value: 'Synthetic regression only' } });
  fireEvent.click(screen.getByRole('button', { name: 'com_data_query_create_and_test' }));
  await screen.findByText('com_data_query_connection_test');
  fireEvent.click(screen.getByRole('button', { name: 'com_ui_next' }));
  expect(screen.getByText('com_data_query_discovery_scope')).toBeInTheDocument();
}

describe('DataSourceCreatePage navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(createDataQuerySourceFn).mockResolvedValue(source);
    vi.mocked(testDataQuerySourceFn).mockResolvedValue({ status: 'passed', code: 'connection_ok' } as t.DataQueryConnectionResult);
    vi.mocked(setDataQuerySourceEnabledFn).mockResolvedValue(source);
    vi.mocked(updateDataQuerySourceCredentialFn).mockResolvedValue({ ...source, last_connection_status: 'passed', last_connection_code: 'connection_ok' });
  });

  it('returns from scope to test results without recreating or retesting the source', async () => {
    mount();
    await createAndReachScope();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_back' }));
    expect(screen.getByText('com_data_query_connection_test')).toBeInTheDocument();
    expect(screen.getByText('connection_ok')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'com_ui_back' })).toBeEnabled();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_next' }));
    expect(screen.getByRole('checkbox')).toBeChecked();
    expect(createDataQuerySourceFn).toHaveBeenCalledTimes(1);
    expect(testDataQuerySourceFn).toHaveBeenCalledTimes(1);
    expect(setDataQuerySourceEnabledFn).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('keeps the failure result when returning from scope', async () => {
    vi.mocked(testDataQuerySourceFn).mockRejectedValue(new Error('synthetic_connection_failed'));
    mount();
    await createAndReachScope();
    expect(screen.getByRole('checkbox')).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_back' }));
    expect(screen.getByText('com_data_query_connection_not_available')).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('synthetic_connection_failed');
    expect(createDataQuerySourceFn).toHaveBeenCalledTimes(1);
  });

  it('still returns from connection configuration to unchanged basic information', () => {
    mount();
    nextToCredentials();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_back' }));
    expect(screen.getByLabelText('com_data_query_source_name')).toHaveValue('Synthetic wizard');
    expect(screen.getByRole('button', { name: 'com_ui_back' })).toBeDisabled();
    expect(createDataQuerySourceFn).not.toHaveBeenCalled();
  });

  it('does not navigate backwards while finishing the saved source', async () => {
    let resolve!: (value: t.DataQuerySource) => void;
    vi.mocked(setDataQuerySourceEnabledFn).mockImplementation(() => new Promise((done) => { resolve = done; }));
    mount();
    await createAndReachScope();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_done' }));
    await waitFor(() => expect(setDataQuerySourceEnabledFn).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'com_ui_back' })).toBeDisabled();
    await act(async () => resolve(source));
    await waitFor(() => expect(navigate).toHaveBeenCalledTimes(1));
  });

  it('allows failed tests to return to credentials and retest the same source without recreating', async () => {
    vi.mocked(testDataQuerySourceFn).mockResolvedValue({ source_key: 'wizard_test', status: 'failed', code: 'network_unreachable' });
    mount();
    await createAndReachScope();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_back' }));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_back' }));
    expect(screen.getByRole('button', { name: 'com_data_query_rotate_and_test' })).toBeDisabled();
    expect(screen.getByLabelText('synthetic password')).toHaveValue('');
    expect(updateDataQuerySourceCredentialFn).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'fill synthetic credentials' }));
    fireEvent.click(screen.getByRole('button', { name: 'com_data_query_rotate_and_test' }));
    await screen.findByText('connection_ok');
    expect(createDataQuerySourceFn).toHaveBeenCalledTimes(1);
    expect(testDataQuerySourceFn).toHaveBeenCalledTimes(1);
    expect(updateDataQuerySourceCredentialFn).toHaveBeenCalledExactlyOnceWith({ data: {
      sourceKey: 'wizard_test', credential: expect.objectContaining({ password: 'synthetic-only' }),
      reason: 'Synthetic regression only', requireConnectionSuccess: true,
    } });
    expect(setDataQuerySourceEnabledFn).not.toHaveBeenCalled();
  });

  it('keeps a rejected credential correction on step 2 with password cleared and no extra source', async () => {
    vi.mocked(updateDataQuerySourceCredentialFn).mockRejectedValue(new Error('credential_connection_test_failed'));
    mount();
    await createAndReachScope();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_back' }));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_back' }));
    fireEvent.click(screen.getByRole('button', { name: 'fill synthetic credentials' }));
    fireEvent.click(screen.getByRole('button', { name: 'com_data_query_rotate_and_test' }));
    await screen.findByRole('alert');
    expect(screen.getByRole('alert')).toHaveTextContent('credential_connection_test_failed');
    expect(screen.getByLabelText('synthetic password')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'com_data_query_rotate_and_test' })).toBeDisabled();
    expect(createDataQuerySourceFn).toHaveBeenCalledTimes(1);
    expect(setDataQuerySourceEnabledFn).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it('permits all back steps but locks basic identity after a source has been created', async () => {
    mount();
    await createAndReachScope();
    for (let i = 0; i < 3; i++) fireEvent.click(screen.getByRole('button', { name: 'com_ui_back' }));
    expect(screen.getByLabelText('com_data_query_source_name')).toBeDisabled();
    expect(screen.getByLabelText(/com_data_query_source_key/)).toHaveValue('wizard_test');
    expect(screen.getByLabelText(/com_data_query_source_key/)).toBeDisabled();
    expect(screen.getByRole('button', { name: 'com_ui_back' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_next' }));
    expect(screen.getByRole('button', { name: 'com_data_query_rotate_and_test' })).toBeDisabled();
    expect(createDataQuerySourceFn).toHaveBeenCalledTimes(1);
  });

  it('invalidates old success and enable choice after editing connection settings', async () => {
    mount();
    await createAndReachScope();
    fireEvent.click(screen.getByRole('checkbox'));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_back' }));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_back' }));
    fireEvent.click(screen.getByRole('button', { name: 'fill synthetic credentials' }));
    fireEvent.click(screen.getByRole('button', { name: 'com_data_query_rotate_and_test' }));
    await screen.findByText('connection_ok');
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_next' }));
    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('resumes only the source summary, never credentials, and permits step 3 to step 2', () => {
    mount({ ...source, password: 'must-not-render', credential: { password: 'must-not-render' } } as t.DataQuerySource);
    expect(screen.getByText('network_unreachable')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_back' }));
    expect(screen.getByLabelText('synthetic password')).toHaveValue('');
    expect(screen.getByRole('button', { name: 'com_data_query_rotate_and_test' })).toBeDisabled();
    expect(createDataQuerySourceFn).not.toHaveBeenCalled();
    expect(updateDataQuerySourceCredentialFn).not.toHaveBeenCalled();
    expect(testDataQuerySourceFn).not.toHaveBeenCalled();
  });

  it('preserves the actual MySQL source type when resuming an existing source', () => {
    mount({ ...source, source_type: 'mysql' });
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_back' }));
    fireEvent.click(screen.getByRole('button', { name: 'com_ui_back' }));
    expect(screen.getByLabelText('com_data_query_type')).toHaveValue('mysql');
    expect(screen.getByLabelText('com_data_query_type')).toBeDisabled();
  });
});
