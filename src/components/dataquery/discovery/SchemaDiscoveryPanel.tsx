import { Button } from '@clickhouse/click-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import type * as t from '@/types';
import {
  createDataQuerySnapshotJobFn,
  dataQueryCatalogsOptions,
  dataQueryColumnsOptions,
  dataQuerySchemasOptions,
  dataQueryTablesOptions,
  diffDataQueryDomainSchemaFn,
  getDataQuerySnapshotFn,
  getDataQuerySnapshotJobFn,
  importDataQueryDomainSchemaFn,
} from '@/server';
import { notifyError, notifySuccess } from '@/utils';
import { useLocalize } from '@/hooks';
import {
  normalizeSnapshotSelection,
  selectSnapshotColumn,
  selectSnapshotTable,
} from './snapshotSelection';

const PAGE_SIZE = 50;
const terminalStatuses = new Set<t.DataQuerySnapshotJobStatus>([
  'passed',
  'failed',
  'cancelled',
  'stale',
]);

interface SchemaDiscoveryPanelProps {
  source: t.DataQuerySource;
  domains: t.DataQueryDomain[];
  onCreateDomain: (selection: SnapshotSelection) => void;
}

export interface SnapshotSelection {
  snapshot: t.DataQuerySchemaSnapshot;
  selectedObjectIds: string[];
}

