import { Button, Tabs } from '@clickhouse/click-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type * as t from '@/types';
import { EmptyState, FormDialog, LoadingState, StatusToggle } from '@/components/shared';
import {
  dataQueryAuditsOptions,
  dataQueryDomainsOptions,
  dataQuerySourcesOptions,
  listDataQueryGrantsFn,
  setDataQueryGrantEnabledFn,
  setDataQuerySourceEnabledFn,
  testDataQuerySourceFn,
} from '@/server';
import { notifyError, notifySuccess } from '@/utils';
import { useLocalize } from '@/hooks';
import { SourceDialog } from './SourceDialog';
import { GrantDialog } from './GrantDialog';

type Tab = 'sources' | 'authorizations' | 'audits';

export function DataQueryPage({
  initialTab = 'sources',
  showTabs = true,
}: {
  initialTab?: Tab;
  showTabs?: boolean;
}) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [grantDialogOpen, setGrantDialogOpen] = useState(false);
  const [reasonDialog, setReasonDialog] = useState<{
    source: t.DataQuerySource;
    action: 'test' | 'toggle';
  } | null>(null);
  const [reason, setReason] = useState('');
  const [grantTarget, setGrantTarget] = useState<{
    domainKey: string;
    grant: t.DataQueryGrant;
  } | null>(null);
  const [grantReason, setGrantReason] = useState('');
  const sources = useQuery(dataQuerySourcesOptions);
  const domains = useQuery(dataQueryDomainsOptions);
  const audits = useQuery(dataQueryAuditsOptions);
  const refreshSources = () =>
    queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'sources'] });

  const testMutation = useMutation({
    mutationFn: (data: { sourceKey: string; reason: string }) => testDataQuerySourceFn({ data }),
    onSuccess: (result) => {
      const message = localize('com_data_query_connection_result', {
        source_key: result.source_key,
        status: result.status,
        code: result.code,
      });
      if (result.status === 'passed') {
        notifySuccess(message);
      } else {
        notifyError(message);
      }
      setReasonDialog(null);
      setReason('');
    },
    onError: (error: Error) => notifyError(error.message),
  });
  const toggleMutation = useMutation({
    mutationFn: (data: { sourceKey: string; enabled: boolean; reason: string }) =>
      setDataQuerySourceEnabledFn({ data }),
    onSuccess: () => {
      notifySuccess(localize('com_data_query_source_updated'));
      refreshSources();
      setReasonDialog(null);
      setReason('');
    },
    onError: (error: Error) => notifyError(error.message),
  });
  const grantMutation = useMutation({
    mutationFn: (data: { domainKey: string; grantId: number; enabled: boolean; reason: string }) =>
      setDataQueryGrantEnabledFn({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'grants'] });
      notifySuccess(localize('com_data_query_authorization_updated'));
      setGrantTarget(null);
      setGrantReason('');
    },
    onError: (error: Error) => notifyError(error.message),
  });

  const submitReason = () => {
    if (!reasonDialog || !reason.trim()) return;
    if (reasonDialog.action === 'test') {
      testMutation.mutate({ sourceKey: reasonDialog.source.source_key, reason });
      return;
    }
    toggleMutation.mutate({
      sourceKey: reasonDialog.source.source_key,
      enabled: !reasonDialog.source.enabled,
      reason,
    });
  };

  const reasonTitle =
    reasonDialog?.action === 'test'
      ? localize('com_data_query_connection_test')
      : localize('com_data_query_change_source_status');

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-4 pt-2">
      {showTabs && (
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as Tab)}
          ariaLabel={localize('com_data_query_title')}
        >
          <Tabs.TriggersList>
            <Tabs.Trigger value="sources">{localize('com_data_query_tab_sources')}</Tabs.Trigger>
            <Tabs.Trigger value="authorizations">
              {localize('com_data_query_tab_authorizations')}
            </Tabs.Trigger>
            <Tabs.Trigger value="audits">{localize('com_data_query_tab_audits')}</Tabs.Trigger>
          </Tabs.TriggersList>
        </Tabs>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto py-4">
        {tab === 'sources' && (
          <SourcesTab
            sources={sources.data ?? []}
            loading={sources.isLoading}
            error={sources.isError ? sources.error.message : null}
            onCreate={() => setSourceDialogOpen(true)}
            onTest={(source) => setReasonDialog({ source, action: 'test' })}
            onToggle={(source) => setReasonDialog({ source, action: 'toggle' })}
          />
        )}
        {tab === 'authorizations' && (
          <AuthorizationsTab
            domains={domains.data ?? []}
            loading={domains.isLoading}
            onCreate={() => setGrantDialogOpen(true)}
            onToggle={(domainKey, grant) => setGrantTarget({ domainKey, grant })}
          />
        )}
        {tab === 'audits' && <AuditsTab audits={audits.data ?? []} loading={audits.isLoading} />}
      </div>
      <SourceDialog open={sourceDialogOpen} onClose={() => setSourceDialogOpen(false)} />
      <GrantDialog
        open={grantDialogOpen}
        domains={domains.data ?? []}
        onClose={() => setGrantDialogOpen(false)}
      />
      <FormDialog
        open={reasonDialog !== null}
        title={reasonTitle}
        submitLabel={localize('com_ui_confirm')}
        submitDisabled={!reason.trim()}
        saving={testMutation.isPending || toggleMutation.isPending}
        onSubmit={submitReason}
        onClose={() => {
          setReasonDialog(null);
          setReason('');
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium text-(--cui-color-text-default)">
          {localize('com_data_query_reason')}
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-24 rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) p-2 text-sm font-normal"
          />
        </label>
      </FormDialog>
      <FormDialog
        open={grantTarget !== null}
        title={
          grantTarget?.grant.enabled
            ? localize('com_data_query_revoke')
            : localize('com_data_query_restore')
        }
        submitLabel={localize('com_ui_confirm')}
        submitDisabled={!grantReason.trim()}
        saving={grantMutation.isPending}
        onSubmit={() => {
          if (!grantTarget) return;
          grantMutation.mutate({
            domainKey: grantTarget.domainKey,
            grantId: grantTarget.grant.grant_id,
            enabled: !grantTarget.grant.enabled,
            reason: grantReason,
          });
        }}
        onClose={() => {
          setGrantTarget(null);
          setGrantReason('');
        }}
      >
        <label className="flex flex-col gap-1.5 text-sm font-medium text-(--cui-color-text-default)">
          {localize('com_data_query_reason')}
          <textarea
            value={grantReason}
            onChange={(event) => setGrantReason(event.target.value)}
            className="min-h-24 rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) p-2 text-sm font-normal"
          />
        </label>
      </FormDialog>
    </div>
  );
}

