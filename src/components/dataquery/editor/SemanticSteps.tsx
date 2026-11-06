import { useState } from 'react';
import type { DraftUpdater } from './editorUtils';
import type * as t from '@/types';
import { Empty, Field, MultiSelect, RemoveButton, Section, fieldClass } from './EditorFields';
import { columnsFor, refLabel, terminologyMatches } from './editorUtils';
import { useLocalize } from '@/hooks/useLocalize';

interface StepProps {
  draft: t.DataQueryDomainDraft;
  readOnly: boolean;
  update: DraftUpdater;
}
const tableOptions = (draft: t.DataQueryDomainDraft) =>
  draft.tables.map((table) => ({
    value: table.object_ref.object_id,
    label: table.display_name || table.object_ref.table_name,
  }));
const columnOptions = (draft: t.DataQueryDomainDraft, tableId: string) =>
  columnsFor(draft, tableId).map((column) => ({
    value: column.object_ref.object_id,
    label: column.object_ref.column_name ?? column.object_ref.object_id,
  }));
const newKey = (prefix: string, length: number) => `${prefix}_${length + 1}`;

export function TerminologyStep({ draft, readOnly, update }: StepProps) {
  const localize = useLocalize();
  const [question, setQuestion] = useState('');
  const matches = terminologyMatches(draft.terminology, question);
  return (
    <Section
      title={localize('com_data_query_editor_terminology_9615bd')}
      description={localize(
        'com_data_query_editor_map_canonical_business_terms_to_aliases_and_test_0e36eb',
      )}
      action={
        <button
          type="button"
          disabled={readOnly}
          className="text-sm underline disabled:opacity-50"
          onClick={() =>
            update((d) => {
              let key = newKey('term', Object.keys(d.terminology).length);
              while (d.terminology[key]) key += '_new';
              d.terminology[key] = [];
            })
          }
        >
          {localize('com_data_query_editor_add_term_6cf5c9')}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {Object.entries(draft.terminology).map(([term, aliases]) => (
          <div key={term} className="grid gap-3 rounded-md border p-3 md:grid-cols-[1fr_2fr_auto]">
            <Field label={localize('com_data_query_editor_canonical_term_0569e4')}>
              <input
                disabled={readOnly}
                className={fieldClass}
                value={term}
                onChange={(e) =>
                  update((d) => {
                    const value = d.terminology[term];
                    delete d.terminology[term];
                    d.terminology[e.target.value] = value;
                  })
                }
              />
            </Field>
            <Field label={localize('com_data_query_editor_aliases_comma_separated_732ccf')}>
              <input
                disabled={readOnly}
                className={fieldClass}
                value={aliases.join(', ')}
                onChange={(e) =>
                  update((d) => {
                    d.terminology[term] = e.target.value
                      .split(',')
                      .map((v) => v.trim())
                      .filter(Boolean);
                  })
                }
              />
            </Field>
            <RemoveButton
              disabled={readOnly}
              onClick={() =>
                update((d) => {
                  delete d.terminology[term];
                })
              }
            />
          </div>
        ))}
        {!Object.keys(draft.terminology).length && (
          <Empty>{localize('com_data_query_editor_no_terminology_configured_ab6c93')}</Empty>
        )}
      </div>
      <div className="mt-5 border-t pt-4">
        <Field label={localize('com_data_query_editor_test_matching_e676ad')}>
          <input
            className={fieldClass}
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder={localize('com_data_query_editor_enter_a_natural_language_question_bd9984')}
          />
        </Field>
        {question && (
          <p className="mt-2 text-sm">
            {localize('com_data_query_editor_evidence_e56d51')}{' '}
            {matches.length
              ? matches.map((m) => `${m.evidence} → ${m.term}`).join(', ')
              : 'No match'}
          </p>
        )}
      </div>
    </Section>
  );
}

export function MetricsStep({ draft, readOnly, update }: StepProps) {
  const localize = useLocalize();
  const add = () =>
    update((d) => {
      const table = d.tables[0];
      if (!table) return;
      d.metrics.push({
        metric_type: 'configured',
        metric_key: newKey('metric', d.metrics.length),
        name: 'New metric',
        description: null,
        metric_spec: {
          table: table.object_ref,
          time_column: table.time_column,
          value_column: table.columns[0]?.object_ref ?? null,
          aggregation: 'count',
          dimensions: [],
          allowed_filters: [],
          unit: 'count',
          display_format: '0',
          max_time_range_hours: 24,
        },
        enabled: true,
      });
    });
  return (
    <Section
      title={localize('com_data_query_editor_metrics_a58da7')}
      description={localize(
        'com_data_query_editor_configured_metrics_generate_bounded_plans_raw_sq_f9323c',
      )}
      action={
        <button
          type="button"
          disabled={readOnly || !draft.tables.length}
          className="text-sm underline disabled:opacity-50"
          onClick={add}
        >
          {localize('com_data_query_editor_add_metric_5f5bf0')}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {draft.metrics.map((metric, index) => {
          const spec = metric.metric_spec;
          const columns = columnOptions(draft, spec.table.object_id);
          return (
            <div key={`${metric.metric_key}-${index}`} className="rounded-md border p-4">
              <div className="flex justify-between">
                <strong>{metric.name}</strong>
                <RemoveButton
                  disabled={readOnly}
                  onClick={() =>
                    update((d) => {
                      d.metrics.splice(index, 1);
                    })
                  }
                />
              </div>
              <div className="mt-3 grid gap-3 md:grid-cols-3">
                <Field label={localize('com_data_query_editor_metric_key_a7f1b3')}>
                  <input
                    disabled={readOnly}
                    className={fieldClass}
                    value={metric.metric_key}
                    onChange={(e) =>
                      update((d) => {
                        d.metrics[index].metric_key = e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label={localize('com_data_query_editor_name_dcd1d5')}>
                  <input
                    disabled={readOnly}
                    className={fieldClass}
                    value={metric.name}
                    onChange={(e) =>
                      update((d) => {
                        d.metrics[index].name = e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label={localize('com_data_query_editor_table_16d1c9')}>
                  <select
                    disabled={readOnly}
                    className={fieldClass}
                    value={spec.table.object_id}
                    onChange={(e) =>
                      update((d) => {
                        const table = d.tables.find(
                          (v) => v.object_ref.object_id === e.target.value,
                        )!;
                        const m = d.metrics[index];
                        m.metric_spec.table = table.object_ref;
                        m.metric_spec.time_column = table.time_column;
                        m.metric_spec.value_column = table.columns[0]?.object_ref ?? null;
                        m.metric_spec.dimensions = [];
                        m.metric_spec.allowed_filters = [];
                      })
                    }
                  >
                    {tableOptions(draft).map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={localize('com_data_query_editor_aggregation_749cfa')}>
                  <select
                    disabled={readOnly}
                    className={fieldClass}
                    value={spec.aggregation}
                    onChange={(e) =>
                      update((d) => {
                        d.metrics[index].metric_spec.aggregation = e.target
                          .value as typeof spec.aggregation;
                      })
                    }
                  >
                    {['sum', 'avg', 'min', 'max', 'count', 'latest'].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label={localize('com_data_query_editor_value_field_ca4e5a')}>
                  <select
                    disabled={readOnly}
                    className={fieldClass}
                    value={spec.value_column?.object_id ?? ''}
                    onChange={(e) =>
                      update((d) => {
                        d.metrics[index].metric_spec.value_column =
                          columnsFor(d, d.metrics[index].metric_spec.table.object_id).find(
                            (c) => c.object_ref.object_id === e.target.value,
                          )?.object_ref ?? null;
                      })
                    }
                  >
                    <option value="">{localize('com_data_query_editor_none_dc937b')}</option>
                    {columns.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={localize('com_data_query_editor_time_field_4e1ee7')}>
                  <select
                    disabled={readOnly}
                    className={fieldClass}
                    value={spec.time_column?.object_id ?? ''}
                    onChange={(e) =>
                      update((d) => {
                        d.metrics[index].metric_spec.time_column =
                          columnsFor(d, d.metrics[index].metric_spec.table.object_id).find(
                            (c) => c.object_ref.object_id === e.target.value,
                          )?.object_ref ?? null;
                      })
                    }
                  >
                    <option value="">{localize('com_data_query_editor_none_dc937b')}</option>
                    {columns.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={localize('com_data_query_editor_dimensions_914182')}>
                  <MultiSelect
                    disabled={readOnly}
                    values={spec.dimensions.map((r) => r.object_id)}
                    options={columns}
                    onChange={(ids) =>
                      update((d) => {
                        const cs = columnsFor(d, d.metrics[index].metric_spec.table.object_id);
                        d.metrics[index].metric_spec.dimensions = ids.map(
                          (id) => cs.find((c) => c.object_ref.object_id === id)!.object_ref,
                        );
                      })
                    }
                  />
                </Field>
                <Field label={localize('com_data_query_editor_allowed_filters_8d5f4d')}>
                  <MultiSelect
                    disabled={readOnly}
                    values={spec.allowed_filters.map((r) => r.object_id)}
                    options={columns}
                    onChange={(ids) =>
                      update((d) => {
                        const cs = columnsFor(d, d.metrics[index].metric_spec.table.object_id);
                        d.metrics[index].metric_spec.allowed_filters = ids.map(
                          (id) => cs.find((c) => c.object_ref.object_id === id)!.object_ref,
                        );
                      })
                    }
                  />
                </Field>
                <div className="grid gap-2">
                  <Field label={localize('com_data_query_editor_unit_4e5459')}>
                    <input
                      disabled={readOnly}
                      className={fieldClass}
                      value={spec.unit}
                      onChange={(e) =>
                        update((d) => {
                          d.metrics[index].metric_spec.unit = e.target.value;
                        })
                      }
                    />
                  </Field>
                  <Field label={localize('com_data_query_editor_max_range_hours_d2254a')}>
                    <input
                      type="number"
                      min={1}
                      disabled={readOnly}
                      className={fieldClass}
                      value={spec.max_time_range_hours}
                      onChange={(e) =>
                        update((d) => {
                          d.metrics[index].metric_spec.max_time_range_hours = Number(
                            e.target.value,
                          );
                        })
                      }
                    />
                  </Field>
                </div>
                <Field label={localize('com_data_query_editor_display_format_b960a8')}>
                  <input
                    disabled={readOnly}
                    className={fieldClass}
                    value={spec.display_format}
                    onChange={(event) =>
                      update((next) => {
                        next.metrics[index].metric_spec.display_format = event.target.value;
                      })
                    }
                  />
                </Field>
                <Field label={localize('com_data_query_editor_description_526e00')}>
                  <input
                    disabled={readOnly}
                    className={fieldClass}
                    value={metric.description ?? ''}
                    onChange={(event) =>
                      update((next) => {
                        next.metrics[index].description = event.target.value || null;
                      })
                    }
                  />
                </Field>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    disabled={readOnly}
                    checked={metric.enabled}
                    onChange={(event) =>
                      update((next) => {
                        next.metrics[index].enabled = event.target.checked;
                      })
                    }
                  />
                  {localize('com_data_query_editor_enabled_92c1cd')}
                </label>
              </div>
              <details className="mt-3 text-sm">
                <summary className="cursor-pointer underline">
                  {localize('com_data_query_editor_plan_preview_90d561')}
                </summary>
                <p className="mt-2 rounded bg-(--cui-color-background-secondary) p-3">
                  {localize('com_data_query_editor_aggregate_3c9193')}
                  {spec.aggregation}({spec.value_column ? refLabel(spec.value_column) : '*'}
                  {localize('com_data_query_editor__from_39f9e9')} {refLabel(spec.table)}
                  {localize(
                    'com_data_query_editor__limit_and_time_range_are_enforced_by_policy_2edc1b',
                  )}
                </p>
              </details>
            </div>
          );
        })}
        {!draft.metrics.length && (
          <Empty>{localize('com_data_query_editor_no_metrics_configured_3721d1')}</Empty>
        )}
      </div>
    </Section>
  );
}

export function RelationshipsStep({ draft, readOnly, update }: StepProps) {
  const localize = useLocalize();
  const pairs = draft.relationships.map(
    (relationship) => `${relationship.left_table.object_id}:${relationship.right_table.object_id}`,
  );
  const duplicatePairs = [...new Set(pairs.filter((pair, index) => pairs.indexOf(pair) !== index))];
  const selfJoins = draft.relationships.filter(
    (relationship) => relationship.left_table.object_id === relationship.right_table.object_id,
  );
  const add = () =>
    update((d) => {
      if (d.tables.length < 2) return;
      const left = d.tables[0],
        right = d.tables[1];
      d.relationships.push({
        relationship_key: newKey('relationship', d.relationships.length),
        left_table: left.object_ref,
        left_column: left.columns[0].object_ref,
        right_table: right.object_ref,
        right_column: right.columns[0].object_ref,
        join_type: 'inner',
        description: null,
      });
    });
  return (
    <Section
      title={localize('com_data_query_editor_relationships_85752a')}
      description={localize(
        'com_data_query_editor_only_snapshot_fields_may_participate_in_inner_or_df46f8',
      )}
      action={
        <button
          type="button"
          disabled={readOnly || draft.tables.length < 2}
          className="text-sm underline disabled:opacity-50"
          onClick={add}
        >
          {localize('com_data_query_editor_add_relationship_700eb6')}
        </button>
      }
    >
      {(duplicatePairs.length > 0 || selfJoins.length > 0) && (
        <div className="mb-3 rounded border border-(--cui-color-stroke-warning) p-3 text-sm">
          {localize('com_data_query_editor_relationship_ambiguity_warning_82d624')}
          {duplicatePairs.length} {localize('com_data_query_editor_duplicate_table_pair_s_66ed0a')}{' '}
          {selfJoins.length}{' '}
          {localize(
            'com_data_query_editor_self_join_s_review_direction_and_join_keys_befor_cfbeb8',
          )}
        </div>
      )}
      <div className="flex flex-col gap-3">
        {draft.relationships.map((rel, index) => (
          <div
            key={`${rel.relationship_key}-${index}`}
            className="grid gap-3 rounded border p-4 md:grid-cols-3"
          >
            <Field label={localize('com_data_query_editor_key_99a52d')}>
              <input
                disabled={readOnly}
                className={fieldClass}
                value={rel.relationship_key}
                onChange={(e) =>
                  update((d) => {
                    d.relationships[index].relationship_key = e.target.value;
                  })
                }
              />
            </Field>
            <RelationSide
              label={localize('com_data_query_editor_left_58eb90')}
              tableId={rel.left_table.object_id}
              columnId={rel.left_column.object_id}
              draft={draft}
              readOnly={readOnly}
              onChange={(tableId, columnId) =>
                update((d) => {
                  const table = d.tables.find((v) => v.object_ref.object_id === tableId)!;
                  const item = d.relationships[index];
                  item.left_table = table.object_ref;
                  item.left_column =
                    table.columns.find((c) => c.object_ref.object_id === columnId)?.object_ref ??
                    table.columns[0].object_ref;
                })
              }
            />
            <RelationSide
              label={localize('com_data_query_editor_right_883361')}
              tableId={rel.right_table.object_id}
              columnId={rel.right_column.object_id}
              draft={draft}
              readOnly={readOnly}
              onChange={(tableId, columnId) =>
                update((d) => {
                  const table = d.tables.find((v) => v.object_ref.object_id === tableId)!;
                  const item = d.relationships[index];
                  item.right_table = table.object_ref;
                  item.right_column =
                    table.columns.find((c) => c.object_ref.object_id === columnId)?.object_ref ??
                    table.columns[0].object_ref;
                })
              }
            />
            <Field label={localize('com_data_query_editor_join_type_c59bf5')}>
              <select
                disabled={readOnly}
                className={fieldClass}
                value={rel.join_type}
                onChange={(e) =>
                  update((d) => {
                    d.relationships[index].join_type = e.target.value as 'inner' | 'left';
                  })
                }
              >
                <option value="inner">{localize('com_data_query_editor_inner_33bf6f')}</option>
                <option value="left">{localize('com_data_query_editor_left_360f84')}</option>
              </select>
            </Field>
            <Field label={localize('com_data_query_editor_description_526e00')}>
              <input
                disabled={readOnly}
                className={fieldClass}
                value={rel.description ?? ''}
                onChange={(e) =>
                  update((d) => {
                    d.relationships[index].description = e.target.value || null;
                  })
                }
              />
            </Field>
            <RemoveButton
              disabled={readOnly}
              onClick={() =>
                update((d) => {
                  d.relationships.splice(index, 1);
                })
              }
            />
          </div>
        ))}
        {!draft.relationships.length && (
          <Empty>
            {localize(
              'com_data_query_editor_no_relationships_configured_at_least_two_tables_122d1c',
            )}
          </Empty>
        )}
      </div>
    </Section>
  );
}

function RelationSide({
  label,
  tableId,
  columnId,
  draft,
  readOnly,
  onChange,
}: {
  label: string;
  tableId: string;
  columnId: string;
  draft: t.DataQueryDomainDraft;
  readOnly: boolean;
  onChange: (tableId: string, columnId: string) => void;
}) {
  const cols = columnOptions(draft, tableId);
  return (
    <div className="grid gap-2">
      <Field label={`${label} table`}>
        <select
          disabled={readOnly}
          className={fieldClass}
          value={tableId}
          onChange={(e) =>
            onChange(e.target.value, columnOptions(draft, e.target.value)[0]?.value ?? '')
          }
        >
          {tableOptions(draft).map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label={`${label} field`}>
        <select
          disabled={readOnly}
          className={fieldClass}
          value={columnId}
          onChange={(e) => onChange(tableId, e.target.value)}
        >
          {cols.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </Field>
    </div>
  );
}

export function PatternsStep({ draft, readOnly, update }: StepProps) {
  const localize = useLocalize();
  const [type, setType] =
    useState<t.DataQueryDomainDraft['query_patterns'][number]['pattern_type']>('table_selection');
  const add = () =>
    update((d) => {
      const table = d.tables[0];
      if (!table) return;
      const key = newKey('pattern', d.query_patterns.length);
      if (type === 'table_selection')
        d.query_patterns.push({
          pattern_key: key,
          pattern_type: type,
          pattern_config: {
            aliases: [table.object_ref.table_name],
            report_table: table.object_ref.table_name,
            element_table: null,
            time_column: table.time_column?.column_name ?? table.columns[0].object_ref.column_name!,
          },
          enabled: true,
        });
      else if (type === 'entity_normalization')
        d.query_patterns.push({
          pattern_key: key,
          pattern_type: type,
          pattern_config: {
            entity: 'entity',
            format: 'canonical',
            lookup_table: table.object_ref.table_name,
            lookup_column: table.columns[0].object_ref.column_name!,
          },
          enabled: true,
        });
      else if (type === 'pivot')
        d.query_patterns.push({
          pattern_key: key,
          pattern_type: type,
          pattern_config: {
            detail_tables: [table.object_ref.table_name],
            pivot_columns: [table.columns[0].object_ref.column_name!],
            value_column: table.columns[0].object_ref.column_name!,
            group_by: [table.columns[0].object_ref.column_name!],
          },
          enabled: true,
        });
      else
        d.query_patterns.push({
          pattern_key: key,
          pattern_type: type,
          pattern_config: {
            default_period: '24h',
            report_table: table.object_ref.table_name,
            element_table: null,
          },
          enabled: true,
        });
    });
  return (
    <Section
      title={localize('com_data_query_editor_query_patterns_4a2284')}
      description={localize(
        'com_data_query_editor_each_supported_pattern_has_a_structured_contract_3efe68',
      )}
      action={
        <div className="flex gap-2">
          <select
            disabled={readOnly}
            className={fieldClass}
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            {['table_selection', 'entity_normalization', 'pivot', 'default_constraint'].map((v) => (
              <option key={v}>{v}</option>
            ))}
          </select>
          <button
            type="button"
            disabled={readOnly || !draft.tables.length}
            className="text-sm underline"
            onClick={add}
          >
            {localize('com_data_query_editor_add_9fd728')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {draft.query_patterns.map((pattern, index) => (
          <PatternCard
            key={`${pattern.pattern_key}-${index}`}
            pattern={pattern}
            readOnly={readOnly}
            onChange={(key, value) =>
              update((d) => {
                const p = d.query_patterns[index] as unknown as {
                  pattern_key: string;
                  enabled: boolean;
                  pattern_config: Record<string, unknown>;
                };
                if (key === 'pattern_key') p.pattern_key = String(value);
                else if (key === 'enabled') p.enabled = Boolean(value);
                else p.pattern_config[key] = value;
              })
            }
            onRemove={() =>
              update((d) => {
                d.query_patterns.splice(index, 1);
              })
            }
          />
        ))}
        {!draft.query_patterns.length && (
          <Empty>{localize('com_data_query_editor_no_query_patterns_configured_a96f40')}</Empty>
        )}
      </div>
    </Section>
  );
}

function PatternCard({
  pattern,
  readOnly,
  onChange,
  onRemove,
}: {
  pattern: t.DataQueryDomainDraft['query_patterns'][number];
  readOnly: boolean;
  onChange: (key: string, value: unknown) => void;
  onRemove: () => void;
}) {
  const localize = useLocalize();
  const config = pattern.pattern_config as unknown as Record<string, unknown>;
  return (
    <div className="rounded border p-4">
      <div className="flex justify-between">
        <strong>{pattern.pattern_type}</strong>
        <RemoveButton disabled={readOnly} onClick={onRemove} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-3">
        <Field label={localize('com_data_query_editor_pattern_key_ab6915')}>
          <input
            disabled={readOnly}
            className={fieldClass}
            value={pattern.pattern_key}
            onChange={(e) => onChange('pattern_key', e.target.value)}
          />
        </Field>
        {Object.entries(config).map(([key, value]) => (
          <Field key={key} label={key.replaceAll('_', ' ')}>
            <input
              disabled={readOnly}
              className={fieldClass}
              value={Array.isArray(value) ? value.join(', ') : String(value ?? '')}
              onChange={(e) =>
                onChange(
                  key,
                  Array.isArray(value)
                    ? e.target.value
                        .split(',')
                        .map((v) => v.trim())
                        .filter(Boolean)
                    : e.target.value || null,
                )
              }
            />
          </Field>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            disabled={readOnly}
            checked={pattern.enabled}
            onChange={(e) => onChange('enabled', e.target.checked)}
          />{' '}
          {localize('com_data_query_editor_enabled_92c1cd')}
        </label>
      </div>
    </div>
  );
}
