import { Button } from '@clickhouse/click-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { FormDialog, LoadingState } from '@/components/shared';
import { DomainVersionEditor } from '@/components/dataquery/editor';
import {
  cloneDataQueryVersionFn,
  getDataQueryVersionFn,
  reopenDataQueryVersionFn,
} from '@/server';
import { useLocalize } from '@/hooks';
import { notifyError, notifySuccess } from '@/utils';

type VersionAction = 'clone' | 'reopen';
const inputClass =
  'rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm';

export function DomainVersionPage({
  domainKey,
  versionKey,
}: {
  domainKey: string;
  versionKey: string;
}) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const version = useQuery({
    queryKey: ['data-query-v2', 'domains', domainKey, 'versions', versionKey],
    queryFn: () => getDataQueryVersionFn({ data: { domainKey, versionKey } }),
  });
  const [action, setAction] = useState<VersionAction | null>(null);
  const [newVersionKey, setNewVersionKey] = useState('');
  const [reason, setReason] = useState('');

  const cloneMutation = useMutation({
    mutationFn: () =>
      cloneDataQueryVersionFn({
        data: { domainKey, versionKey, newVersionKey, reason },
      }),
    onSuccess: async (result) => {
      await queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'domains'] });
      notifySuccess(localize('com_data_query_version_cloned'));
      setAction(null);
      navigate({
        to: '/data-query/domains/$domainKey/versions/$versionKey',
        params: { domainKey, versionKey: result.version_key },
      });
    },
    onError: (error: Error) => notifyError(error.message),
  });
  const reopenMutation = useMutation({
    mutationFn: () => {
      if (!version.data) throw new Error('domain_version_missing');
      return reopenDataQueryVersionFn({
        data: {
          domainKey,
          versionKey,
          expectedRevision: version.data.revision,
          reason,
        },
      });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: ['data-query-v2', 'domains', domainKey, 'versions', versionKey],
        }),
        queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'domains'] }),
      ]);
      notifySuccess(localize('com_data_query_version_reopened'));
      setAction(null);
      setReason('');
    },
    onError: (error: Error) => notifyError(error.message),
  });

  if (version.isLoading) return <LoadingState />;
  if (version.isError || !version.data) {
    return (
      <div className="p-6">
        <div
          role="alert"
          className="rounded-lg border border-(--cui-color-stroke-danger) p-4 text-sm text-(--cui-color-text-danger)"
        >
          <p>{localize('com_data_query_version_load_failed')}</p>
          <Button
            type="secondary"
            label={localize('com_ui_retry')}
            onClick={() => version.refetch()}
          />
        </div>
      </div>
    );
  }

  const current = version.data;
  const canClone = current.status === 'published' || current.status === 'retired';
  const canReopen = current.status === 'ready';
  return (
    <div className="flex flex-col gap-5 p-6">
      <Link
        to="/data-query/domains"
        className="w-fit text-sm text-(--cui-color-text-muted) underline"
      >
        {localize('com_data_query_back_to_domains')}
      </Link>
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-semibold text-(--cui-color-title-default)">
              {current.draft.display_name}
            </h2>
            <span className="rounded bg-(--cui-color-background-secondary) px-2 py-1 text-xs">
              {current.status}
            </span>
          </div>
          <p className="mt-1 text-sm text-(--cui-color-text-muted)">
            {domainKey} · {versionKey} · revision {current.revision}
          </p>
        </div>
        <div className="flex gap-2">
          {canReopen && (
            <Button
              type="secondary"
              label={localize('com_data_query_reopen_version')}
              onClick={() => setAction('reopen')}
            />
          )}
          {canClone && (
            <Button
              type="primary"
              label={localize('com_data_query_create_version')}
              onClick={() => setAction('clone')}
            />
          )}
        </div>
      </header>

      <section className="grid gap-4 rounded-lg border border-(--cui-color-stroke-default) p-5 md:grid-cols-4">
        <Summary label={localize('com_data_query_status')}>{current.status}</Summary>
        <Summary label={localize('com_data_query_revision')}>
          {String(current.revision)}
        </Summary>
        <Summary label={localize('com_data_query_quality')}>
          {current.quality_status}
        </Summary>
        <Summary label={localize('com_data_query_runtime')}>
          {localize('com_data_query_runtime_unavailable')}
        </Summary>
      </section>

      <DomainVersionEditor version={current} refresh={() => version.refetch()} />

      <FormDialog
        open={action !== null}
        title={
          action === 'clone'
            ? localize('com_data_query_create_version')
            : localize('com_data_query_reopen_version')
        }
        submitLabel={localize('com_ui_confirm')}
        submitDisabled={
          !reason.trim() ||
          (action === 'clone' && !/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(newVersionKey))
        }
        saving={cloneMutation.isPending || reopenMutation.isPending}
        error={cloneMutation.error?.message ?? reopenMutation.error?.message}
        onSubmit={() =>
          action === 'clone' ? cloneMutation.mutate() : reopenMutation.mutate()
        }
        onClose={() => {
          setAction(null);
          setNewVersionKey('');
          setReason('');
        }}
      >
        {action === 'clone' && (
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {localize('com_data_query_new_version')}
            <input
              value={newVersionKey}
              onChange={(event) => setNewVersionKey(event.target.value)}
              className={inputClass}
            />
          </label>
        )}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_reason')}
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className={`${inputClass} min-h-24`}
          />
        </label>
      </FormDialog>
    </div>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-(--cui-color-text-muted) uppercase">{label}</dt>
      <dd className="mt-1 text-sm">{children}</dd>
    </div>
  );
}