function AuthorizationsTab({
  domains,
  loading,
  onCreate,
  onToggle,
}: {
  domains: t.DataQueryDomain[];
  loading: boolean;
  onCreate: () => void;
  onToggle: (domainKey: string, grant: t.DataQueryGrant) => void;
}) {
  const localize = useLocalize();
  if (loading) return <LoadingState />;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-(--cui-color-text-muted)">
          {localize('com_data_query_authorizations_hint')}
        </p>
        <Button
          type="primary"
          label={localize('com_data_query_create_authorization')}
          onClick={onCreate}
          disabled={domains.length === 0}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-(--cui-color-stroke-default)">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-(--cui-color-stroke-default) bg-(--cui-color-background-muted)">
              <th className="px-4 py-2.5 font-medium text-(--cui-color-text-muted)">
                {localize('com_data_query_domain')}
              </th>
              <th className="px-4 py-2.5 font-medium text-(--cui-color-text-muted)">
                {localize('com_data_query_status')}
              </th>
              <th className="px-4 py-2.5 font-medium text-(--cui-color-text-muted)">
                {localize('com_data_query_authorizations')}
              </th>
            </tr>
          </thead>
          <tbody>
            {domains.map((domain) => (
              <AuthorizationRow key={domain.domain_key} domain={domain} onToggle={onToggle} />
            ))}
            {domains.length === 0 && (
              <tr>
                <td colSpan={3}>
                  <EmptyState message={localize('com_data_query_no_domains')} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuthorizationRow({
  domain,
  onToggle,
}: {
  domain: t.DataQueryDomain;
  onToggle: (domainKey: string, grant: t.DataQueryGrant) => void;
}) {
  const localize = useLocalize();
  const grants = useQuery({
    queryKey: ['data-query-v2', 'grants', domain.domain_key],
    queryFn: () => listDataQueryGrantsFn({ data: { domainKey: domain.domain_key } }),
  });
  const summary =
    grants.data
      ?.map((grant) => `${grant.effect} ${grant.subject_type}:${grant.subject_key}`)
      .join(', ') || '-';
  return (
    <tr className="border-b border-(--cui-color-stroke-default) last:border-0">
      <td className="px-4 py-3">{domain.name}</td>
      <td className="px-4 py-3">
        {domain.enabled ? localize('com_ui_enabled') : localize('com_ui_disabled')}
      </td>
      <td className="px-4 py-3">
        <p>{summary}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {grants.data?.map((grant) => (
            <Button
              key={grant.grant_id}
              type="secondary"
              label={
                grant.enabled
                  ? localize('com_data_query_revoke')
                  : localize('com_data_query_restore')
              }
              onClick={() => onToggle(domain.domain_key, grant)}
            />
          ))}
        </div>
      </td>
    </tr>
  );
}

function SourcesTab({
  sources,
  loading,
  error,
  onCreate,
  onTest,
  onToggle,
}: {
  sources: t.DataQuerySource[];
  loading: boolean;
  error: string | null;
  onCreate: () => void;
  onTest: (source: t.DataQuerySource) => void;
  onToggle: (source: t.DataQuerySource) => void;
}) {
  const localize = useLocalize();
  if (loading) return <LoadingState />;
  if (error) {
    return (
      <div
        className="rounded-lg border border-(--cui-color-stroke-danger) p-4 text-sm text-(--cui-color-text-danger)"
        role="alert"
      >
        <p>{localize('com_data_query_sources_load_failed')}</p>
        <p className="mt-1 font-mono text-xs">{error}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-(--cui-color-text-muted)">
          {localize('com_data_query_sources_hint')}
        </p>
        <Button
          type="primary"
          label={localize('com_data_query_create_source')}
          onClick={onCreate}
        />
      </div>
      <div className="overflow-x-auto rounded-lg border border-(--cui-color-stroke-default)">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-(--cui-color-stroke-default) bg-(--cui-color-background-muted)">
              {[
                'com_data_query_source',
                'com_data_query_type',
                'com_data_query_environment',
                'com_data_query_risk',
                'com_data_query_status',
                'com_data_query_actions',
              ].map((key) => (
                <th key={key} className="px-4 py-2.5 font-medium text-(--cui-color-text-muted)">
                  {localize(key)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sources.map((source) => (
              <tr
                key={source.source_key}
                className="border-b border-(--cui-color-stroke-default) last:border-0"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{source.name}</p>
                  <p className="text-xs text-(--cui-color-text-muted)">{source.source_key}</p>
                </td>
                <td className="px-4 py-3">{source.source_type}</td>
                <td className="px-4 py-3">{source.environment}</td>
                <td className="px-4 py-3">{source.risk_level}</td>
                <td className="px-4 py-3">
                  <StatusToggle
                    id={source.source_key}
                    isActive={source.enabled}
                    onChange={() => onToggle(source)}
                  />
                </td>
                <td className="px-4 py-3">
                  <Button
                    type="secondary"
                    label={localize('com_data_query_connection_test')}
                    onClick={() => onTest(source)}
                  />
                </td>
              </tr>
            ))}
            {sources.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <EmptyState message={localize('com_data_query_no_sources')} />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function AuditsTab({ audits, loading }: { audits: t.DataQueryAudit[]; loading: boolean }) {
  const localize = useLocalize();
  if (loading) return <LoadingState />;
  if (audits.length === 0) return <EmptyState message={localize('com_data_query_no_audits')} />;
  return (
    <ol className="relative ml-3 border-l border-(--cui-color-stroke-default)">
      {audits.map((audit) => (
        <li key={audit.id} className="relative pb-5 pl-5">
          <span className="absolute top-1.5 -left-1.5 size-3 rounded-full bg-(--cui-color-accent)" />
          <div className="rounded-lg border border-(--cui-color-stroke-default) p-3 text-sm">
            <div className="flex flex-wrap justify-between gap-2">
              <strong>{audit.action}</strong>
              <span className="text-(--cui-color-text-muted)">{audit.created_at ?? '-'}</span>
            </div>
            <p className="mt-1 font-mono text-xs">{audit.object_key}</p>
            <p className="mt-2 text-(--cui-color-text-muted)">
              Actor: {audit.actor_subject_id} · Result: {audit.result}
            </p>
            {audit.reason && <p className="mt-1">Reason: {audit.reason}</p>}
          </div>
        </li>
      ))}
    </ol>
  );
}
