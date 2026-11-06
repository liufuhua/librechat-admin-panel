import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type * as t from '@/types';
import { SchemaDiscoveryPanel } from './SchemaDiscoveryPanel';
import {
  normalizeSnapshotSelection,
  selectSnapshotColumn,
  selectSnapshotTable,
} from './snapshotSelection';
import {
  buildDomainDraft,
  initialTableMetadata,
  validateDomainSelection,
} from '../domains/domainDraft';

vi.mock('@clickhouse/click-ui', () => ({
  Button: ({
    label,
    disabled,
    onClick,
  }: {
    label: string;
    disabled?: boolean;
    onClick: () => void;
  }) => (
    <button disabled={disabled} onClick={onClick}>
      {label}
    </button>
  ),
}));
vi.mock('@/hooks', () => ({ useLocalize: () => (key: string) => key }));
vi.mock('@/utils', () => ({ notifyError: vi.fn(), notifySuccess: vi.fn() }));
vi.mock('@/server', () => ({
  dataQueryCatalogsOptions: () => ({ queryKey: ['catalogs'], queryFn: async () => [] }),
  dataQuerySchemasOptions: () => ({ queryKey: ['schemas'], queryFn: async () => [] }),
  dataQueryTablesOptions: () => ({ queryKey: ['tables'], queryFn: async () => [] }),
  dataQueryColumnsOptions: () => ({ queryKey: ['columns'], queryFn: async () => [] }),
  getDataQuerySnapshotJobFn: async () => ({ status: 'passed', snapshot_id: 'fixture-snapshot' }),
  getDataQuerySnapshotFn: async () => snapshot,
  createDataQuerySnapshotJobFn: vi.fn(),
  diffDataQueryDomainSchemaFn: vi.fn(),
  importDataQueryDomainSchemaFn: vi.fn(),
}));

const source = {
  source_key: 'selection_fixture',
  name: 'Synthetic shop',
  source_type: 'mysql',
  environment: 'test',
  enabled: true,
} as t.DataQuerySource;
let nextId = 0;
function table(name: string, fields: string[]): t.DataQuerySnapshotTable {
  const ref = (column: string | null): t.DataQueryObjectRef => ({
    object_id: `dbo_${(++nextId).toString(16).padStart(40, '0')}`,
    kind: column === null ? 'table' : 'column',
    catalog_name: 'fixture',
    schema_name: null,
    table_name: name,
    column_name: column,
  });
  const columns = fields.map((field) => ({
    object_ref: ref(field),
    data_type: 'INTEGER',
    nullable: false,
    primary_key: field === 'id',
  }));
  return {
    table: ref(null),
    table_type: 'table',
    columns,
    primary_key: columns.filter((column) => column.primary_key).map((column) => column.object_ref),
    foreign_keys: [],
  };
}
const company = table('company', ['id', 'name', 'private_config']);
const dealers = table('dealers', ['id', 'name', 'company_id', 'private_config']);
const members = table('members', [
  'id',
  'name',
  'mobile',
  'dealer_id',
  'company_id',
  'password',
  'id_card',
]);
const area = table('area', ['id', 'name']);
const tables = [area, company, dealers, members];
const columnId = (item: t.DataQuerySnapshotTable, name: string) =>
  item.columns.find((column) => column.object_ref.column_name === name)!.object_ref.object_id;
const tenFields = new Set([
  ...['id', 'name'].map((field) => columnId(company, field)),
  ...['id', 'name', 'company_id'].map((field) => columnId(dealers, field)),
  ...['id', 'name', 'mobile', 'dealer_id', 'company_id'].map((field) => columnId(members, field)),
]);
const snapshot = {
  snapshot_id: 'fixture-snapshot',
  source_key: source.source_key,
  source_type: 'mysql',
  structure: { format_version: 1, tables, catalogs: [], namespaces: [], sample_rows_read: 0 },
  table_count: 4,
  column_count: 16,
  foreign_key_count: 0,
} as t.DataQuerySchemaSnapshot;

