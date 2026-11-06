import { Button, Switch } from '@clickhouse/click-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useMemo, useState } from 'react';
import type * as t from '@/types';
import { LoadingState } from '@/components/shared';
import {
  createDataQueryFullDomainDraftFn,
  dataQueryDomainsOptions,
  dataQuerySourcesOptions,
} from '@/server';
import { useLocalize } from '@/hooks';
import { notifyError, notifySuccess } from '@/utils';
import { SchemaDiscoveryPanel, type SnapshotSelection } from '../discovery';
import {
  buildDomainDraft,
  domainDraftCreateInput,
  initialTableMetadata,
  loadDomainSelection,
  selectedSnapshotTables,
  validateDomainSelection,
  type DomainBasics,
  type StoredDomainSelection,
  type TableMetadataById,
} from './domainDraft';

type WizardStep = 'source' | 'schema' | 'details' | 'review';
const inputClass =
  'rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm';

const initialBasics: DomainBasics = {
  domainKey: '',
  displayName: '',
  description: '',
  versionKey: 'v1',
  defaultLimit: 100,
  maxLimit: 1000,
  routingKeywords: [],
};

export function DomainCreatePage({ selectionToken }: { selectionToken?: string }) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const sources = useQuery(dataQuerySourcesOptions);
  const domains = useQuery(dataQueryDomainsOptions);
  const [step, setStep] = useState<WizardStep>('source');
  const [sourceKey, setSourceKey] = useState('');
  const [selection, setSelection] = useState<StoredDomainSelection | null>(null);
  const [basics, setBasics] = useState<DomainBasics>(initialBasics);
  const [keywordText, setKeywordText] = useState('');
  const [reason, setReason] = useState('');
  const [metadata, setMetadata] = useState<TableMetadataById>({});

  useEffect(() => {
    const restored = loadDomainSelection(selectionToken);
    if (!restored) return;
    setSelection(restored);
    setSourceKey(restored.snapshot.source_key);
    setMetadata(initialTableMetadata(restored));
    setStep('details');
  }, [selectionToken]);

  const eligibleSources = useMemo(
    () =>
      (sources.data ?? []).filter(
        (source) =>
          source.enabled &&
          source.secret_configured &&
          source.last_connection_status === 'passed',
      ),
    [sources.data],
  );
  const source = (sources.data ?? []).find((item) => item.source_key === sourceKey) ?? null;
  const selectedTables = selection ? selectedSnapshotTables(selection) : [];
  const selectionErrors = selection ? validateDomainSelection(selection) : ['no_selection'];
  const existingDomain = (domains.data ?? []).some(
    (domain) => domain.domain_key === basics.domainKey,
  );
  const basicsValid =
    /^[a-z][a-z0-9_]{1,119}$/.test(basics.domainKey) &&
    /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(basics.versionKey) &&
    basics.displayName.trim().length > 0 &&
    basics.defaultLimit >= 1 &&
    basics.maxLimit <= 10_000 &&
    basics.defaultLimit <= basics.maxLimit &&
    !existingDomain;

  const acceptSelection = (value: SnapshotSelection) => {
    const stored: StoredDomainSelection = {
      snapshot: value.snapshot,
      selectedObjectIds: value.selectedObjectIds,
    };
    setSelection(stored);
    setMetadata(initialTableMetadata(stored));
    setStep('details');
  };
  const mutation = useMutation({
    mutationFn: async () => {
      if (!source || !selection) throw new Error('domain_selection_missing');
      const draft = buildDomainDraft(
        source,
        selection,
        { ...basics, routingKeywords: parseKeywords(keywordText) },
        metadata,
      );
      return createDataQueryFullDomainDraftFn({
        data: domainDraftCreateInput(draft, selection.snapshot, reason),
      });
    },
    onSuccess: async (version) => {
      await queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'domains'] });
      notifySuccess(localize('com_data_query_draft_created'));
      navigate({
        to: '/data-query/domains/$domainKey/versions/$versionKey',
        params: { domainKey: basics.domainKey, versionKey: version.version_key },
      });
    },
    onError: (error: Error) => notifyError(error.message),
  });

  if (sources.isLoading || domains.isLoading) return <LoadingState />;

  return (
    <div className="flex flex-col gap-5 p-6">
      <Link
        to="/data-query/domains"
        className="w-fit text-sm text-(--cui-color-text-muted) underline"
      >
        {localize('com_data_query_back_to_domains')}
      </Link>
      <header>
        <h2 className="text-xl font-semibold text-(--cui-color-title-default)">
          {localize('com_data_query_create_domain')}
        </h2>
        <p className="mt-1 text-sm text-(--cui-color-text-muted)">
          {localize('com_data_query_create_domain_wizard_hint')}
        </p>
      </header>
      <WizardProgress step={step} />

      {step === 'source' && (
        <section className="flex max-w-3xl flex-col gap-4 rounded-lg border border-(--cui-color-stroke-default) p-5">
          <h3 className="font-semibold">{localize('com_data_query_choose_source')}</h3>
          <p className="text-sm text-(--cui-color-text-muted)">
            {localize('com_data_query_domain_source_requirements')}
          </p>
          <select
            value={sourceKey}
            onChange={(event) => setSourceKey(event.target.value)}
            className={inputClass}
          >
            <option value="">{localize('com_data_query_select_source')}</option>
            {eligibleSources.map((item) => (
              <option key={item.source_key} value={item.source_key}>
                {item.name} · {item.source_type}
              </option>
            ))}
          </select>
          {eligibleSources.length === 0 && (
            <p role="alert" className="text-sm text-(--cui-color-text-danger)">
              {localize('com_data_query_no_eligible_domain_source')}
            </p>
          )}
          <div>
            <Button
              type="primary"
              label={localize('com_ui_continue')}
              disabled={!sourceKey}
              onClick={() => setStep('schema')}
            />
          </div>
        </section>
      )}

      {step === 'schema' && source && (
        <section className="flex flex-col gap-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <h3 className="font-semibold">{localize('com_data_query_choose_schema_objects')}</h3>
              <p className="text-sm text-(--cui-color-text-muted)">{source.name}</p>
            </div>
            <Button
              type="secondary"
              label={localize('com_ui_back')}
              onClick={() => setStep('source')}
            />
          </div>
          <SchemaDiscoveryPanel
            source={source}
            domains={(domains.data ?? []).filter(
              (domain) => domain.source_key === source.source_key,
            )}
            onCreateDomain={acceptSelection}
          />
        </section>
      )}

      {step === 'details' && selection && (
        <section className="flex flex-col gap-5">
          <DomainBasicsForm
            basics={basics}
            keywordText={keywordText}
            existingDomain={existingDomain}
            onChange={setBasics}
            onKeywordChange={setKeywordText}
          />
          <TableMetadataForm
            selection={selection}
            metadata={metadata}
            onChange={setMetadata}
          />
          {selectionErrors.length > 0 && (
            <div
              role="alert"
              className="rounded-md border border-(--cui-color-stroke-danger) p-3 text-sm text-(--cui-color-text-danger)"
            >
              {localize('com_data_query_invalid_schema_selection')}: {selectionErrors.join(', ')}
            </div>
          )}
          <div className="flex gap-2">
            <Button
              type="secondary"
              label={localize('com_ui_back')}
              onClick={() => setStep('schema')}
            />
            <Button
              type="primary"
              label={localize('com_ui_continue')}
              disabled={!basicsValid || selectionErrors.length > 0}
              onClick={() => setStep('review')}
            />
          </div>
        </section>
      )}

      {step === 'review' && selection && source && (
        <section className="flex max-w-4xl flex-col gap-5">
          <div className="rounded-lg border border-(--cui-color-stroke-default) p-5">
            <h3 className="font-semibold">{localize('com_data_query_review_domain')}</h3>
            <dl className="mt-4 grid gap-4 text-sm md:grid-cols-2">
              <Summary label={localize('com_data_query_domain')}>
                {basics.displayName} ({basics.domainKey})
              </Summary>
              <Summary label={localize('com_data_query_source')}>{source.name}</Summary>
              <Summary label={localize('com_data_query_version')}>
                {basics.versionKey}
              </Summary>
              <Summary label={localize('com_data_query_schema_snapshot')}>
                {selection.snapshot.snapshot_id}
              </Summary>
              <Summary label={localize('com_data_query_tables')}>
                {String(selectedTables.length)}
              </Summary>
              <Summary label={localize('com_data_query_limits')}>
                {basics.defaultLimit} / {basics.maxLimit}
              </Summary>
            </dl>
            <p className="mt-4 text-sm text-(--cui-color-text-muted)">
              {localize('com_data_query_semantics_configured_later')}
            </p>
            <label className="mt-4 flex flex-col gap-1.5 text-sm font-medium">
              {localize('com_data_query_reason')}
              <textarea
                value={reason}
                onChange={(event) => setReason(event.target.value)}
                className={`${inputClass} min-h-24`}
              />
            </label>
          </div>
          <div className="flex gap-2">
            <Button
              type="secondary"
              label={localize('com_ui_back')}
              onClick={() => setStep('details')}
            />
            <Button
              type="primary"
              label={localize('com_data_query_save_initial_draft')}
              disabled={mutation.isPending || !reason.trim()}
              onClick={() => mutation.mutate()}
            />
          </div>
        </section>
      )}
    </div>
  );
}

