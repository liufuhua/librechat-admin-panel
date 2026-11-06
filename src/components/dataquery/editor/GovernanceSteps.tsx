import { useState } from 'react';
import type { DraftUpdater } from './editorUtils';
import type * as t from '@/types';
import { Empty, Field, MultiSelect, RemoveButton, Section, fieldClass } from './EditorFields';
import { SHA_PATTERN, columnsFor, refLabel } from './editorUtils';
import { useLocalize } from '@/hooks/useLocalize';

interface StepProps {
  draft: t.DataQueryDomainDraft;
  readOnly: boolean;
  update: DraftUpdater;
}
const tableOptions = (d: t.DataQueryDomainDraft) =>
  d.tables.map((v) => ({
    value: v.object_ref.object_id,
    label: v.display_name || v.object_ref.table_name,
  }));
const colOptions = (d: t.DataQueryDomainDraft, id: string) =>
  columnsFor(d, id).map((v) => ({
    value: v.object_ref.object_id,
    label: v.object_ref.column_name ?? v.object_ref.object_id,
  }));
const summaryTypeAllowed = (purpose: string, dataType: string) => {
  const kind = dataType.toLowerCase().split('(')[0].trim();
  if (purpose === 'group_columns' || purpose === 'integer_filters')
    return ['tinyint','smallint','mediumint','int','integer','bigint','int2','int4','int8','uint32','uint64'].includes(kind);
  if (purpose === 'text_filters') return ['text','varchar','char','character varying','nvarchar','string'].includes(kind);
  if (purpose === 'time_columns') return ['date','datetime','datetime2','timestamp','timestamp without time zone','timestamp with time zone','timestamptz'].includes(kind);
  return true;
};
const key = (prefix: string, n: number) => `${prefix}_${n + 1}`;
const requiredRuleColumns = (draft: t.DataQueryDomainDraft, rule: t.DataQuerySqlRule) =>
  rule.rule_type === 'required_scope_column'
    ? (draft.tables.find((table) => table.object_ref.table_name === rule.rule_config.table)
        ?.columns ?? [])
    : [];