describe('snapshot selection linkage', () => {
  it('repairs ten column-only selections with exactly three parent tables', () => {
    const selected = normalizeSnapshotSelection(tables, tenFields);
    expect(selected.size).toBe(13);
    expect([...selected].filter((id) => !tenFields.has(id))).toEqual([
      company.table.object_id,
      dealers.table.object_id,
      members.table.object_id,
    ]);
    expect(selected.has(columnId(members, 'password'))).toBe(false);
    expect(selected.has(columnId(members, 'id_card'))).toBe(false);
    expect(selected.has(area.table.object_id)).toBe(false);
    expect(tenFields.size).toBe(10);
    expect(normalizeSnapshotSelection(tables, selected)).toEqual(selected);
  });

  it('selects a parent when selecting a single field, without selecting siblings', () => {
    expect(selectSnapshotColumn(tables, new Set(), columnId(members, 'name'), true)).toEqual(
      new Set([members.table.object_id, columnId(members, 'name')]),
    );
  });

  it('keeps the parent until its last field is deselected', () => {
    let selected = normalizeSnapshotSelection(
      tables,
      new Set([columnId(company, 'id'), columnId(company, 'name')]),
    );
    selected = selectSnapshotColumn(tables, selected, columnId(company, 'name'), false);
    expect(selected.has(company.table.object_id)).toBe(true);
    selected = selectSnapshotColumn(tables, selected, columnId(company, 'id'), false);
    expect(selected.size).toBe(0);
  });

  it('whole-table selection and deselection affect only that table', () => {
    const selected = selectSnapshotTable(tables, tenFields, company, true);
    expect(selected.has(columnId(company, 'private_config'))).toBe(true);
    expect(selected.has(columnId(members, 'password'))).toBe(false);
    const cleared = selectSnapshotTable(tables, selected, company, false);
    expect(cleared.has(company.table.object_id)).toBe(false);
    expect(company.columns.every((column) => !cleared.has(column.object_ref.object_id))).toBe(true);
    expect(cleared.has(columnId(members, 'mobile'))).toBe(true);
  });

  it('drops stale and unknown references without expanding a table-only selection', () => {
    expect(
      normalizeSnapshotSelection(tables, new Set(['old-snapshot-id', company.table.object_id])),
    ).toEqual(new Set());
    expect(normalizeSnapshotSelection([], tenFields)).toEqual(new Set());
  });

  it('keeps missing primary keys as an error, never selects them automatically', () => {
    const selection = {
      snapshot,
      selectedObjectIds: [
        ...selectSnapshotColumn(tables, new Set(), columnId(members, 'name'), true),
      ],
    };
    expect(validateDomainSelection(selection)).toContain('members:primary_key_incomplete');
    expect(selection.selectedObjectIds).not.toContain(columnId(members, 'id'));
  });

  it('passes exactly the selected columns to the domain draft builder', () => {
    const selection = {
      snapshot,
      selectedObjectIds: [...normalizeSnapshotSelection(tables, tenFields)],
    };
    const draft = buildDomainDraft(
      source,
      selection,
      {
        domainKey: 'fixture',
        displayName: 'Fixture',
        description: '',
        versionKey: 'v1',
        defaultLimit: 50,
        maxLimit: 200,
        routingKeywords: ['fixture'],
      },
      initialTableMetadata(selection),
    );
    expect(validateDomainSelection(selection)).toEqual([]);
    expect(draft.tables).toHaveLength(3);
    expect(
      draft.tables
        .flatMap((item) => item.columns.map((column) => column.object_ref.object_id))
        .sort(),
    ).toEqual([...tenFields].sort());
  });
});

describe('SchemaDiscoveryPanel selection', () => {
  beforeEach(() => {
    sessionStorage.clear();
    sessionStorage.setItem(`data-query-v2:snapshot-job:${source.source_key}`, 'fixture-job');
  });

  async function mount() {
    const onCreateDomain = vi.fn();
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const view = render(
      <QueryClientProvider client={client}>
        <SchemaDiscoveryPanel source={source} domains={[]} onCreateDomain={onCreateDomain} />
      </QueryClientProvider>,
    );
    await screen.findByRole('button', { name: 'com_data_query_create_domain_from_selection' });
    const details = (name: string) =>
      [...view.container.querySelectorAll('details')].find((item) =>
        item.querySelector('summary')?.textContent?.includes(name),
      )!;
    const header = (name: string) =>
      details(name).querySelector('summary input') as HTMLInputElement;
    const choose = (name: string, field: string) =>
      fireEvent.click(within(details(name)).getByLabelText(`${field} · INTEGER`));
    return { onCreateDomain, details, header, choose };
  }

  it('enables creation from individual fields and sends only those fields plus parent references', async () => {
    const { onCreateDomain, header, choose } = await mount();
    const create = screen.getByRole('button', {
      name: 'com_data_query_create_domain_from_selection',
    });
    expect(create).toBeDisabled();
    for (const [name, fields] of Object.entries({
      company: ['id', 'name'],
      dealers: ['id', 'name', 'company_id'],
      members: ['id', 'name', 'mobile', 'dealer_id', 'company_id'],
    })) {
      for (const field of fields) choose(name, field);
      expect(header(name)).toHaveAttribute('aria-checked', 'mixed');
      expect(header(name).indeterminate).toBe(true);
    }
    expect(create).toBeEnabled();
    fireEvent.click(create);
    expect(onCreateDomain).toHaveBeenCalledOnce();
    expect(new Set(onCreateDomain.mock.calls[0][0].selectedObjectIds)).toEqual(
      normalizeSnapshotSelection(tables, tenFields),
    );
    expect(
      within(screen.getByText('members').closest('details')!).getByLabelText('password · INTEGER'),
    ).not.toBeChecked();
  });

  it('last-column deselection disables creation and clears the parent state', async () => {
    const { choose, header } = await mount();
    choose('company', 'name');
    expect(
      screen.getByRole('button', { name: 'com_data_query_create_domain_from_selection' }),
    ).toBeEnabled();
    choose('company', 'name');
    expect(header('company').indeterminate).toBe(false);
    expect(header('company')).not.toBeChecked();
    expect(
      screen.getByRole('button', { name: 'com_data_query_create_domain_from_selection' }),
    ).toBeDisabled();
  });

  it('whole-table toggle retains other tables and supports clearing a partial selection', async () => {
    const { choose, header, details } = await mount();
    choose('members', 'mobile');
    fireEvent.click(header('company'));
    expect(header('company')).toBeChecked();
    expect(header('company').indeterminate).toBe(false);
    fireEvent.click(header('company'));
    expect(within(details('members')).getByLabelText('mobile · INTEGER')).toBeChecked();
    expect(header('company')).not.toBeChecked();
  });
});