function WizardProgress({ step }: { step: WizardStep }) {
  const localize = useLocalize();
  const steps: Array<{ key: WizardStep; label: string }> = [
    { key: 'source', label: localize('com_data_query_source') },
    { key: 'schema', label: localize('com_data_query_schema') },
    { key: 'details', label: localize('com_data_query_details') },
    { key: 'review', label: localize('com_data_query_review') },
  ];
  const active = steps.findIndex((item) => item.key === step);
  return (
    <ol className="grid max-w-4xl grid-cols-4 gap-2" aria-label="Domain creation progress">
      {steps.map((item, index) => (
        <li
          key={item.key}
          className={`rounded-md border px-3 py-2 text-center text-sm ${
            index <= active
              ? 'border-(--cui-color-accent) text-(--cui-color-text-default)'
              : 'border-(--cui-color-stroke-default) text-(--cui-color-text-muted)'
          }`}
        >
          {index + 1}. {item.label}
        </li>
      ))}
    </ol>
  );
}

function DomainBasicsForm({
  basics,
  keywordText,
  existingDomain,
  onChange,
  onKeywordChange,
}: {
  basics: DomainBasics;
  keywordText: string;
  existingDomain: boolean;
  onChange: (value: DomainBasics) => void;
  onKeywordChange: (value: string) => void;
}) {
  const localize = useLocalize();
  const set = <K extends keyof DomainBasics>(key: K, value: DomainBasics[K]) =>
    onChange({ ...basics, [key]: value });
  return (
    <section className="grid gap-4 rounded-lg border border-(--cui-color-stroke-default) p-5 md:grid-cols-2">
      <h3 className="md:col-span-2 font-semibold">
        {localize('com_data_query_domain_details')}
      </h3>
      <Field
        label={localize('com_data_query_domain_key')}
        value={basics.domainKey}
        onChange={(value) => set('domainKey', value)}
        error={existingDomain ? localize('com_data_query_domain_key_exists') : undefined}
      />
      <Field
        label={localize('com_data_query_domain_name')}
        value={basics.displayName}
        onChange={(value) => set('displayName', value)}
      />
      <Field
        label={localize('com_data_query_version')}
        value={basics.versionKey}
        onChange={(value) => set('versionKey', value)}
      />
      <Field
        label={localize('com_data_query_routing_keywords')}
        value={keywordText}
        onChange={onKeywordChange}
      />
      <NumberField
        label={localize('com_data_query_default_limit')}
        value={basics.defaultLimit}
        onChange={(value) => set('defaultLimit', value)}
      />
      <NumberField
        label={localize('com_data_query_max_limit')}
        value={basics.maxLimit}
        onChange={(value) => set('maxLimit', value)}
      />
      <label className="flex flex-col gap-1.5 text-sm font-medium md:col-span-2">
        {localize('com_data_query_description')}
        <textarea
          value={basics.description}
          onChange={(event) => set('description', event.target.value)}
          className={`${inputClass} min-h-20`}
        />
      </label>
    </section>
  );
}