export function RulesStep({ draft, readOnly, update }: StepProps) {
  const localize = useLocalize();
  const [type, setType] = useState<t.DataQuerySqlRule['rule_type']>('time_range_required');
  const add = () =>
    update((d) => {
      const k = key('rule', d.sql_rules.length);
      const table = d.tables[0];
      if (type === 'readonly' || type === 'limit_required')
        d.sql_rules.push({ rule_key: k, rule_type: type, rule_config: {}, enabled: true });
      else if (type === 'time_range_required' || type === 'bounded_lookup')
        d.sql_rules.push({
          rule_key: k,
          rule_type: type,
          rule_config: { tables: table ? [table.object_ref.table_name] : [] },
          enabled: true,
        });
      else if (type === 'summary_projection')
        d.sql_rules.push({ rule_key: k, rule_type: type, enabled: true,
          rule_config: { count_tables: [], count_columns: [], distinct_columns: [],
            group_columns: [], integer_filters: [], text_filters: [], time_columns: [], relationship_keys: [] } });
      else if (type === 'schema_evidence_required')
        d.sql_rules.push({
          rule_key: k,
          rule_type: type,
          rule_config: { core_tables: table ? [table.object_ref.table_name] : [] },
          enabled: true,
        });
      else
        d.sql_rules.push({
          rule_key: k,
          rule_type: type,
          rule_config: {
            table: table?.object_ref.table_name ?? '',
            column: table?.columns[0]?.object_ref.column_name ?? '',
          },
          enabled: true,
        });
    });
  return (
    <Section
      title={localize('com_data_query_editor_sql_rules_0dc869')}
      description={localize(
        'com_data_query_editor_rules_are_selected_from_the_supported_registry_a_d57b0e',
      )}
      action={
        <div className="flex gap-2">
          <select
            className={fieldClass}
            disabled={readOnly}
            value={type}
            onChange={(e) => setType(e.target.value as typeof type)}
          >
            {[
              'readonly',
              'limit_required',
              'time_range_required',
              'bounded_lookup',
              'schema_evidence_required',
              'required_scope_column',
              'summary_projection',
            ].map((v) => (
              <option key={v} value={v}>{v === 'summary_projection' ? '智能体汇总用途' : v}</option>
            ))}
          </select>
          <button type="button" disabled={readOnly} className="text-sm underline" onClick={add}>
            {localize('com_data_query_editor_add_9fd728')}
          </button>
        </div>
      }
    >
      <div className="flex flex-col gap-3">
        {draft.sql_rules.map((rule, index) => (
          <div
            key={`${rule.rule_key}-${index}`}
            className="grid gap-3 rounded border p-4 md:grid-cols-4"
          >
            <Field label={localize('com_data_query_editor_rule_key_8e729a')}>
              <input
                className={fieldClass}
                disabled={readOnly}
                value={rule.rule_key}
                onChange={(e) =>
                  update((d) => {
                    d.sql_rules[index].rule_key = e.target.value;
                  })
                }
              />
            </Field>
            <Field label={localize('com_data_query_editor_type_baaddf')}>
              <input className={fieldClass} disabled value={rule.rule_type} />
            </Field>
            {rule.rule_type === 'summary_projection' && (
              <div className="md:col-span-4">
                <p className="mb-3 text-sm text-(--cui-color-text-muted)">选择允许向智能体提供的汇总范围。保存并发布领域后生效；这些选项不会给用户新增访问授权。分组仅支持整数编号，文本仅作筛选，不返回明细。</p>
                <div className="grid gap-4 md:grid-cols-2">
                  {([
                    ['count_tables', '允许计数的表'], ['count_columns', '可计数字段'],
                    ['distinct_columns', '可去重计数字段'], ['group_columns', '可分组的整数编号'],
                    ['integer_filters', '可等值筛选的整数编号'], ['text_filters', '可等值筛选的文本（最多120字）'],
                    ['time_columns', '可限定时间范围的字段'], ['relationship_keys', '可使用的内关联'],
                  ] as const).map(([purpose, label]) => {
                    const options = purpose === 'count_tables' ? tableOptions(draft)
                      : purpose === 'relationship_keys' ? draft.relationships.filter(r => r.join_type === 'inner').map(r => ({value: r.relationship_key, label: r.description || `${refLabel(r.left_column)} → ${refLabel(r.right_column)}`}))
                      : draft.tables.flatMap(t => t.columns.filter(c => !c.sensitive && summaryTypeAllowed(purpose, c.data_type)).map(c => ({value: c.object_ref.object_id, label: `${t.display_name || t.object_ref.table_name} / ${c.display_name || c.object_ref.column_name}`})));
                    // Keep stale selections visible; never silently drop saved scope.
                    const missing = rule.rule_config[purpose].filter(id => !options.some(o => o.value === id));
                    return <Field key={purpose} label={label}>
                      <MultiSelect disabled={readOnly} values={rule.rule_config[purpose]}
                        options={[...options, ...missing.map(id => ({value: id, label: '原选择已失效，请重新核对'}))]}
                        onChange={values => update(d => {const r=d.sql_rules[index]; if(r.rule_type === 'summary_projection') r.rule_config[purpose]=values;})} />
                    </Field>;
                  })}
                </div>
              </div>
            )}
            {'tables' in rule.rule_config && (
              <Field label={localize('com_data_query_editor_tables_e3fe2a')}>
                <input
                  className={fieldClass}
                  disabled={readOnly}
                  value={rule.rule_config.tables.join(', ')}
                  onChange={(e) =>
                    update((d) => {
                      const r = d.sql_rules[index];
                      if (r.rule_type === 'time_range_required' || r.rule_type === 'bounded_lookup')
                        r.rule_config.tables = e.target.value
                          .split(',')
                          .map((v) => v.trim())
                          .filter(Boolean);
                    })
                  }
                />
              </Field>
            )}
            {'core_tables' in rule.rule_config && (
              <Field label={localize('com_data_query_editor_core_tables_e889f3')}>
                <input
                  className={fieldClass}
                  disabled={readOnly}
                  value={rule.rule_config.core_tables.join(', ')}
                  onChange={(e) =>
                    update((d) => {
                      const r = d.sql_rules[index];
                      if (r.rule_type === 'schema_evidence_required')
                        r.rule_config.core_tables = e.target.value
                          .split(',')
                          .map((v) => v.trim())
                          .filter(Boolean);
                    })
                  }
                />
              </Field>
            )}
            {'table' in rule.rule_config && (
              <>
                <Field label={localize('com_data_query_editor_table_16d1c9')}>
                  <select
                    className={fieldClass}
                    disabled={readOnly}
                    value={rule.rule_config.table}
                    onChange={(e) =>
                      update((d) => {
                        const r = d.sql_rules[index];
                        if (r.rule_type === 'required_scope_column') {
                          r.rule_config.table = e.target.value;
                          r.rule_config.column =
                            d.tables.find((v) => v.object_ref.table_name === e.target.value)
                              ?.columns[0]?.object_ref.column_name ?? '';
                        }
                      })
                    }
                  >
                    {draft.tables.map((v) => (
                      <option key={v.object_ref.object_id}>{v.object_ref.table_name}</option>
                    ))}
                  </select>
                </Field>
                <Field label={localize('com_data_query_editor_required_column_d87ab4')}>
                  <select
                    className={fieldClass}
                    disabled={readOnly}
                    value={rule.rule_config.column}
                    onChange={(e) =>
                      update((d) => {
                        const r = d.sql_rules[index];
                        if (r.rule_type === 'required_scope_column')
                          r.rule_config.column = e.target.value;
                      })
                    }
                  >
                    {requiredRuleColumns(draft, rule).map((column) => (
                      <option key={column.object_ref.object_id}>
                        {column.object_ref.column_name}
                      </option>
                    ))}
                  </select>
                </Field>
              </>
            )}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                disabled={readOnly}
                checked={rule.enabled}
                onChange={(e) =>
                  update((d) => {
                    d.sql_rules[index].enabled = e.target.checked;
                  })
                }
              />
              {localize('com_data_query_editor_enabled_92c1cd')}
            </label>
            <RemoveButton
              disabled={readOnly}
              onClick={() =>
                update((d) => {
                  d.sql_rules.splice(index, 1);
                })
              }
            />
          </div>
        ))}
        {!draft.sql_rules.length && (
          <Empty>{localize('com_data_query_editor_no_sql_rules_configured_57187e')}</Empty>
        )}
      </div>
    </Section>
  );
}

