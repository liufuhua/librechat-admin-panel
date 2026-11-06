import { Button } from '@clickhouse/click-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type * as t from '@/types';
import { EmptyState, LoadingState } from '@/components/shared';
import {
  dataQueryDomainsOptions,
  dataQuerySourcesOptions,
  setDataQuerySourceEnabledFn,
  testDataQuerySourceFn,
} from '@/server';
import { notifyError, notifySuccess } from '@/utils';
import { useLocalize } from '@/hooks';
import { ReasonDialog } from './ReasonDialog';

type SourceAction = 'test' | 'toggle';

export function DataSourceListPage() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const sources = useQuery(dataQuerySourcesOptions);
  const domains = useQuery(dataQueryDomainsOptions);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | t.DataQuerySourceType>('all');
  const [environmentFilter, setEnvironmentFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'enabled' | 'disabled'>('all');
  const [connectionFilter, setConnectionFilter] = useState<'all' | t.DataQueryConnectionStatus>(
    'all',
  );
  const [target, setTarget] = useState<{ source: t.DataQuerySource; action: SourceAction } | null>(
    null,
  );
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (sources.data ?? []).filter((source) => {
      if (
        term &&
        !source.name.toLowerCase().includes(term) &&
        !source.source_key.toLowerCase().includes(term)
      ) {
        return false;
      }
      if (typeFilter !== 'all' && source.source_type !== typeFilter) return false;
      if (environmentFilter !== 'all' && source.environment !== environmentFilter) {
        return false;
      }
      if (statusFilter === 'enabled' && !source.enabled) return false;
      if (statusFilter === 'disabled' && source.enabled) return false;
      if (connectionFilter !== 'all' && source.last_connection_status !== connectionFilter) {
        return false;
      }
      return true;
    });
  }, [connectionFilter, environmentFilter, search, sources.data, statusFilter, typeFilter]);

  const closeAction = () => {
    setTarget(null);
    setReason('');
    setActionError(null);
  };
  const refresh = () => queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'sources'] });

  const testMutation = useMutation({
    mutationFn: ({ sourceKey, actionReason }: { sourceKey: string; actionReason: string }) =>
      testDataQuerySourceFn({ data: { sourceKey, reason: actionReason } }),
    onSuccess: (result) => {
      refresh();
      const message = localize('com_data_query_connection_result', {
        status: result.status,
        code: result.code,
      });
      result.status === 'passed' ? notifySuccess(message) : notifyError(message);
      closeAction();
    },
    onError: (error: Error) => setActionError(error.message),
  });
  const toggleMutation = useMutation({
    mutationFn: ({
      sourceKey,
      enabled,
      actionReason,
    }: {
      sourceKey: string;
      enabled: boolean;
      actionReason: string;
    }) => setDataQuerySourceEnabledFn({ data: { sourceKey, enabled, reason: actionReason } }),
    onSuccess: () => {
      refresh();
      notifySuccess(localize('com_data_query_source_updated'));
      closeAction();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  const submitAction = () => {
    if (!target || !reason.trim()) return;
    if (target.action === 'test') {
      testMutation.mutate({ sourceKey: target.source.source_key, actionReason: reason });
      return;
    }
    toggleMutation.mutate({
      sourceKey: target.source.source_key,
      enabled: !target.source.enabled,
      actionReason: reason,
    });
  };

  if (sources.isLoading) return <LoadingState />;
  if (sources.isError) {
    return (
      <div className="p-6">
        <div
          role="alert"
          className="rounded-lg border border-(--cui-color-stroke-danger) p-4 text-sm text-(--cui-color-text-danger)"
        >
          <p>{localize('com_data_query_sources_load_failed')}</p>
          <Button
            type="secondary"
            label={localize('com_ui_retry')}
            onClick={() => sources.refetch()}
          />
        </div>
      </div>
    );
  }

  const affectedDomains = target
    ? (domains.data ?? []).filter(
        (domain) =>
          domain.source_key === target.source.source_key && domain.published_version !== null,
      )
    : [];
  const environments = Array.from(
    new Set((sources.data ?? []).map((source) => source.environment)),
  ).sort();
  const enablingBlocked =
    target?.action === 'toggle' &&
    !target.source.enabled &&
    target.source.last_connection_status !== 'passed';
  let actionDescription: string | undefined;
  if (enablingBlocked) {
    actionDescription = localize('com_data_query_enable_requires_test');
  } else if (target?.action === 'toggle' && target.source.enabled && affectedDomains.length > 0) {
    actionDescription = localize('com_data_query_disable_impact', {
      count: String(affectedDomains.length),
    });
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-(--cui-color-title-default)">
            {localize('com_data_query_tab_sources')}
          </h2>
          <p className="mt-1 text-sm text-(--cui-color-text-muted)">
            {localize('com_data_query_sources_hint')}
          </p>
        </div>
        <Link
          to="/data-query/sources/new"
          className="rounded-md bg-(--cui-color-accent) px-4 py-2 text-sm font-medium text-white no-underline"
        >
          {localize('com_data_query_create_source')}
        </Link>
      </div>

      <div className="grid gap-3 rounded-lg border border-(--cui-color-stroke-default) p-4 md:grid-cols-2 xl:grid-cols-5">
        <input
          aria-label={localize('com_data_query_search_sources')}
          placeholder={localize('com_data_query_search_sources')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm"
        />
        <select
          aria-label={localize('com_data_query_filter_type')}
          value={typeFilter}
          onChange={(event) => setTypeFilter(event.target.value as 'all' | t.DataQuerySourceType)}
          className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm"
        >
          <option value="all">{localize('com_ui_all')}</option>
          <option value="postgresql">PostgreSQL</option>
          <option value="mysql">MySQL</option>
        </select>
        <select
          aria-label={localize('com_data_query_filter_environment')}
          value={environmentFilter}
          onChange={(event) => setEnvironmentFilter(event.target.value)}
          className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm"
        >
          <option value="all">{localize('com_ui_all')}</option>
          {environments.map((environment) => (
            <option key={environment} value={environment}>
              {environment}
            </option>
          ))}
        </select>
        <select
          aria-label={localize('com_data_query_filter_status')}
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(event.target.value as 'all' | 'enabled' | 'disabled')
          }
          className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm"
        >
          <option value="all">{localize('com_ui_all')}</option>
          <option value="enabled">{localize('com_ui_enabled')}</option>
          <option value="disabled">{localize('com_ui_disabled')}</option>
        </select>
        <select
          aria-label={localize('com_data_query_filter_connection')}
          value={connectionFilter}
          onChange={(event) =>
            setConnectionFilter(event.target.value as 'all' | t.DataQueryConnectionStatus)
          }
          className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm"
        >
          <option value="all">{localize('com_ui_all')}</option>
          <option value="passed">passed</option>
          <option value="failed">failed</option>
          <option value="not_tested">not tested</option>
          <option value="stale">stale</option>
        </select>
      </div>

      {domains.isError && (
        <div
          role="alert"
          className="rounded-lg border border-(--cui-color-stroke-danger) p-3 text-sm text-(--cui-color-text-danger)"
        >
          {localize('com_data_query_domain_references_load_failed')}
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border border-(--cui-color-stroke-default)">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-(--cui-color-stroke-default) bg-(--cui-color-background-muted)">
              {[
                'com_data_query_source',
                'com_data_query_type',
                'com_data_query_environment',
                'com_data_query_credential',
                'com_data_query_connection',
                'com_data_query_domains',
                'com_data_query_status',
                'com_data_query_actions',
              ].map((key) => (
                <th key={key} className="px-4 py-2.5 font-medium whitespace-nowrap">
                  {localize(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((source) => {
              const domainCount = (domains.data ?? []).filter(
                (domain) => domain.source_key === source.source_key,
              ).length;
              const canTest = source.secret_configured;
              const canEnable = source.enabled || source.last_connection_status === 'passed';
              const canChangeStatus =
                canEnable && (!source.enabled || (!domains.isLoading && !domains.isError));
              return (
                <tr
                  key={source.source_key}
                  className="border-b border-(--cui-color-stroke-default) last:border-0"
                >
                  <td className="px-4 py-3">
                    <Link
                      to="/data-query/sources/$sourceKey"
                      params={{ sourceKey: source.source_key }}
                      className="font-medium text-(--cui-color-text-default) underline"
                    >
                      {source.name}
                    </Link>
                    <p className="text-xs text-(--cui-color-text-muted)">{source.source_key}</p>
                  </td>
                  <td className="px-4 py-3">{source.source_type}</td>
                  <td className="px-4 py-3">{source.environment}</td>
                  <td className="px-4 py-3">{source.credential_state}</td>
                  <td className="px-4 py-3">
                    <p>{source.last_connection_status}</p>
                    {source.last_connection_code && (
                      <p className="text-xs text-(--cui-color-text-muted)">
                        {source.last_connection_code}
                      </p>
                    )}
                  </td>
                  <td className="px-4 py-3">{domains.isError ? '-' : domainCount}</td>
                  <td className="px-4 py-3">
                    {source.enabled ? localize('com_ui_enabled') : localize('com_ui_disabled')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <Button
                        type="secondary"
                        label={
                          testMutation.isPending && target?.source.source_key === source.source_key
                            ? localize('com_data_query_connection_testing')
                            : localize('com_data_query_connection_test')
                        }
                        disabled={!canTest}
                        onClick={() => {
                          setActionError(null);
                          setTarget({ source, action: 'test' });
                        }}
                      />
                      <Button
                        type="secondary"
                        label={
                          source.enabled
                            ? localize('com_data_query_disable')
                            : localize('com_data_query_enable')
                        }
                        disabled={!canChangeStatus}
                        onClick={() => {
                          setActionError(null);
                          setTarget({ source, action: 'toggle' });
                        }}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState
                    message={
                      (sources.data ?? []).length === 0
                        ? localize('com_data_query_no_sources')
                        : localize('com_data_query_no_filtered_sources')
                    }
                  />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ReasonDialog
        open={target !== null}
        title={
          target?.action === 'test'
            ? localize('com_data_query_connection_test')
            : localize('com_data_query_change_source_status')
        }
        description={actionDescription}
        reason={reason}
        saving={testMutation.isPending || toggleMutation.isPending}
        error={actionError}
        onReasonChange={setReason}
        onSubmit={submitAction}
        onClose={closeAction}
      />
    </div>
  );
}
