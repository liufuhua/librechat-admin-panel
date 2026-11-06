import { Button, Tabs } from '@clickhouse/click-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type * as t from '@/types';
import { EmptyState, FormDialog, LoadingState } from '@/components/shared';
import {
  dataQueryAuditsOptions,
  dataQueryDomainsOptions,
  dataQuerySourceOptions,
  deleteDataQuerySourceFn,
  setDataQuerySourceEnabledFn,
  testDataQuerySourceFn,
  updateDataQuerySourceCredentialFn,
  updateDataQuerySourceFn,
} from '@/server';
import { notifyError, notifySuccess } from '@/utils';
import { useLocalize } from '@/hooks';
import { CredentialFields } from './CredentialFields';
import { ReasonDialog } from './ReasonDialog';
import { credentialIsComplete, emptyCredential } from './sourceForm';
import { SchemaDiscoveryPanel, type SnapshotSelection } from '../discovery';
import { saveDomainSelection } from '../domains/domainDraft';

type DetailTab = 'overview' | 'credentials' | 'discovery' | 'domains' | 'activity';
type HeaderAction = 'test' | 'toggle';

const inputClass =
  'rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal';

export function DataSourceDetailPage({ sourceKey }: { sourceKey: string }) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const source = useQuery(dataQuerySourceOptions(sourceKey));
  const domains = useQuery(dataQueryDomainsOptions);
  const audits = useQuery(dataQueryAuditsOptions);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [headerAction, setHeaderAction] = useState<HeaderAction | null>(null);
  const [reason, setReason] = useState('');
  const [actionError, setActionError] = useState<string | null>(null);
  const [metadataOpen, setMetadataOpen] = useState(false);
  const [credentialOpen, setCredentialOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const refreshSource = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'sources'] }),
      queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'sources', sourceKey] }),
      queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'audits'] }),
    ]);
  };
  const closeHeaderAction = () => {
    setHeaderAction(null);
    setReason('');
    setActionError(null);
  };
  const testMutation = useMutation({
    mutationFn: (actionReason: string) =>
      testDataQuerySourceFn({ data: { sourceKey, reason: actionReason } }),
    onSuccess: async (result) => {
      await refreshSource();
      const message = localize('com_data_query_connection_result', {
        status: result.status,
        code: result.code,
      });
      result.status === 'passed' ? notifySuccess(message) : notifyError(message);
      closeHeaderAction();
    },
    onError: (error: Error) => setActionError(error.message),
  });
  const toggleMutation = useMutation({
    mutationFn: ({ enabled, actionReason }: { enabled: boolean; actionReason: string }) =>
      setDataQuerySourceEnabledFn({
        data: { sourceKey, enabled, reason: actionReason },
      }),
    onSuccess: async () => {
      await refreshSource();
      notifySuccess(localize('com_data_query_source_updated'));
      closeHeaderAction();
    },
    onError: (error: Error) => setActionError(error.message),
  });

  if (source.isLoading) return <LoadingState />;
  if (source.isError || !source.data) {
    return (
      <div className="p-6">
        <div
          role="alert"
          className="rounded-lg border border-(--cui-color-stroke-danger) p-4 text-sm text-(--cui-color-text-danger)"
        >
          <p>{localize('com_data_query_source_load_failed')}</p>
          <Button
            type="secondary"
            label={localize('com_ui_retry')}
            onClick={() => source.refetch()}
          />
        </div>
      </div>
    );
  }

  const current = source.data;
  const sourceDomains = (domains.data ?? []).filter(
    (domain) => domain.source_key === current.source_key,
  );
  const sourceAudits = (audits.data ?? []).filter(
    (audit) =>
      audit.object_key === current.source_key ||
      audit.object_key.startsWith(`${current.source_key}:`),
  );
  const canEnable = current.last_connection_status === 'passed';
  const domainReferencesKnown = !domains.isLoading && !domains.isError;
  const disableImpact = sourceDomains.filter((domain) => domain.published_version).length;

  const submitHeaderAction = () => {
    if (!headerAction || !reason.trim()) return;
    if (headerAction === 'test') {
      testMutation.mutate(reason);
      return;
    }
    toggleMutation.mutate({ enabled: !current.enabled, actionReason: reason });
  };
  const createDomainFromSelection = (selection: SnapshotSelection) => {
    const token = saveDomainSelection(selection);
    navigate({ to: '/data-query/domains/new', search: { selection: token } });
  };
  let activityContent: React.ReactNode;
  if (audits.isError) {
    activityContent = (
      <p role="alert" className="text-sm text-(--cui-color-text-danger)">
        {localize('com_data_query_activity_load_failed')}
      </p>
    );
  } else if (sourceAudits.length === 0) {
    activityContent = <EmptyState message={localize('com_data_query_no_source_activity')} />;
  } else {
    activityContent = (
      <ol className="flex flex-col gap-3">
        {sourceAudits.map((audit) => (
          <li
            key={audit.id}
            className="rounded-md border border-(--cui-color-stroke-default) p-3 text-sm"
          >
            <div className="flex justify-between gap-4">
              <strong>{audit.action}</strong>
              <span className="text-(--cui-color-text-muted)">{audit.created_at ?? '-'}</span>
            </div>
            <p className="mt-1 text-(--cui-color-text-muted)">
              {audit.result} · {audit.request_id}
            </p>
          </li>
        ))}
      </ol>
    );
  }

  return (
    <div className="flex flex-col gap-5 p-6">
      <Link
        to="/data-query/sources"
        className="w-fit text-sm text-(--cui-color-text-muted) underline"
      >
        {localize('com_data_query_back_to_sources')}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-(--cui-color-title-default)">
              {current.name}
            </h2>
            <span className="rounded bg-(--cui-color-background-secondary) px-2 py-1 text-xs">
              {current.enabled ? localize('com_ui_enabled') : localize('com_ui_disabled')}
            </span>
          </div>
          <p className="mt-1 text-sm text-(--cui-color-text-muted)">
            {current.source_key} · {current.source_type} · {current.environment}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="secondary"
            label={localize('com_data_query_connection_test')}
            disabled={!current.secret_configured}
            onClick={() => {
              setActionError(null);
              setHeaderAction('test');
            }}
          />
          <Button
            type="secondary"
            label={
              current.enabled
                ? localize('com_data_query_disable')
                : localize('com_data_query_enable')
            }
            disabled={
              (!current.enabled && !canEnable) || (current.enabled && !domainReferencesKnown)
            }
            onClick={() => {
              setActionError(null);
              setHeaderAction('toggle');
            }}
          />
          <Button
            type="secondary"
            label={localize('com_data_query_edit_metadata')}
            onClick={() => setMetadataOpen(true)}
          />
          <Button
            type="secondary"
            label={localize('com_data_query_rotate_credential')}
            onClick={() => setCredentialOpen(true)}
          />
          <Button
            type="secondary"
            label={localize('com_ui_delete')}
            disabled={!domainReferencesKnown || sourceDomains.length > 0}
            onClick={() => setDeleteOpen(true)}
          />
        </div>
      </header>

      {!current.enabled && !canEnable && (
        <div className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-secondary) p-3 text-sm">
          {localize('com_data_query_enable_requires_test')}
        </div>
      )}
      {sourceDomains.length > 0 && (
        <div className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-secondary) p-3 text-sm">
          {localize('com_data_query_delete_blocked_domains', {
            count: String(sourceDomains.length),
          })}
        </div>
      )}
      {domains.isError && (
        <div
          role="alert"
          className="rounded-md border border-(--cui-color-stroke-danger) p-3 text-sm text-(--cui-color-text-danger)"
        >
          {localize('com_data_query_domain_references_load_failed')}
        </div>
      )}

      <Tabs
        value={tab}
        onValueChange={(value) => setTab(value as DetailTab)}
        ariaLabel={localize('com_data_query_source_details')}
      >
        <Tabs.TriggersList>
          <Tabs.Trigger value="overview">{localize('com_data_query_overview')}</Tabs.Trigger>
          <Tabs.Trigger value="credentials">{localize('com_data_query_credentials')}</Tabs.Trigger>
          <Tabs.Trigger value="discovery">
            {localize('com_data_query_schema_discovery')}
          </Tabs.Trigger>
          <Tabs.Trigger value="domains">{localize('com_data_query_domains')}</Tabs.Trigger>
          <Tabs.Trigger value="activity">{localize('com_data_query_activity')}</Tabs.Trigger>
        </Tabs.TriggersList>
      </Tabs>

      {tab === 'overview' && (
        <dl className="grid gap-4 rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-panel) p-5 md:grid-cols-2">
          <Detail label={localize('com_data_query_connection')}>
            {current.last_connection_status}
          </Detail>
          <Detail label={localize('com_data_query_last_connection_code')}>
            {current.last_connection_code ?? '-'}
          </Detail>
          <Detail label={localize('com_data_query_last_tested')}>
            {current.last_tested_at ?? localize('com_data_query_never_tested')}
          </Detail>
          <Detail label={localize('com_data_query_owner_team')}>{current.owner_team ?? '-'}</Detail>
          <Detail label={localize('com_data_query_risk')}>{current.risk_level}</Detail>
          <Detail label={localize('com_data_query_connection_summary')}>
            {localize('com_data_query_connection_details_protected')}
          </Detail>
        </dl>
      )}

      {tab === 'credentials' && (
        <div className="flex flex-col gap-4 rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-panel) p-5">
          <Detail label={localize('com_data_query_credential')}>{current.credential_state}</Detail>
          <Detail label={localize('com_data_query_secret_storage')}>
            {localize('com_data_query_server_managed_secret')}
          </Detail>
          <p className="text-sm text-(--cui-color-text-muted)">
            {localize('com_data_query_secret_never_displayed')}
          </p>
          <div>
            <Button
              type="secondary"
              label={localize('com_data_query_rotate_credential')}
              onClick={() => setCredentialOpen(true)}
            />
          </div>
        </div>
      )}

      {tab === 'discovery' && (
        <SchemaDiscoveryPanel
          source={current}
          domains={sourceDomains}
          onCreateDomain={createDomainFromSelection}
        />
      )}

      {tab === 'domains' && (
        <div className="overflow-hidden rounded-lg border border-(--cui-color-stroke-default)">
          {sourceDomains.length === 0 ? (
            <EmptyState message={localize('com_data_query_no_source_domains')} />
          ) : (
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-(--cui-color-stroke-default) bg-(--cui-color-background-muted)">
                  <th className="px-4 py-3">{localize('com_data_query_domain')}</th>
                  <th className="px-4 py-3">{localize('com_data_query_status')}</th>
                  <th className="px-4 py-3">{localize('com_data_query_version')}</th>
                </tr>
              </thead>
              <tbody>
                {sourceDomains.map((domain) => (
                  <tr
                    key={domain.domain_key}
                    className="border-b border-(--cui-color-stroke-default) last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium">{domain.name}</p>
                      <p className="text-xs text-(--cui-color-text-muted)">{domain.domain_key}</p>
                    </td>
                    <td className="px-4 py-3">
                      {domain.enabled ? localize('com_ui_enabled') : localize('com_ui_disabled')}
                    </td>
                    <td className="px-4 py-3">
                      {domain.published_version ?? localize('com_data_query_not_published')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {tab === 'activity' && (
        <div className="rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-panel) p-5">
          {activityContent}
        </div>
      )}

      <ReasonDialog
        open={headerAction !== null}
        title={
          headerAction === 'test'
            ? localize('com_data_query_connection_test')
            : localize('com_data_query_change_source_status')
        }
        description={
          headerAction === 'toggle' && current.enabled && disableImpact > 0
            ? localize('com_data_query_disable_impact', {
                count: String(disableImpact),
              })
            : undefined
        }
        reason={reason}
        saving={testMutation.isPending || toggleMutation.isPending}
        error={actionError}
        onReasonChange={setReason}
        onSubmit={submitHeaderAction}
        onClose={closeHeaderAction}
      />
      <MetadataDialog
        source={current}
        open={metadataOpen}
        onClose={() => setMetadataOpen(false)}
        onSaved={refreshSource}
      />
      <CredentialDialog
        source={current}
        open={credentialOpen}
        onClose={() => setCredentialOpen(false)}
        onSaved={refreshSource}
      />
      <DeleteDialog
        source={current}
        domainCount={sourceDomains.length}
        referencesAvailable={domainReferencesKnown}
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onDeleted={() => {
          queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'sources'] });
          navigate({ to: '/data-query/sources' });
        }}
      />
    </div>
  );
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium tracking-wide text-(--cui-color-text-muted) uppercase">
        {label}
      </dt>
      <dd className="mt-1 text-sm text-(--cui-color-text-default)">{children}</dd>
    </div>
  );
}

function MetadataDialog({
  source,
  open,
  onClose,
  onSaved,
}: {
  source: t.DataQuerySource;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const localize = useLocalize();
  const [name, setName] = useState(source.name);
  const [environment, setEnvironment] = useState(source.environment);
  const [ownerTeam, setOwnerTeam] = useState(source.owner_team ?? '');
  const [riskLevel, setRiskLevel] = useState(source.risk_level);
  const [reason, setReason] = useState('');
  useEffect(() => {
    if (!open) return;
    setName(source.name);
    setEnvironment(source.environment);
    setOwnerTeam(source.owner_team ?? '');
    setRiskLevel(source.risk_level);
    setReason('');
  }, [open, source.environment, source.name, source.owner_team, source.risk_level]);
  const mutation = useMutation({
    mutationFn: () =>
      updateDataQuerySourceFn({
        data: {
          sourceKey: source.source_key,
          name,
          environment,
          ownerTeam: ownerTeam || null,
          riskLevel,
          reason,
        },
      }),
    onSuccess: async () => {
      await onSaved();
      notifySuccess(localize('com_data_query_metadata_updated'));
      setReason('');
      onClose();
    },
  });
  return (
    <FormDialog
      open={open}
      title={localize('com_data_query_edit_metadata')}
      submitLabel={localize('com_ui_save')}
      submitDisabled={!name.trim() || !environment.trim() || !reason.trim()}
      saving={mutation.isPending}
      error={mutation.error?.message}
      onSubmit={() => mutation.mutate()}
      onClose={onClose}
    >
      <div className="grid gap-4 md:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_source_name')}
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_environment')}
          <select
            value={environment}
            onChange={(event) => setEnvironment(event.target.value)}
            className={inputClass}
          >
            <option value="dev">dev</option>
            <option value="test">test</option>
            <option value="staging">staging</option>
            <option value="production">production</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_owner_team')}
          <input
            value={ownerTeam}
            onChange={(event) => setOwnerTeam(event.target.value)}
            className={inputClass}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_risk')}
          <select
            value={riskLevel}
            onChange={(event) => setRiskLevel(event.target.value as t.DataQueryRiskLevel)}
            className={inputClass}
          >
            <option value="low">{localize('com_data_query_risk_low')}</option>
            <option value="medium">{localize('com_data_query_risk_medium')}</option>
            <option value="high">{localize('com_data_query_risk_high')}</option>
          </select>
        </label>
      </div>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {localize('com_data_query_reason')}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-24 rounded-md border border-(--cui-color-stroke-default) p-3"
        />
      </label>
    </FormDialog>
  );
}

function CredentialDialog({
  source,
  open,
  onClose,
  onSaved,
}: {
  source: t.DataQuerySource;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void>;
}) {
  const localize = useLocalize();
  const [credential, setCredential] = useState(() => emptyCredential(source.source_type));
  const [reason, setReason] = useState('');
  const [requireConnectionSuccess, setRequireConnectionSuccess] = useState(true);
  const close = () => {
    setCredential(emptyCredential(source.source_type));
    setReason('');
    setRequireConnectionSuccess(true);
    onClose();
  };
  const mutation = useMutation({
    mutationFn: (data: t.DataQuerySourceCredentialInput) =>
      updateDataQuerySourceCredentialFn({ data }),
    onSuccess: async () => {
      await onSaved();
      notifySuccess(localize('com_data_query_credential_rotated'));
      close();
    },
  });
  const rotateCredential = () => {
    mutation.mutate({ sourceKey: source.source_key, credential: { ...credential }, requireConnectionSuccess, reason });
    setCredential((current) => ({ ...current, password: '' }));
  };
  return (
    <FormDialog
      open={open}
      title={localize('com_data_query_rotate_credential')}
      submitLabel={localize('com_data_query_rotate_and_test')}
      submitDisabled={!credentialIsComplete(credential) || !reason.trim()}
      saving={mutation.isPending}
      error={mutation.error?.message}
      onSubmit={rotateCredential}
      onClose={close}
      size="lg"
    >
      <p className="text-sm text-(--cui-color-text-muted)">
        {localize('com_data_query_secret_never_displayed')}
      </p>
      <CredentialFields
        credential={credential}
        onChange={setCredential}
        disabled={mutation.isPending}
      />
      <label className="flex items-center gap-3 text-sm">
        <input
          type="checkbox"
          checked={requireConnectionSuccess}
          onChange={(event) => setRequireConnectionSuccess(event.target.checked)}
        />
        {localize('com_data_query_require_connection_success')}
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {localize('com_data_query_reason')}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-24 rounded-md border border-(--cui-color-stroke-default) p-3"
        />
      </label>
    </FormDialog>
  );
}

function DeleteDialog({
  source,
  domainCount,
  referencesAvailable,
  open,
  onClose,
  onDeleted,
}: {
  source: t.DataQuerySource;
  domainCount: number;
  referencesAvailable: boolean;
  open: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const localize = useLocalize();
  const [confirmation, setConfirmation] = useState('');
  const [reason, setReason] = useState('');
  const close = () => {
    setConfirmation('');
    setReason('');
    onClose();
  };
  const mutation = useMutation({
    mutationFn: () =>
      deleteDataQuerySourceFn({
        data: { sourceKey: source.source_key, reason },
      }),
    onSuccess: () => {
      notifySuccess(localize('com_data_query_source_deleted'));
      close();
      onDeleted();
    },
  });
  let warning: React.ReactNode;
  if (!referencesAvailable) {
    warning = (
      <p role="alert" className="text-sm text-(--cui-color-text-danger)">
        {localize('com_data_query_domain_references_load_failed')}
      </p>
    );
  } else if (domainCount > 0) {
    warning = (
      <p role="alert" className="text-sm text-(--cui-color-text-danger)">
        {localize('com_data_query_delete_blocked_domains', {
          count: String(domainCount),
        })}
      </p>
    );
  } else {
    warning = (
      <p className="text-sm text-(--cui-color-text-muted)">
        {localize('com_data_query_delete_confirmation', { name: source.name })}
      </p>
    );
  }
  return (
    <FormDialog
      open={open}
      title={localize('com_data_query_delete_source')}
      submitLabel={localize('com_ui_delete')}
      submitDisabled={
        !referencesAvailable || domainCount > 0 || confirmation !== source.name || !reason.trim()
      }
      saving={mutation.isPending}
      error={mutation.error?.message}
      onSubmit={() => mutation.mutate()}
      onClose={close}
    >
      {warning}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {localize('com_data_query_confirmation_name')}
        <input
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {localize('com_data_query_reason')}
        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          className="min-h-24 rounded-md border border-(--cui-color-stroke-default) p-3"
        />
      </label>
    </FormDialog>
  );
}
