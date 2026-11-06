import { Button } from '@clickhouse/click-ui';
import { Link } from '@tanstack/react-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import type * as t from '@/types';
import {
  getLatestDataQueryQualityRunFn,
  listDataQueryDomainsFn,
  listDataQueryGrantsFn,
  publishDataQueryVersionFn,
  rollbackDataQueryVersionFn,
  runDataQueryQualityFn,
  updateDataQueryDomainDraftFn,
} from '@/server';
import { MetricsStep, PatternsStep, RelationshipsStep, TerminologyStep } from './SemanticSteps';
import { PoliciesStep, QualityTraceStep, RulesStep } from './GovernanceSteps';
import { cloneDraft, validateEditorDraft } from './editorUtils';
import { Field, Section, fieldClass } from './EditorFields';
import { BasicStep, SchemaStep } from './BasicSchemaSteps';
import { notifyError, notifySuccess } from '@/utils';
import { useLocalize } from '@/hooks/useLocalize';

const steps = [
  'com_data_query_editor_basic_information_6c092c',
  'com_data_query_editor_schema_07b091',
  'com_data_query_editor_terminology_9615bd',
  'com_data_query_editor_metrics_a58da7',
  'com_data_query_editor_relationships_85752a',
  'com_data_query_editor_query_patterns_4a2284',
  'com_data_query_editor_sql_rules_0dc869',
  'com_data_query_editor_access_policies_9db7db',
  'com_data_query_editor_quality_source_trace_7ea310',
  'com_data_query_editor_review_publish_a713d3',
] as const;

