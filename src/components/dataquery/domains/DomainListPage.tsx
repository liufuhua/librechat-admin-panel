import { Button } from '@clickhouse/click-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import type * as t from '@/types';
import { EmptyState, LoadingState } from '@/components/shared';
import {
  dataQueryDomainsOptions,
  dataQuerySourcesOptions,
  listDataQueryGrantsFn,
  setDataQueryDomainEnabledFn,
} from '@/server';
import { useLocalize } from '@/hooks';
import { notifyError, notifySuccess } from '@/utils';
import { ReasonDialog } from '../sources/ReasonDialog';
import { domainQuality, editableDomainVersion } from './domainDraft';

type StatusFilter = 'all' | 'enabled' | 'disabled';
type QualityFilter = 'all' | 'passed' | 'failed' | 'not_run' | 'running';

export function DomainListPage() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const domains = useQuery(dataQueryDomainsOptions);
  const sources = useQuery(dataQuerySourcesOptions);
  const [search, setSearch] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [qualityFilter, setQualityFilter] = useState<QualityFilter>('all');
  const [runtimeFilter, setRuntimeFilter] = useState<'all' | 'unavailable'>('all');
  const [target, setTarget] = useState<t.DataQueryDomain | null>(null);
  const [reason, setReason] = useState('');

  const sourceByKey = useMemo(
    () => new Map((sources.data ?? []).map((source) => [source.source_key, source])),
    [sources.data],
  );
  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (domains.data ?? []).filter((domain) => {
      if (
        term &&
        !domain.name.toLowerCase().includes(term) &&
        !domain.domain_key.toLowerCase().includes(term)
      ) {
        return false;
      }
      if (sourceFilter !== 'all' && domain.source_key !== sourceFilter) return false;
      if (statusFilter === 'enabled' && !domain.enabled) return false;
      if (statusFilter === 'disabled' && domain.enabled) return false;
      if (qualityFilter !== 'all' && domainQuality(domain) !== qualityFilter) return false;
      return runtimeFilter === 'all' || runtimeFilter === 'unavailable';
    });
  }, [domains.data, qualityFilter, runtimeFilter, search, sourceFilter, statusFilter]);

  const toggleMutation = useMutation({
    mutationFn: (domain: t.DataQueryDomain) =>
      setDataQueryDomainEnabledFn({
        data: { domainKey: domain.domain_key, enabled: !domain.enabled, reason },
      }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'domains'] });
      notifySuccess(localize('com_data_query_domain_status_updated'));
      setTarget(null);
      setReason('');
    },
    onError: (error: Error) => notifyError(error.message),
  });

  if (domains.isLoading || sources.isLoading) return <LoadingState />;
  if (domains.isError || sources.isError) {
    return (
      <div className="p-6">
        <div
          role="alert"
          className="rounded-lg border border-(--cui-color-stroke-danger) p-4 text-sm text-(--cui-color-text-danger)"
        >
          <p>{localize('com_data_query_domains_load_failed')}</p>
          <Button
            type="secondary"
            label={localize('com_ui_retry')}
            onClick={() => {
              domains.refetch();
              sources.refetch();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-(--cui-color-title-default)">
            {localize('com_data_query_tab_domains')}
          </h2>
          <p className="mt-1 text-sm text-(--cui-color-text-muted)">
            {localize('com_data_query_domains_page_hint')}
          </p>
        </div>
        <Link
          to="/data-query/domains/new"
          className="rounded-md bg-(--cui-color-accent) px-4 py-2 text-sm font-medium text-white no-underline"
        >
          {localize('com_data_query_create_domain')}
        </Link>
      </header>

      <section className="grid gap-3 rounded-lg border border-(--cui-color-stroke-default) p-4 md:grid-cols-2 xl:grid-cols-5">
        <input
          aria-label={localize('com_data_query_search_domains')}
          placeholder={localize('com_data_query_search_domains')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm"
        />
        <select
          aria-label={localize('com_data_query_filter_source')}
          value={sourceFilter}
          onChange={(event) => setSourceFilter(event.target.value)}
          className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm"
        >
          <option value="all">{localize('com_ui_all')}</option>
          {(sources.data ?? []).map((source) => (
            <option key={source.source_key} value={source.source_key}>
              {source.name}
            </option>
          ))}
        </select>
        <select
          aria-label={localize('com_data_query_filter_runtime')}
          value={runtimeFilter}
          onChange={(event) => setRuntimeFilter(event.target.value as 'all' | 'unavailable')}
          className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm"
        >
          <option value="all">{localize('com_ui_all')}</option>
          <option value="unavailable">{localize('com_data_query_runtime_unavailable')}</option>
        </select>
        <select
          aria-label={localize('com_data_query_filter_status')}
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
          className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm"
        >
          <option value="all">{localize('com_ui_all')}</option>
          <option value="enabled">{localize('com_ui_enabled')}</option>
          <option value="disabled">{localize('com_ui_disabled')}</option>
        </select>
        <select
          aria-label={localize('com_data_query_filter_quality')}
          value={qualityFilter}
          onChange={(event) => setQualityFilter(event.target.value as QualityFilter)}
          className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm"
        >
          <option value="all">{localize('com_ui_all')}</option>
          <option value="passed">passed</option>
          <option value="failed">failed</option>
          <option value="running">running</option>
          <option value="not_run">not run</option>
        </select>
      </section>

      <div className="overflow-x-auto rounded-lg border border-(--cui-color-stroke-default)">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-(--cui-color-stroke-default) bg-(--cui-color-background-muted)">
              {[
                'com_data_query_domain',
                'com_data_query_source',
                'com_data_query_published_version',
                'com_data_query_editable_versions',
                'com_data_query_quality',
                'com_data_query_authorizations',
                'com_data_query_runtime',
                'com_data_query_actions',
              ].map((key) => (
                <th key={key} className="px-4 py-3 font-medium whitespace-nowrap">
                  {localize(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((domain) => {
              const source = sourceByKey.get(domain.source_key);
              const editable = editableDomainVersion(domain);
              const published = domain.versions.find(
                (version) => version.version_key === domain.published_version,
              );
              return (
                <tr
                  key={domain.domain_key}
                  className="border-b border-(--cui-color-stroke-default) last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{domain.name}</p>
                    <p className="text-xs text-(--cui-color-text-muted)">{domain.domain_key}</p>
                    {!domain.enabled && (
                      <span className="mt-1 inline-block rounded bg-(--cui-color-background-secondary) px-2 py-0.5 text-xs">
                        {localize('com_ui_disabled')}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <p>{source?.name ?? domain.source_key}</p>
                    <p className="text-xs text-(--cui-color-text-muted)">
                      {source?.last_connection_status ?? '-'}
                    </p>
                  </td>
                  <td className="px-4 py-3">{domain.published_version ?? '-'}</td>
                  <td className="px-4 py-3">
                    {domain.versions.filter(
                      (version) => version.status === 'draft' || version.status === 'ready',
                    ).length}
                  </td>
                  <td className="px-4 py-3">{domainQuality(domain)}</td>
                  <td className="px-4 py-3">
                    <GrantCount domainKey={domain.domain_key} />
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-(--cui-color-text-muted)">
                      {localize('com_data_query_runtime_unavailable')}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex min-w-48 flex-wrap gap-2">
                      {published && (
                        <>
                          <VersionLink
                            domain={domain}
                            version={published}
                            label={localize('com_data_query_view_published')}
                          />
                          <VersionLink
                            domain={domain}
                            version={published}
                            label={localize('com_data_query_create_version')}
                          />
                        </>
                      )}
                      {editable && (
                        <VersionLink
                          domain={domain}
                          version={editable}
                          label={localize('com_data_query_continue_draft')}
                        />
                      )}
                      <Button
                        type="secondary"
                        label={
                          domain.enabled
                            ? localize('com_data_query_disable')
                            : localize('com_data_query_enable')
                        }
                        onClick={() => setTarget(domain)}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <EmptyState message={localize('com_data_query_no_domains')} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <ReasonDialog
        open={target !== null}
        title={
          target?.enabled
            ? localize('com_data_query_disable_domain')
            : localize('com_data_query_enable_domain')
        }
        description={localize('com_data_query_domain_toggle_hint')}
        reason={reason}
        saving={toggleMutation.isPending}
        error={toggleMutation.error?.message}
        onReasonChange={setReason}
        onSubmit={() => target && toggleMutation.mutate(target)}
        onClose={() => {
          setTarget(null);
          setReason('');
        }}
      />
    </div>
  );
}

function VersionLink({
  domain,
  version,
  label,
}: {
  domain: t.DataQueryDomain;
  version: t.DataQueryVersionSummary;
  label: string;
}) {
  return (
    <Link
      to="/data-query/domains/$domainKey/versions/$versionKey"
      params={{ domainKey: domain.domain_key, versionKey: version.version_key }}
      className="rounded-md border border-(--cui-color-stroke-default) px-3 py-1.5 text-xs font-medium text-(--cui-color-text-default) no-underline"
    >
      {label}
    </Link>
  );
}

function GrantCount({ domainKey }: { domainKey: string }) {
  const grants = useQuery({
    queryKey: ['data-query-v2', 'grants', domainKey],
    queryFn: () => listDataQueryGrantsFn({ data: { domainKey } }),
  });
  if (grants.isLoading) return <span>…</span>;
  if (grants.isError) return <span className="text-(--cui-color-text-muted)">-</span>;
  return <span>{(grants.data ?? []).filter((grant) => grant.enabled).length}</span>;
}
