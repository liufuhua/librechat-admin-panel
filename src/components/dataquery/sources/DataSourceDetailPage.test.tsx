import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataSourceDetailPage } from './DataSourceDetailPage';

const useQueryMock = vi.fn();
const useMutationMock = vi.fn();

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: object) => useQueryMock(options),
  useMutation: (options: object) => useMutationMock(options),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
  useNavigate: () => vi.fn(),
}));

vi.mock('@clickhouse/click-ui', () => ({
  Button: ({ label, disabled }: { label: string; disabled?: boolean }) => (
    <button disabled={disabled}>{label}</button>
  ),
  Tabs: Object.assign(({ children }: { children: React.ReactNode }) => <div>{children}</div>, {
    TriggersList: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    Trigger: ({ children }: { children: React.ReactNode }) => <button>{children}</button>,
  }),
}));

vi.mock('@/components/shared', () => ({
  EmptyState: ({ message }: { message: string }) => <div>{message}</div>,
  FormDialog: () => null,
  LoadingState: () => <div>loading</div>,
}));

vi.mock('@/hooks', () => ({
  useLocalize: () => (key: string) => key,
}));

vi.mock('@/utils', () => ({
  notifyError: vi.fn(),
  notifySuccess: vi.fn(),
}));

vi.mock('@/server', () => ({
  dataQuerySourceOptions: (sourceKey: string) => ({
    queryKey: ['data-query-v2', 'sources', sourceKey],
  }),
  dataQueryDomainsOptions: { queryKey: ['data-query-v2', 'domains'] },
  dataQueryAuditsOptions: { queryKey: ['data-query-v2', 'audits'] },
  deleteDataQuerySourceFn: vi.fn(),
  setDataQuerySourceEnabledFn: vi.fn(),
  testDataQuerySourceFn: vi.fn(),
  updateDataQuerySourceCredentialFn: vi.fn(),
  updateDataQuerySourceFn: vi.fn(),
}));

const source = {
  source_key: 'orders_readonly',
  name: 'Orders reporting',
  source_type: 'postgresql',
  environment: 'production',
  enabled: false,
  owner_team: 'analytics',
  risk_level: 'medium',
  secret_configured: true,
  credential_state: 'configured',
  last_connection_status: 'passed',
  last_connection_code: 'connection_passed',
  last_tested_at: '2026-07-31T01:02:03Z',
  password: 'must-not-render',
  dsn: 'postgresql://must-not-render',
};

describe('DataSourceDetailPage', () => {
  beforeEach(() => {
    useMutationMock.mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      error: null,
    });
    useQueryMock.mockImplementation((options: { queryKey: string[] }) => {
      if (options.queryKey.length === 4 || options.queryKey[2] === 'orders_readonly') {
        return {
          data: source,
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        };
      }
      return {
        data: [],
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    });
  });

  it('renders a server-restored data source summary', () => {
    render(<DataSourceDetailPage sourceKey="orders_readonly" />);

    expect(screen.getByText('Orders reporting')).toBeInTheDocument();
    expect(screen.getByText(/orders_readonly/)).toBeInTheDocument();
    expect(screen.getByText('connection_passed')).toBeInTheDocument();
  });

  it('renders a visible error state instead of treating failure as empty data', () => {
    useQueryMock.mockImplementation((options: { queryKey: string[] }) => {
      if (options.queryKey[2] === 'orders_readonly') {
        return {
          data: undefined,
          isLoading: false,
          isError: true,
          refetch: vi.fn(),
        };
      }
      return { data: [], isLoading: false, isError: false, refetch: vi.fn() };
    });

    render(<DataSourceDetailPage sourceKey="orders_readonly" />);

    expect(screen.getByRole('alert')).toHaveTextContent('com_data_query_source_load_failed');
  });

  it('never renders extra password or DSN fields returned by an unsafe fixture', () => {
    render(<DataSourceDetailPage sourceKey="orders_readonly" />);

    expect(screen.queryByText('must-not-render')).not.toBeInTheDocument();
    expect(screen.queryByText('postgresql://must-not-render')).not.toBeInTheDocument();
    expect(screen.getByText('com_data_query_connection_details_protected')).toBeInTheDocument();
  });
});