export function SchemaDiscoveryPanel({
  source,
  domains,
  onCreateDomain,
}: SchemaDiscoveryPanelProps) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const storageKey = `data-query-v2:snapshot-job:${source.source_key}`;
  const catalogs = useQuery(dataQueryCatalogsOptions(source.source_key));
  const [catalog, setCatalog] = useState<string | null>(null);
  const schemas = useQuery({
    ...dataQuerySchemasOptions(source.source_key, catalog),
    enabled: catalogs.isSuccess,
  });
  const [schema, setSchema] = useState<string | null>(null);
  const tables = useQuery({
    ...dataQueryTablesOptions(source.source_key, catalog, schema),
    enabled: schemas.isSuccess && schema !== null,
  });
  const [tableName, setTableName] = useState('');
  const columns = useQuery({
    ...dataQueryColumnsOptions(source.source_key, catalog, schema, tableName),
    enabled: tableName.length > 0,
  });
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [snapshotReason, setSnapshotReason] = useState('');
  const [jobId, setJobId] = useState<string | null>(() =>
    typeof window === 'undefined' ? null : window.sessionStorage.getItem(storageKey),
  );
  const [rawSelectedObjectIds, setSelectedObjectIds] = useState<Set<string>>(new Set());
  const [target, setTarget] = useState('');
  const [changeReason, setChangeReason] = useState('');
  const [diff, setDiff] = useState<t.DataQuerySchemaDiff | null>(null);

  useEffect(() => {
    if (catalogs.data?.length && catalog === null) {
      setCatalog(catalogs.data[0].catalog_name);
    }
  }, [catalog, catalogs.data]);
  useEffect(() => {
    if (schemas.data?.length && schema === null) {
      setSchema(schemas.data[0].schema_name ?? schemas.data[0].namespace_name);
    }
  }, [schema, schemas.data]);
  useEffect(() => {
    setTableName('');
    setPage(0);
  }, [catalog, schema]);

  const job = useQuery({
    queryKey: ['data-query-v2', 'snapshot-job', source.source_key, jobId],
    queryFn: () =>
      getDataQuerySnapshotJobFn({ data: { sourceKey: source.source_key, id: jobId! } }),
    enabled: jobId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status && terminalStatuses.has(status) ? false : 2_000;
    },
  });
  const snapshotId = job.data?.status === 'passed' ? job.data.snapshot_id : null;
  const snapshot = useQuery({
    queryKey: ['data-query-v2', 'snapshot', source.source_key, snapshotId],
    queryFn: () =>
      getDataQuerySnapshotFn({ data: { sourceKey: source.source_key, id: snapshotId! } }),
    enabled: snapshotId !== null,
  });
  // Also repair existing column-only selections without selecting any extra fields.
  const selectedObjectIds = useMemo(
    () => normalizeSnapshotSelection(snapshot.data?.structure.tables ?? [], rawSelectedObjectIds),
    [snapshot.data, rawSelectedObjectIds],
  );

  useEffect(() => {
    if (!job.data || job.data.status === 'passed') return;
    if (terminalStatuses.has(job.data.status) && typeof window !== 'undefined') {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [job.data, storageKey]);

  const snapshotMutation = useMutation({
    mutationFn: () =>
      createDataQuerySnapshotJobFn({
        data: {
          sourceKey: source.source_key,
          catalog,
          schemas: schema ? [schema] : [],
          reason: snapshotReason,
        },
      }),
    onSuccess: (created) => {
      setJobId(created.job_id);
      setSelectedObjectIds(new Set());
      setDiff(null);
      if (typeof window !== 'undefined') window.sessionStorage.setItem(storageKey, created.job_id);
      notifySuccess(localize('com_data_query_snapshot_queued'));
    },
    onError: (error: Error) => notifyError(error.message),
  });

  const targetVersions = useMemo(
    () =>
      domains.flatMap((domain) =>
        domain.versions.map((version) => ({
          key: `${domain.domain_key}:${version.version_key}`,
          domain,
          version,
        })),
      ),
    [domains],
  );
  const selectedTarget = targetVersions.find((item) => item.key === target);
  const diffMutation = useMutation({
    mutationFn: () => {
      if (!selectedTarget || !snapshot.data) throw new Error('schema_target_required');
      return diffDataQueryDomainSchemaFn({
        data: {
          domainKey: selectedTarget.domain.domain_key,
          versionKey: selectedTarget.version.version_key,
          snapshotId: snapshot.data.snapshot_id,
          reason: changeReason,
        },
      });
    },
    onSuccess: (result) => setDiff(result),
    onError: (error: Error) => notifyError(error.message),
  });
  const importMutation = useMutation({
    mutationFn: () => {
      if (!selectedTarget || !snapshot.data) throw new Error('schema_target_required');
      return importDataQueryDomainSchemaFn({
        data: {
          domainKey: selectedTarget.domain.domain_key,
          versionKey: selectedTarget.version.version_key,
          snapshotId: snapshot.data.snapshot_id,
          selectedObjectIds: [...selectedObjectIds],
          expectedRevision: selectedTarget.version.revision,
          reason: changeReason,
        },
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'domains'] });
      notifySuccess(localize('com_data_query_schema_imported'));
    },
    onError: (error: Error) => notifyError(error.message),
  });

  const filteredTables = (tables.data ?? []).filter((item) =>
    item.object_ref.table_name.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const pagedTables = filteredTables.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const selectedSnapshotTables =
    snapshot.data?.structure.tables.filter((item) => selectedObjectIds.has(item.table.object_id)) ??
    [];
  const toggleSnapshotTable = (item: t.DataQuerySnapshotTable, checked: boolean) => {
    setSelectedObjectIds((current) =>
      selectSnapshotTable(snapshot.data?.structure.tables ?? [], current, item, checked),
    );
  };
  const toggleSnapshotColumn = (objectId: string, checked: boolean) => {
    setSelectedObjectIds((current) =>
      selectSnapshotColumn(snapshot.data?.structure.tables ?? [], current, objectId, checked),
    );
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid min-h-96 gap-4 lg:grid-cols-[15rem_minmax(20rem,1fr)_minmax(22rem,1.2fr)]">
        <section className="rounded-lg border border-(--cui-color-stroke-default) p-4">
          <h3 className="font-medium">{localize('com_data_query_database_scope')}</h3>
          <DiscoveryError query={catalogs} />
          <label className="mt-4 flex flex-col gap-1.5 text-sm">
            {localize('com_data_query_catalog')}
            <select
              value={catalog ?? ''}
              onChange={(event) => {
                setCatalog(event.target.value || null);
                setSchema(null);
              }}
              className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2"
            >
              {(catalogs.data ?? []).map((item) => (
                <option key={item.catalog_name} value={item.catalog_name}>
                  {item.catalog_name}
                </option>
              ))}
            </select>
          </label>
          <DiscoveryError query={schemas} />
          <div className="mt-4 flex flex-col gap-1">
            <span className="text-sm font-medium">{localize('com_data_query_namespaces')}</span>
            {(schemas.data ?? []).map((item) => {
              const value = item.schema_name ?? item.namespace_name;
              return (
                <button
                  key={`${item.catalog_name}:${value}`}
                  type="button"
                  onClick={() => setSchema(value)}
                  className={`rounded px-3 py-2 text-left text-sm ${
                    schema === value
                      ? 'bg-(--cui-color-background-secondary) font-medium'
                      : 'hover:bg-(--cui-color-background-muted)'
                  }`}
                >
                  {item.namespace_name}
                </button>
              );
            })}
          </div>
        </section>

        <section className="rounded-lg border border-(--cui-color-stroke-default) p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="font-medium">{localize('com_data_query_tables')}</h3>
            <span className="text-xs text-(--cui-color-text-muted)">{filteredTables.length}</span>
          </div>
          <input
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(0);
            }}
            placeholder={localize('com_data_query_search_tables')}
            className="mt-3 w-full rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm"
          />
          <DiscoveryError query={tables} />
          <div className="mt-3 flex max-h-80 flex-col overflow-y-auto">
            {pagedTables.map((item) => (
              <button
                key={item.object_ref.object_id}
                type="button"
                onClick={() => setTableName(item.object_ref.table_name)}
                className={`border-b border-(--cui-color-stroke-default) px-2 py-2 text-left text-sm last:border-0 ${
                  tableName === item.object_ref.table_name
                    ? 'bg-(--cui-color-background-secondary) font-medium'
                    : ''
                }`}
              >
                {item.object_ref.table_name}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center justify-between text-xs">
            <Button
              type="secondary"
              label={localize('com_ui_previous')}
              disabled={page === 0}
              onClick={() => setPage((value) => Math.max(0, value - 1))}
            />
            <span>
              {page + 1} / {Math.max(1, Math.ceil(filteredTables.length / PAGE_SIZE))}
            </span>
            <Button
              type="secondary"
              label={localize('com_ui_next')}
              disabled={(page + 1) * PAGE_SIZE >= filteredTables.length}
              onClick={() => setPage((value) => value + 1)}
            />
          </div>
        </section>

        <section className="rounded-lg border border-(--cui-color-stroke-default) p-4">
          <h3 className="font-medium">{tableName || localize('com_data_query_select_table')}</h3>
          <DiscoveryError query={columns} />
          {!tableName && (
            <p className="mt-3 text-sm text-(--cui-color-text-muted)">
              {localize('com_data_query_select_table_hint')}
            </p>
          )}
          {columns.data && (
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-(--cui-color-stroke-default)">
                    <th className="py-2">{localize('com_data_query_column')}</th>
                    <th className="py-2">{localize('com_data_query_data_type')}</th>
                    <th className="py-2">PK</th>
                    <th className="py-2">{localize('com_data_query_nullable')}</th>
                  </tr>
                </thead>
                <tbody>
                  {columns.data.items.map((column) => (
                    <tr
                      key={column.object_ref.object_id}
                      className="border-b border-(--cui-color-stroke-default) last:border-0"
                    >
                      <td className="py-2">{column.object_ref.column_name}</td>
                      <td className="py-2">{column.data_type}</td>
                      <td className="py-2">{column.primary_key ? '✓' : '-'}</td>
                      <td className="py-2">{column.nullable ? '✓' : '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-3 text-xs text-(--cui-color-text-muted)">
                {localize('com_data_query_foreign_key_count', {
                  count: String(columns.data.foreign_keys.length),
                })}
              </p>
            </div>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-(--cui-color-stroke-default) p-5">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="font-medium">{localize('com_data_query_schema_snapshot')}</h3>
            <p className="mt-1 text-sm text-(--cui-color-text-muted)">
              {localize('com_data_query_snapshot_scope_hint')}
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1 text-sm">
              {localize('com_data_query_reason')}
              <input
                value={snapshotReason}
                onChange={(event) => setSnapshotReason(event.target.value)}
                className="min-w-64 rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2"
              />
            </label>
            <Button
              type="primary"
              label={localize('com_data_query_create_snapshot')}
              disabled={!source.enabled || !snapshotReason.trim() || snapshotMutation.isPending}
              onClick={() => snapshotMutation.mutate()}
            />
          </div>
        </div>
        {jobId && (
          <div className="mt-4 rounded-md bg-(--cui-color-background-secondary) p-3 text-sm">
            {job.isError ? (
              <div role="alert" className="flex items-center justify-between gap-3">
                <span>{localize('com_data_query_snapshot_resume_failed')}</span>
                <Button
                  type="secondary"
                  label={localize('com_ui_retry')}
                  onClick={() => job.refetch()}
                />
              </div>
            ) : (
              <p>
                {localize('com_data_query_snapshot_progress', {
                  status: job.data?.status ?? 'loading',
                  current: String(job.data?.progress_current ?? 0),
                  total: String(job.data?.progress_total ?? 0),
                })}
                {job.data?.stable_code ? ` · ${job.data.stable_code}` : ''}
              </p>
            )}
          </div>
        )}
      </section>

      {snapshot.data && (
        <section className="rounded-lg border border-(--cui-color-stroke-default) p-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h3 className="font-medium">{localize('com_data_query_snapshot_selection')}</h3>
              <p className="mt-1 text-sm text-(--cui-color-text-muted)">
                {snapshot.data.table_count} {localize('com_data_query_tables')} ·{' '}
                {snapshot.data.column_count} {localize('com_data_query_columns')} ·{' '}
                {selectedObjectIds.size} {localize('com_data_query_objects_selected')}
              </p>
            </div>
            <Button
              type="primary"
              label={localize('com_data_query_create_domain_from_selection')}
              disabled={selectedSnapshotTables.length === 0}
              onClick={() =>
                onCreateDomain({
                  snapshot: snapshot.data,
                  selectedObjectIds: [...selectedObjectIds],
                })
              }
            />
          </div>
          <div className="mt-4 max-h-96 overflow-y-auto">
            {snapshot.data.structure.tables.map((item) => {
              const allColumnsSelected =
                item.columns.length > 0 &&
                item.columns.every((column) => selectedObjectIds.has(column.object_ref.object_id));
              const partiallySelected =
                selectedObjectIds.has(item.table.object_id) && !allColumnsSelected;
              return (
                <details
                  key={item.table.object_id}
                  className="border-b border-(--cui-color-stroke-default) py-2 last:border-0"
                >
                  <summary className="flex cursor-pointer items-center gap-3">
                    <input
                      type="checkbox"
                      checked={allColumnsSelected}
                      aria-checked={partiallySelected ? 'mixed' : allColumnsSelected}
                      ref={(element) => {
                        if (element) element.indeterminate = partiallySelected;
                      }}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => toggleSnapshotTable(item, event.target.checked)}
                    />
                    <span className="font-medium">{item.table.table_name}</span>
                    <span className="text-xs text-(--cui-color-text-muted)">
                      {item.columns.length} {localize('com_data_query_columns')}
                    </span>
                  </summary>
                  <div className="mt-2 ml-7 grid gap-2 md:grid-cols-2">
                    {item.columns.map((column) => (
                      <label
                        key={column.object_ref.object_id}
                        className="flex items-center gap-2 text-sm"
                      >
                        <input
                          type="checkbox"
                          checked={selectedObjectIds.has(column.object_ref.object_id)}
                          onChange={(event) =>
                            toggleSnapshotColumn(column.object_ref.object_id, event.target.checked)
                          }
                        />
                        {column.object_ref.column_name} · {column.data_type}
                      </label>
                    ))}
                  </div>
                </details>
              );
            })}
          </div>

          <div className="mt-5 grid gap-3 border-t border-(--cui-color-stroke-default) pt-5 lg:grid-cols-[1fr_1fr_auto_auto]">
            <label className="flex flex-col gap-1 text-sm">
              {localize('com_data_query_target_domain_version')}
              <select
                value={target}
                onChange={(event) => {
                  setTarget(event.target.value);
                  setDiff(null);
                }}
                className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2"
              >
                <option value="">{localize('com_data_query_select_target')}</option>
                {targetVersions.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.domain.name} · {item.version.version_key} · {item.version.status}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm">
              {localize('com_data_query_reason')}
              <input
                value={changeReason}
                onChange={(event) => setChangeReason(event.target.value)}
                className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2"
              />
            </label>
            <Button
              type="secondary"
              label={localize('com_data_query_compare_schema')}
              disabled={!selectedTarget || !changeReason.trim() || diffMutation.isPending}
              onClick={() => diffMutation.mutate()}
            />
            <Button
              type="primary"
              label={localize('com_data_query_import_selection')}
              disabled={
                selectedTarget?.version.status !== 'draft' ||
                selectedObjectIds.size === 0 ||
                !changeReason.trim() ||
                importMutation.isPending
              }
              onClick={() => importMutation.mutate()}
            />
          </div>
          {diff && (
            <div
              className={`mt-4 rounded-md border p-4 text-sm ${
                diff.blocking_count > 0
                  ? 'border-(--cui-color-stroke-danger)'
                  : 'border-(--cui-color-stroke-default)'
              }`}
            >
              <strong>{localize('com_data_query_schema_diff_result')}</strong>
              <p className="mt-1">
                +{diff.added_count} · −{diff.removed_count} · Δ{diff.changed_count} ·{' '}
                {localize('com_data_query_permission_lost')} {diff.permission_lost_count} ·{' '}
                {localize('com_data_query_blocking')} {diff.blocking_count}
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

function DiscoveryError({
  query,
}: {
  query: { isError: boolean; error: Error | null; refetch: () => Promise<unknown> };
}) {
  const localize = useLocalize();
  if (!query.isError) return null;
  return (
    <div
      role="alert"
      className="mt-3 rounded border border-(--cui-color-stroke-danger) p-2 text-sm text-(--cui-color-text-danger)"
    >
      <p>{query.error?.message ?? localize('com_data_query_discovery_partial_failure')}</p>
      <button type="button" className="mt-1 underline" onClick={() => query.refetch()}>
        {localize('com_ui_retry')}
      </button>
    </div>
  );
}