export function PoliciesStep({ draft, readOnly, update }: StepProps) {
  const localize = useLocalize();
  const [previewSubject, setPreviewSubject] = useState('user-preview');
  const [previewOrg, setPreviewOrg] = useState('organization-preview');
  const add = () =>
    update((d) => {
      const table = d.tables[0];
      if (!table) return;
      d.access_policies.push({
        policy_key: key('policy', d.access_policies.length),
        action: 'schema.read',
        effect: 'allow',
        tables: [table.object_ref],
        columns: { [table.object_ref.object_id]: table.columns.map((c) => c.object_ref) },
        row_scope: [],
        max_rows: d.max_limit,
        max_time_range_days: null,
        priority: 0,
        starts_at: null,
        ends_at: null,
        enabled: true,
      });
    });
  return (
    <Section
      title={localize('com_data_query_editor_access_policies_9db7db')}
      description={localize(
        'com_data_query_editor_version_scoped_policies_restrict_actions_tables_cf80d2',
      )}
      action={
        <button
          type="button"
          disabled={readOnly || !draft.tables.length}
          className="text-sm underline"
          onClick={add}
        >
          {localize('com_data_query_editor_add_policy_0ddbec')}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        {draft.access_policies.map((policy, index) => (
          <div key={`${policy.policy_key}-${index}`} className="rounded border p-4">
            <div className="flex justify-between">
              <strong>{policy.policy_key}</strong>
              <RemoveButton
                disabled={readOnly}
                onClick={() =>
                  update((d) => {
                    d.access_policies.splice(index, 1);
                  })
                }
              />
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Field label={localize('com_data_query_editor_policy_key_4be1cb')}>
                <input
                  disabled={readOnly}
                  className={fieldClass}
                  value={policy.policy_key}
                  onChange={(e) =>
                    update((d) => {
                      d.access_policies[index].policy_key = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label={localize('com_data_query_editor_action_64cff1')}>
                <select
                  disabled={readOnly}
                  className={fieldClass}
                  value={policy.action}
                  onChange={(e) =>
                    update((d) => {
                      d.access_policies[index].action = e.target.value as typeof policy.action;
                    })
                  }
                >
                  {[
                    'schema.read',
                    'metric.query',
                    'sql.generate',
                    'sql.execute_generated',
                    'sql.execute_direct',
                  ].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label={localize('com_data_query_editor_effect_2252d5')}>
                <select
                  disabled={readOnly}
                  className={fieldClass}
                  value={policy.effect}
                  onChange={(e) =>
                    update((d) => {
                      d.access_policies[index].effect = e.target.value as 'allow' | 'deny';
                    })
                  }
                >
                  <option>{localize('com_data_query_editor_allow_410083')}</option>
                  <option>{localize('com_data_query_editor_deny_3026a0')}</option>
                </select>
              </Field>
              <Field label={localize('com_data_query_editor_tables_e3fe2a')}>
                <MultiSelect
                  disabled={readOnly}
                  values={policy.tables.map((r) => r.object_id)}
                  options={tableOptions(draft)}
                  onChange={(ids) =>
                    update((d) => {
                      const p = d.access_policies[index];
                      p.tables = ids.map(
                        (id) => d.tables.find((v) => v.object_ref.object_id === id)!.object_ref,
                      );
                      p.columns = Object.fromEntries(ids.map((id) => [id, p.columns[id] ?? []]));
                      p.row_scope = p.row_scope.filter((s) => ids.includes(s.table.object_id));
                    })
                  }
                />
              </Field>
              <div className="md:col-span-2">
                <span className="text-sm font-medium">
                  {localize('com_data_query_editor_allowed_columns_d9dd38')}
                </span>
                {policy.tables.map((table) => (
                  <Field key={table.object_id} label={refLabel(table)}>
                    <MultiSelect
                      disabled={readOnly}
                      values={(policy.columns[table.object_id] ?? []).map((r) => r.object_id)}
                      options={colOptions(draft, table.object_id)}
                      onChange={(ids) =>
                        update((d) => {
                          d.access_policies[index].columns[table.object_id] = ids.map(
                            (id) =>
                              columnsFor(d, table.object_id).find(
                                (c) => c.object_ref.object_id === id,
                              )!.object_ref,
                          );
                        })
                      }
                    />
                  </Field>
                ))}
              </div>
              <Field label={localize('com_data_query_editor_maximum_rows_41c5e0')}>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  disabled={readOnly}
                  className={fieldClass}
                  value={policy.max_rows ?? ''}
                  onChange={(e) =>
                    update((d) => {
                      d.access_policies[index].max_rows = e.target.value
                        ? Number(e.target.value)
                        : null;
                    })
                  }
                />
              </Field>
              <Field label={localize('com_data_query_editor_maximum_range_days_a418a0')}>
                <input
                  type="number"
                  min={1}
                  max={3650}
                  disabled={readOnly}
                  className={fieldClass}
                  value={policy.max_time_range_days ?? ''}
                  onChange={(e) =>
                    update((d) => {
                      d.access_policies[index].max_time_range_days = e.target.value
                        ? Number(e.target.value)
                        : null;
                    })
                  }
                />
              </Field>
              <Field label={localize('com_data_query_editor_priority_d60dbb')}>
                <input
                  type="number"
                  min={0}
                  max={1000}
                  disabled={readOnly}
                  className={fieldClass}
                  value={policy.priority}
                  onChange={(e) =>
                    update((d) => {
                      d.access_policies[index].priority = Number(e.target.value);
                    })
                  }
                />
              </Field>
              <Field label={localize('com_data_query_editor_starts_at_faca35')}>
                <input
                  type="datetime-local"
                  disabled={readOnly}
                  className={fieldClass}
                  value={policy.starts_at?.slice(0, 16) ?? ''}
                  onChange={(e) =>
                    update((d) => {
                      d.access_policies[index].starts_at = e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null;
                    })
                  }
                />
              </Field>
              <Field label={localize('com_data_query_editor_ends_at_c40654')}>
                <input
                  type="datetime-local"
                  disabled={readOnly}
                  className={fieldClass}
                  value={policy.ends_at?.slice(0, 16) ?? ''}
                  onChange={(e) =>
                    update((d) => {
                      d.access_policies[index].ends_at = e.target.value
                        ? new Date(e.target.value).toISOString()
                        : null;
                    })
                  }
                />
              </Field>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  disabled={readOnly}
                  checked={policy.enabled}
                  onChange={(e) =>
                    update((d) => {
                      d.access_policies[index].enabled = e.target.checked;
                    })
                  }
                />
                {localize('com_data_query_editor_enabled_92c1cd')}
              </label>
            </div>
            <RowScopes
              draft={draft}
              policy={policy}
              index={index}
              readOnly={readOnly}
              update={update}
            />
          </div>
        ))}
        {!draft.access_policies.length && (
          <Empty>{localize('com_data_query_editor_no_access_policies_configured_9029b7')}</Empty>
        )}
      </div>
      <div className="mt-5 border-t pt-4">
        <h4 className="font-medium">
          {localize('com_data_query_editor_access_scope_preview_277e7e')}
        </h4>
        <p className="mt-1 text-xs text-(--cui-color-text-muted)">
          {localize(
            'com_data_query_editor_this_previews_the_configured_policy_scope_only_i_4623f3',
          )}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <Field label={localize('com_data_query_editor_subject_id_claim_dc7f87')}>
            <input
              className={fieldClass}
              value={previewSubject}
              onChange={(event) => setPreviewSubject(event.target.value)}
            />
          </Field>
          <Field label={localize('com_data_query_editor_organization_id_claim_44e274')}>
            <input
              className={fieldClass}
              value={previewOrg}
              onChange={(event) => setPreviewOrg(event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3 rounded bg-(--cui-color-background-secondary) p-3 text-sm">
          {draft.access_policies
            .filter((policy) => policy.enabled)
            .map((policy) => (
              <p key={policy.policy_key}>
                <strong>{policy.policy_key}</strong>: {policy.effect} {policy.action};{' '}
                {policy.row_scope.length
                  ? policy.row_scope
                      .map(
                        (scope) =>
                          `${refLabel(scope.column)} = ${scope.claim === 'org_id' ? previewOrg : previewSubject}`,
                      )
                      .join(', ')
                  : 'no row claim restriction'}
              </p>
            ))}
          {!draft.access_policies.some((policy) => policy.enabled) && 'No enabled policy applies.'}
        </div>
      </div>
    </Section>
  );
}

function RowScopes({
  draft,
  policy,
  index,
  readOnly,
  update,
}: {
  draft: t.DataQueryDomainDraft;
  policy: t.DataQueryAccessPolicy;
  index: number;
  readOnly: boolean;
  update: DraftUpdater;
}) {
  const localize = useLocalize();
  const add = () =>
    update((d) => {
      const p = d.access_policies[index],
        table = p.tables[0];
      if (!table) return;
      const column = columnsFor(d, table.object_id)[0];
      if (column)
        p.row_scope.push({ table, column: column.object_ref, operator: 'eq', claim: 'org_id' });
    });
  return (
    <div className="mt-4 border-t pt-3">
      <div className="flex justify-between">
        <strong className="text-sm">{localize('com_data_query_editor_row_scopes_e7c134')}</strong>
        <button
          type="button"
          disabled={readOnly || !policy.tables.length}
          className="text-sm underline"
          onClick={add}
        >
          {localize('com_data_query_editor_add_scope_461afd')}
        </button>
      </div>
      {policy.row_scope.map((scope, scopeIndex) => (
        <div key={scopeIndex} className="mt-2 grid gap-2 md:grid-cols-4">
          <select
            disabled={readOnly}
            className={fieldClass}
            value={scope.table.object_id}
            onChange={(e) =>
              update((d) => {
                const p = d.access_policies[index],
                  table = p.tables.find((v) => v.object_id === e.target.value)!;
                p.row_scope[scopeIndex].table = table;
                p.row_scope[scopeIndex].column = columnsFor(d, table.object_id)[0].object_ref;
              })
            }
          >
            {policy.tables.map((v) => (
              <option key={v.object_id} value={v.object_id}>
                {refLabel(v)}
              </option>
            ))}
          </select>
          <select
            disabled={readOnly}
            className={fieldClass}
            value={scope.column.object_id}
            onChange={(e) =>
              update((d) => {
                d.access_policies[index].row_scope[scopeIndex].column = columnsFor(
                  d,
                  scope.table.object_id,
                ).find((c) => c.object_ref.object_id === e.target.value)!.object_ref;
              })
            }
          >
            {colOptions(draft, scope.table.object_id).map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            disabled={readOnly}
            className={fieldClass}
            value={scope.claim}
            onChange={(e) =>
              update((d) => {
                d.access_policies[index].row_scope[scopeIndex].claim = e.target.value as
                  | 'subject_id'
                  | 'org_id';
              })
            }
          >
            <option value="subject_id">
              {localize('com_data_query_editor_subject_id_4dfe82')}
            </option>
            <option value="org_id">{localize('com_data_query_editor_org_id_092380')}</option>
          </select>
          <RemoveButton
            disabled={readOnly}
            onClick={() =>
              update((d) => {
                d.access_policies[index].row_scope.splice(scopeIndex, 1);
              })
            }
          />
        </div>
      ))}
    </div>
  );
}

export function QualityTraceStep({ draft, readOnly, update }: StepProps) {
  const localize = useLocalize();
  const [caseType, setCaseType] =
    useState<t.DataQueryDomainDraft['quality_cases'][number]['case_type']>('result_shape');
  const addCase = () =>
    update((d) => {
      const k = key('quality', d.quality_cases.length);
      const tables = d.tables.map((v) => v.object_ref);
      if (caseType === 'result_shape')
        d.quality_cases.push({
          case_key: k,
          case_type: caseType,
          object_refs: tables,
          expected_tables: tables,
          expected_columns: d.tables[0]?.columns.map((c) => c.object_ref.column_name!) ?? [],
          expected_max_rows: d.max_limit,
        });
      else if (caseType === 'schema_table_coverage')
        d.quality_cases.push({
          case_key: k,
          case_type: caseType,
          expected_table_count: d.tables.length,
          expected_tables: tables,
          source: null,
        });
      else
        d.quality_cases.push({
          case_key: k,
          case_type: caseType,
          expected_pattern_keys: d.query_patterns.map((v) => v.pattern_key),
          source: null,
        });
    });
  return (
    <div className="flex flex-col gap-4">
      <Section
        title={localize('com_data_query_editor_quality_cases_322d24')}
        description={localize(
          'com_data_query_editor_supported_executable_case_contracts_only_5f85fc',
        )}
        action={
          <div className="flex gap-2">
            <select
              className={fieldClass}
              disabled={readOnly}
              value={caseType}
              onChange={(e) => setCaseType(e.target.value as typeof caseType)}
            >
              {['result_shape', 'schema_table_coverage', 'query_pattern_coverage'].map((v) => (
                <option key={v}>{v}</option>
              ))}
            </select>
            <button
              type="button"
              disabled={readOnly}
              className="text-sm underline"
              onClick={addCase}
            >
              {localize('com_data_query_editor_add_9fd728')}
            </button>
          </div>
        }
      >
        <div className="flex flex-col gap-3">
          {draft.quality_cases.map((item, index) => (
            <div
              key={`${item.case_key}-${index}`}
              className="grid gap-3 rounded border p-4 md:grid-cols-3"
            >
              <Field label={localize('com_data_query_editor_case_key_82aaf1')}>
                <input
                  disabled={readOnly}
                  className={fieldClass}
                  value={item.case_key}
                  onChange={(e) =>
                    update((d) => {
                      d.quality_cases[index].case_key = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label={localize('com_data_query_editor_type_baaddf')}>
                <input disabled className={fieldClass} value={item.case_type} />
              </Field>
              {item.case_type === 'result_shape' && (
                <>
                  <Field label={localize('com_data_query_editor_expected_columns_b4102c')}>
                    <input
                      disabled={readOnly}
                      className={fieldClass}
                      value={item.expected_columns.join(', ')}
                      onChange={(e) =>
                        update((d) => {
                          const q = d.quality_cases[index];
                          if (q.case_type === 'result_shape')
                            q.expected_columns = e.target.value
                              .split(',')
                              .map((v) => v.trim())
                              .filter(Boolean);
                        })
                      }
                    />
                  </Field>
                  <Field label={localize('com_data_query_editor_expected_max_rows_e4c806')}>
                    <input
                      type="number"
                      disabled={readOnly}
                      className={fieldClass}
                      value={item.expected_max_rows ?? ''}
                      onChange={(e) =>
                        update((d) => {
                          const q = d.quality_cases[index];
                          if (q.case_type === 'result_shape')
                            q.expected_max_rows = e.target.value ? Number(e.target.value) : null;
                        })
                      }
                    />
                  </Field>
                </>
              )}
              {item.case_type === 'schema_table_coverage' && (
                <Field label={localize('com_data_query_editor_expected_table_count_a36722')}>
                  <input
                    type="number"
                    min={1}
                    disabled={readOnly}
                    className={fieldClass}
                    value={item.expected_table_count}
                    onChange={(e) =>
                      update((d) => {
                        const q = d.quality_cases[index];
                        if (q.case_type === 'schema_table_coverage')
                          q.expected_table_count = Number(e.target.value);
                      })
                    }
                  />
                </Field>
              )}
              {item.case_type === 'query_pattern_coverage' && (
                <Field label={localize('com_data_query_editor_expected_patterns_8476bc')}>
                  <input
                    disabled={readOnly}
                    className={fieldClass}
                    value={item.expected_pattern_keys.join(', ')}
                    onChange={(e) =>
                      update((d) => {
                        const q = d.quality_cases[index];
                        if (q.case_type === 'query_pattern_coverage')
                          q.expected_pattern_keys = e.target.value
                            .split(',')
                            .map((v) => v.trim())
                            .filter(Boolean);
                      })
                    }
                  />
                </Field>
              )}
              <RemoveButton
                disabled={readOnly}
                onClick={() =>
                  update((d) => {
                    d.quality_cases.splice(index, 1);
                  })
                }
              />
            </div>
          ))}
          {!draft.quality_cases.length && (
            <Empty>{localize('com_data_query_editor_no_quality_cases_configured_7a4341')}</Empty>
          )}
        </div>
      </Section>
      <Section
        title={localize('com_data_query_editor_source_trace_6b41c2')}
        description={localize(
          'com_data_query_editor_configuration_provenance_and_sha_256_only_no_sou_019e68',
        )}
      >
        <button
          type="button"
          disabled={readOnly}
          className="mb-3 text-sm underline"
          onClick={() =>
            update((d) => {
              d.source_traces.push({
                source_path: 'resource/path',
                source_sha256: '0'.repeat(64),
                disposition: 'migrated',
                note: null,
              });
            })
          }
        >
          {localize('com_data_query_editor_add_source_trace_f57349')}
        </button>
        <div className="flex flex-col gap-3">
          {draft.source_traces.map((trace, index) => (
            <div
              key={`${trace.source_path}-${index}`}
              className="grid gap-3 rounded border p-4 md:grid-cols-3"
            >
              <Field label={localize('com_data_query_editor_source_path_6a869d')}>
                <input
                  disabled={readOnly}
                  className={fieldClass}
                  value={trace.source_path}
                  onChange={(e) =>
                    update((d) => {
                      d.source_traces[index].source_path = e.target.value;
                    })
                  }
                />
              </Field>
              <Field
                label={localize('com_data_query_editor_sha_256_bbd07c')}
                hint={
                  SHA_PATTERN.test(trace.source_sha256)
                    ? 'Valid hash'
                    : 'Exactly 64 lowercase hexadecimal characters'
                }
              >
                <input
                  disabled={readOnly}
                  className={fieldClass}
                  value={trace.source_sha256}
                  onChange={(e) =>
                    update((d) => {
                      d.source_traces[index].source_sha256 = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label={localize('com_data_query_editor_disposition_8881fc')}>
                <select
                  disabled={readOnly}
                  className={fieldClass}
                  value={trace.disposition}
                  onChange={(e) =>
                    update((d) => {
                      d.source_traces[index].disposition = e.target
                        .value as typeof trace.disposition;
                    })
                  }
                >
                  <option>{localize('com_data_query_editor_migrated_1dc7be')}</option>
                  <option>{localize('com_data_query_editor_deferred_a70601')}</option>
                  <option>{localize('com_data_query_editor_not_migrated_52cbdb')}</option>
                </select>
              </Field>
              <Field label={localize('com_data_query_editor_note_d8da2c')}>
                <input
                  disabled={readOnly}
                  className={fieldClass}
                  value={trace.note ?? ''}
                  onChange={(e) =>
                    update((d) => {
                      d.source_traces[index].note = e.target.value || null;
                    })
                  }
                />
              </Field>
              <RemoveButton
                disabled={readOnly}
                onClick={() =>
                  update((d) => {
                    d.source_traces.splice(index, 1);
                  })
                }
              />
            </div>
          ))}
          {!draft.source_traces.length && (
            <Empty>{localize('com_data_query_editor_no_source_traces_recorded_809602')}</Empty>
          )}
        </div>
      </Section>
    </div>
  );
}