export function DomainVersionEditor({
  version,
  refresh,
}: {
  version: t.DataQueryDomainVersionDetail;
  refresh: () => Promise<unknown>;
}) {
  const localize = useLocalize();
  const [draft, setDraft] = useState(() => cloneDraft(version.draft));
  const [baseline, setBaseline] = useState(() => JSON.stringify(version.draft));
  const [active, setActive] = useState(0);
  const [reason, setReason] = useState('');
  const [conflictRevision, setConflictRevision] = useState<number | null>(null);
  const serialized = JSON.stringify(draft);
  const dirty = serialized !== baseline;
  const readOnly = version.status !== 'draft';
  const errors = useMemo(() => validateEditorDraft(draft), [serialized]);

  useEffect(() => {
    if (!dirty) {
      setDraft(cloneDraft(version.draft));
      setBaseline(JSON.stringify(version.draft));
    }
  }, [version.revision, version.draft, dirty]);
  useEffect(() => {
    const handler = (event: BeforeUnloadEvent) => {
      if (dirty) {
        event.preventDefault();
        event.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  const update = (mutate: (value: t.DataQueryDomainDraft) => void) => {
    if (readOnly) return;
    setDraft((current) => {
      const next = cloneDraft(current);
      mutate(next);
      return next;
    });
    setConflictRevision(null);
  };
  const save = useMutation({
    mutationFn: () =>
      updateDataQueryDomainDraftFn({
        data: {
          domainKey: version.domain_key,
          versionKey: version.version_key,
          draft,
          expectedRevision: version.revision,
          reason,
        },
      }),
    onSuccess: async () => {
      setBaseline(serialized);
      setReason('');
      setConflictRevision(null);
      notifySuccess(localize('com_data_query_editor_domain_draft_saved_4d06bb'));
      await refresh();
    },
    onError: async (error: Error) => {
      if (error.message === 'domain_version_conflict') {
        const result = (await refresh()) as { data?: t.DataQueryDomainVersionDetail };
        setConflictRevision(result.data?.revision ?? version.revision);
        return;
      }
      notifyError(error.message);
    },
  });
  const discard = () => {
    setDraft(cloneDraft(version.draft));
    setBaseline(JSON.stringify(version.draft));
    setReason('');
    setConflictRevision(null);
  };
  const counts = [
    null,
    draft.tables.length,
    Object.keys(draft.terminology).length,
    draft.metrics.length,
    draft.relationships.length,
    draft.query_patterns.length,
    draft.sql_rules.length,
    draft.access_policies.length,
    draft.quality_cases.length + draft.source_traces.length,
    null,
  ];

  return (
    <div className="grid gap-4 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <nav
        aria-label={localize('com_data_query_editor_domain_editor_steps_ff6cb8')}
        className="h-fit rounded-lg border border-(--cui-color-stroke-default) p-2 lg:sticky lg:top-4"
      >
        <ol>
          {steps.map((label, index) => (
            <li key={label}>
              <button
                type="button"
                onClick={() => setActive(index)}
                className={`flex w-full items-center justify-between rounded px-3 py-2 text-left text-sm ${active === index ? 'bg-(--cui-color-background-secondary) font-medium' : 'text-(--cui-color-text-muted)'}`}
              >
                <span>
                  {index + 1}. {localize(label)}
                </span>
                {counts[index] !== null && <span>{counts[index]}</span>}
              </button>
            </li>
          ))}
        </ol>
      </nav>
      <main className="min-w-0 pb-28">
        {active === 0 && <BasicStep draft={draft} readOnly={readOnly} update={update} />}{' '}
        {active === 1 && <SchemaStep draft={draft} readOnly={readOnly} update={update} />}{' '}
        {active === 2 && <TerminologyStep draft={draft} readOnly={readOnly} update={update} />}{' '}
        {active === 3 && <MetricsStep draft={draft} readOnly={readOnly} update={update} />}{' '}
        {active === 4 && <RelationshipsStep draft={draft} readOnly={readOnly} update={update} />}{' '}
        {active === 5 && <PatternsStep draft={draft} readOnly={readOnly} update={update} />}{' '}
        {active === 6 && <RulesStep draft={draft} readOnly={readOnly} update={update} />}{' '}
        {active === 7 && <PoliciesStep draft={draft} readOnly={readOnly} update={update} />}{' '}
        {active === 8 && <QualityTraceStep draft={draft} readOnly={readOnly} update={update} />}{' '}
        {active === 9 && (
          <ReviewStep version={version} draft={draft} dirty={dirty} refresh={refresh} />
        )}
      </main>
      {!readOnly && (
        <div className="fixed right-0 bottom-0 left-0 z-20 border-t border-(--cui-color-stroke-default) bg-(--cui-color-background-default) p-3 shadow-lg lg:left-64">
          <div className="mx-auto flex max-w-6xl flex-wrap items-end justify-between gap-3">
            <div>
              <strong>
                {dirty
                  ? localize('com_data_query_editor_unsaved_changes_a710c2')
                  : localize('com_data_query_editor_all_changes_saved_fc2f5a')}
              </strong>
              <p className="text-xs text-(--cui-color-text-muted)">
                {localize('com_data_query_editor_revision_2b214d')}
                {version.revision}
                {errors.length ? ` · ${errors.length} validation issue(s)` : ''}
              </p>
            </div>
            <div className="flex flex-1 items-end justify-end gap-2">
              <label className="flex min-w-72 flex-col gap-1 text-xs">
                {localize('com_data_query_editor_audit_reason_ad6c0c')}
                <input
                  className={fieldClass}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={localize(
                    'com_data_query_editor_why_is_this_configuration_changing_caa055',
                  )}
                />
              </label>
              <Button
                type="secondary"
                label={localize('com_data_query_editor_discard_eb1a70')}
                disabled={!dirty || save.isPending}
                onClick={discard}
              />
              <Button
                type="primary"
                label={localize('com_data_query_editor_save_draft_3de100')}
                disabled={!dirty || !reason.trim() || errors.length > 0 || save.isPending}
                onClick={() => save.mutate()}
              />
            </div>
          </div>
          {errors.length > 0 && (
            <p className="mx-auto mt-2 max-w-6xl text-xs text-(--cui-color-text-danger)">
              {errors.join(' · ')}
            </p>
          )}
          {conflictRevision !== null && (
            <div
              role="alert"
              className="mx-auto mt-2 max-w-6xl rounded border border-(--cui-color-stroke-warning) p-2 text-sm"
            >
              {localize('com_data_query_editor_revision_conflict_server_is_now_revision_d00a92')}
              {conflictRevision}
              {localize(
                'com_data_query_editor__your_local_edits_are_preserved_review_the_lates_74d85c',
              )}{' '}
              <button
                type="button"
                className="ml-2 underline"
                onClick={() => {
                  setConflictRevision(null);
                  void refresh();
                }}
              >
                {localize('com_data_query_editor_refresh_revision_3a8181')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ReviewStep({
  version,
  draft,
  dirty,
  refresh,
}: {
  version: t.DataQueryDomainVersionDetail;
  draft: t.DataQueryDomainDraft;
  dirty: boolean;
  refresh: () => Promise<unknown>;
}) {
  const localize = useLocalize();
  const [reason, setReason] = useState('');
  const domains = useQuery({
    queryKey: ['data-query-v2', 'domains'],
    queryFn: () => listDataQueryDomainsFn(),
  });
  const grants = useQuery({
    queryKey: ['data-query-v2', 'domains', version.domain_key, 'grants'],
    queryFn: () => listDataQueryGrantsFn({ data: { domainKey: version.domain_key } }),
  });
  const domain = domains.data?.find((item) => item.domain_key === version.domain_key);
  const activeGrantCount = (grants.data ?? []).filter((grant) => grant.enabled).length;
  const qualityRun = useQuery({
    queryKey: ['data-query-v2', 'domains', version.domain_key, version.version_key, 'quality-run'],
    queryFn: () =>
      getLatestDataQueryQualityRunFn({
        data: { domainKey: version.domain_key, versionKey: version.version_key },
      }),
    refetchInterval: (query) =>
      ['queued', 'running'].includes(query.state.data?.status ?? '') ? 1_500 : false,
  });
  const refreshedQualityRun = useRef<string | null>(null);
  useEffect(() => {
    const run = qualityRun.data;
    if (
      run &&
      ['passed', 'failed', 'stale'].includes(run.status) &&
      refreshedQualityRun.current !== `${run.quality_run_id}:${run.status}`
    ) {
      refreshedQualityRun.current = `${run.quality_run_id}:${run.status}`;
      void refresh();
    }
  }, [qualityRun.data, refresh]);
  const quality = useMutation({
    mutationFn: () =>
      runDataQueryQualityFn({
        data: {
          domainKey: version.domain_key,
          versionKey: version.version_key,
          expectedRevision: version.revision,
          reason,
        },
      }),
    onSuccess: async () => {
      notifySuccess(localize('com_data_query_editor_quality_run_queued_8b384e'));
      setReason('');
      await qualityRun.refetch();
      await refresh();
    },
    onError: (e: Error) => notifyError(e.message),
  });
  const publish = useMutation({
    mutationFn: () =>
      publishDataQueryVersionFn({
        data: {
          domainKey: version.domain_key,
          versionKey: version.version_key,
          expectedRevision: version.revision,
          reason,
        },
      }),
    onSuccess: async () => {
      notifySuccess(localize('com_data_query_editor_version_published_016929'));
      setReason('');
      await refresh();
    },
    onError: (e: Error) => notifyError(e.message),
  });
  const rollback = useMutation({
    mutationFn: () =>
      rollbackDataQueryVersionFn({
        data: {
          domainKey: version.domain_key,
          versionKey: version.version_key,
          expectedRevision: version.revision,
          reason,
        },
      }),
    onSuccess: async () => {
      notifySuccess(localize('com_data_query_editor_version_rolled_back_1be612'));
      setReason('');
      await refresh();
    },
    onError: (e: Error) => notifyError(e.message),
  });
  return (
    <div className="flex flex-col gap-4">
      <Section
        title={localize('com_data_query_editor_review_and_publish_b15256')}
        description={localize(
          'com_data_query_editor_review_structured_assets_schema_compatibility_qu_1537a6',
        )}
      >
        <div className="grid gap-3 md:grid-cols-4">
          <Summary label={localize('com_data_query_editor_schema_07b091')}>
            {draft.tables.length} {localize('com_data_query_editor_tables_b514a5')}
            {draft.tables.reduce((n, t) => n + t.columns.length, 0)}{' '}
            {localize('com_data_query_editor_fields_bfe5d6')}
          </Summary>
          <Summary label={localize('com_data_query_editor_semantics_206d71')}>
            {draft.metrics.length} {localize('com_data_query_editor_metrics_781813')}
            {draft.relationships.length} {localize('com_data_query_editor_relationships_834686')}
          </Summary>
          <Summary label={localize('com_data_query_editor_governance_86f8a6')}>
            {draft.sql_rules.length} {localize('com_data_query_editor_rules_a12cf5')}
            {draft.access_policies.length} {localize('com_data_query_editor_policies_5b3a02')}
          </Summary>
          <Summary label={localize('com_data_query_editor_quality_1b2c08')}>
            {version.quality_status}
          </Summary>
        </div>
        {version.quality_blocking_codes.length > 0 && (
          <div className="mt-4 rounded border border-(--cui-color-stroke-danger) p-3">
            <strong>{localize('com_data_query_editor_blocking_f778a3')}</strong>
            <ul className="mt-2 list-disc pl-5 text-sm">
              {version.quality_blocking_codes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
          </div>
        )}
        {qualityRun.data && (
          <div className="mt-4 rounded border border-(--cui-color-stroke-default) p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <strong>
                {localize('com_data_query_editor_latest_quality_run_revision_690d0b')}
                {qualityRun.data.revision}
              </strong>
              <span className="text-sm">{qualityRun.data.status}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded bg-(--cui-color-background-secondary)">
              <div
                className="h-full bg-(--cui-color-accent-default) transition-all"
                style={{
                  width: `${qualityRun.data.progress_total ? Math.round((qualityRun.data.progress_current / qualityRun.data.progress_total) * 100) : 0}%`,
                }}
              />
            </div>
            <p className="mt-1 text-xs text-(--cui-color-text-muted)">
              {qualityRun.data.progress_current} / {qualityRun.data.progress_total}{' '}
              {localize('com_data_query_editor_checks_961f78')}
              {qualityRun.data.status === 'stale'
                ? localize('com_data_query_editor__the_draft_changed_run_quality_again_c9fb38')
                : ''}
            </p>
            {qualityRun.data.checks.length > 0 && (
              <ul className="mt-3 grid gap-2 md:grid-cols-2">
                {qualityRun.data.checks.map((check) => (
                  <li
                    key={check.check_key}
                    className="rounded bg-(--cui-color-background-secondary) px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{check.check_key}</span>
                    <span className="float-right">{check.status}</span>
                    {check.stable_code && (
                      <p className="mt-1 text-xs text-(--cui-color-text-muted)">
                        {check.stable_code}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Summary label={localize('com_data_query_editor_version_replaced_on_publish_79edcf')}>
            {domain?.published_version ?? 'None'}
          </Summary>
          <Summary label={localize('com_data_query_editor_affected_active_grants_06889b')}>
            {activeGrantCount}
          </Summary>
          <Summary label={localize('com_data_query_editor_cache_invalidation_e252ca')}>
            {localize(
              'com_data_query_editor_domain_authorization_and_runtime_configuration_3d7e14',
            )}
          </Summary>
        </div>
        <div className="mt-4 rounded bg-(--cui-color-background-secondary) p-3 text-sm">
          <strong>{localize('com_data_query_editor_runtime_compilation_preview_5169a9')}</strong>
          <p className="mt-1 text-(--cui-color-text-muted)">
            {localize(
              'com_data_query_editor_this_version_contains_a_complete_structured_draf_66d773',
            )}
          </p>
        </div>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            to="/data-query/sources/$sourceKey"
            params={{ sourceKey: draft.source_key }}
            className="text-sm underline"
          >
            {localize('com_data_query_editor_create_snapshot_inspect_schema_diff_af6281')}
          </Link>
        </div>
      </Section>
      <Section
        title={localize('com_data_query_editor_lifecycle_action_d7c6ff')}
        description={localize(
          'com_data_query_editor_quality_checks_run_asynchronously_and_recover_af_775967',
        )}
      >
        <Field label={localize('com_data_query_editor_required_audit_reason_aa583a')}>
          <textarea
            className={`${fieldClass} min-h-24`}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
          />
        </Field>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button
            type="secondary"
            label={localize('com_data_query_editor_run_quality_checks_c08a23')}
            disabled={
              dirty ||
              !reason.trim() ||
              !['draft', 'ready'].includes(version.status) ||
              quality.isPending ||
              ['queued', 'running'].includes(qualityRun.data?.status ?? '')
            }
            onClick={() => quality.mutate()}
          />
          <Button
            type="primary"
            label={localize('com_data_query_editor_publish_859390')}
            disabled={
              dirty ||
              !reason.trim() ||
              version.status !== 'ready' ||
              version.quality_status !== 'passed' ||
              publish.isPending
            }
            onClick={() => publish.mutate()}
          />
          {version.status === 'retired' && (
            <Button
              type="secondary"
              label={localize('com_data_query_editor_rollback_to_this_version_284d02')}
              disabled={!reason.trim() || rollback.isPending}
              onClick={() => rollback.mutate()}
            />
          )}
        </div>
        {dirty && (
          <p className="mt-2 text-sm text-(--cui-color-text-warning)">
            {localize(
              'com_data_query_editor_save_all_changes_before_running_quality_or_publi_de5363',
            )}
          </p>
        )}
      </Section>
    </div>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <dl className="rounded bg-(--cui-color-background-secondary) p-3">
      <dt className="text-xs text-(--cui-color-text-muted)">{label}</dt>
      <dd className="mt-1 text-sm font-medium">{children}</dd>
    </dl>
  );
}