function TableMetadataForm({
  selection,
  metadata,
  onChange,
}: {
  selection: StoredDomainSelection;
  metadata: TableMetadataById;
  onChange: (value: TableMetadataById) => void;
}) {
  const localize = useLocalize();
  const selected = new Set(selection.selectedObjectIds);
  const update = (tableId: string, change: Partial<TableMetadataById[string]>) =>
    onChange({ ...metadata, [tableId]: { ...metadata[tableId], ...change } });
  return (
    <section className="flex flex-col gap-4">
      <h3 className="font-semibold">{localize('com_data_query_table_metadata')}</h3>
      {selectedSnapshotTables(selection).map((table) => {
        const current = metadata[table.table.object_id];
        const columns = table.columns.filter((column) =>
          selected.has(column.object_ref.object_id),
        );
        const sensitive = new Set(current?.sensitiveColumnObjectIds ?? []);
        return (
          <article
            key={table.table.object_id}
            className="rounded-lg border border-(--cui-color-stroke-default) p-5"
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label={`${table.table.table_name} · ${localize('com_data_query_display_name')}`}
                value={current?.displayName ?? ''}
                onChange={(displayName) => update(table.table.object_id, { displayName })}
              />
              <Field
                label={localize('com_data_query_description')}
                value={current?.description ?? ''}
                onChange={(description) => update(table.table.object_id, { description })}
              />
              <ColumnSelect
                label={localize('com_data_query_time_column')}
                value={current?.timeColumnObjectId ?? ''}
                columns={columns}
                onChange={(value) =>
                  update(table.table.object_id, { timeColumnObjectId: value || null })
                }
              />
              <ColumnSelect
                label={localize('com_data_query_organization_column')}
                value={current?.organizationColumnObjectId ?? ''}
                columns={columns}
                onChange={(value) =>
                  update(table.table.object_id, { organizationColumnObjectId: value || null })
                }
              />
            </div>
            <div className="mt-4">
              <p className="mb-2 text-sm font-medium">
                {localize('com_data_query_sensitive_fields')}
              </p>
              <div className="grid gap-2 md:grid-cols-2">
                {columns.map((column) => {
                  const id = column.object_ref.object_id;
                  return (
                    <label key={id} className="flex items-center justify-between gap-3 text-sm">
                      <span>{column.object_ref.column_name}</span>
                      <Switch
                        checked={sensitive.has(id)}
                        onCheckedChange={(checked) => {
                          const next = new Set(sensitive);
                          checked ? next.add(id) : next.delete(id);
                          update(table.table.object_id, {
                            sensitiveColumnObjectIds: [...next],
                          });
                        }}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}

function ColumnSelect({
  label,
  value,
  columns,
  onChange,
}: {
  label: string;
  value: string;
  columns: t.DataQueryColumn[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}>
        <option value="">-</option>
        {columns.map((column) => (
          <option key={column.object_ref.object_id} value={column.object_ref.object_id}>
            {column.object_ref.column_name}
          </option>
        ))}
      </select>
    </label>
  );
}

function Field({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input value={value} onChange={(event) => onChange(event.target.value)} className={inputClass} />
      {error && <span className="text-xs text-(--cui-color-text-danger)">{error}</span>}
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      <input
        type="number"
        min={1}
        max={10_000}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
        className={inputClass}
      />
    </label>
  );
}

function Summary({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-(--cui-color-text-muted) uppercase">{label}</dt>
      <dd className="mt-1">{children}</dd>
    </div>
  );
}

const parseKeywords = (value: string): string[] =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
