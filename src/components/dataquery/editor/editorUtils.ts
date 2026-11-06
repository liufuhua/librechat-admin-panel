import type * as t from '@/types';

export type DraftUpdater = (mutate: (draft: t.DataQueryDomainDraft) => void) => void;

export const cloneDraft = (draft: t.DataQueryDomainDraft): t.DataQueryDomainDraft =>
  structuredClone(draft);

export const refLabel = (ref: t.DataQueryObjectRef): string =>
  ref.column_name ? `${ref.table_name}.${ref.column_name}` : ref.table_name;

export const columnsFor = (
  draft: t.DataQueryDomainDraft,
  tableId: string,
): t.DataQueryDomainColumn[] =>
  draft.tables.find((table) => table.object_ref.object_id === tableId)?.columns ?? [];

export const tableForColumn = (
  draft: t.DataQueryDomainDraft,
  columnId: string,
): t.DataQueryDomainTable | undefined =>
  draft.tables.find((table) =>
    table.columns.some((column) => column.object_ref.object_id === columnId),
  );

export interface ObjectDependency {
  asset: string;
  key: string;
}

function ruleObjectNames(rule: t.DataQuerySqlRule): string[] {
  switch (rule.rule_type) {
    case 'time_range_required':
    case 'bounded_lookup':
      return rule.rule_config.tables;
    case 'schema_evidence_required':
      return rule.rule_config.core_tables;
    case 'required_scope_column':
      return [rule.rule_config.table, rule.rule_config.column];
    default:
      return [];
  }
}

function patternObjectNames(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value === null) return [];
  return [String(value)];
}

export function objectDependencies(
  draft: t.DataQueryDomainDraft,
  objectId: string,
): ObjectDependency[] {
  const dependencies: ObjectDependency[] = [];
  const add = (asset: string, key: string) => dependencies.push({ asset, key });
  for (const metric of draft.metrics) {
    const refs = [
      metric.metric_spec.table,
      metric.metric_spec.time_column,
      metric.metric_spec.value_column,
      ...metric.metric_spec.dimensions,
      ...metric.metric_spec.allowed_filters,
    ].filter(Boolean) as t.DataQueryObjectRef[];
    if (refs.some((ref) => ref.object_id === objectId)) add('Metric', metric.metric_key);
  }
  for (const relationship of draft.relationships) {
    if (
      [
        relationship.left_table,
        relationship.left_column,
        relationship.right_table,
        relationship.right_column,
      ].some((ref) => ref.object_id === objectId)
    )
      add('Relationship', relationship.relationship_key);
  }
  for (const policy of draft.access_policies) {
    const refs = [
      ...policy.tables,
      ...Object.values(policy.columns).flat(),
      ...policy.row_scope.flatMap((scope) => [scope.table, scope.column]),
    ];
    if (refs.some((ref) => ref.object_id === objectId)) add('Policy', policy.policy_key);
  }
  for (const qualityCase of draft.quality_cases) {
    const refs = [
      ...('object_refs' in qualityCase ? qualityCase.object_refs : []),
      ...('expected_tables' in qualityCase ? qualityCase.expected_tables : []),
    ];
    if (refs.some((ref) => ref.object_id === objectId)) add('Quality case', qualityCase.case_key);
  }
  const nativeName =
    draft.tables.find((table) => table.object_ref.object_id === objectId)?.object_ref.table_name ??
    draft.tables
      .flatMap((table) => table.columns)
      .find((column) => column.object_ref.object_id === objectId)?.object_ref.column_name;
  if (nativeName) {
    for (const pattern of draft.query_patterns) {
      const names = Object.values(pattern.pattern_config).flatMap(patternObjectNames);
      if (names.includes(nativeName)) add('Query pattern', pattern.pattern_key);
    }
    for (const rule of draft.sql_rules) {
      if (ruleObjectNames(rule).includes(nativeName)) add('SQL rule', rule.rule_key);
    }
  }
  return dependencies;
}

export function validateEditorDraft(draft: t.DataQueryDomainDraft): string[] {
  const errors: string[] = [];
  if (!draft.display_name.trim()) errors.push('Domain name is required');
  if (draft.default_limit < 1 || draft.default_limit > draft.max_limit)
    errors.push('Default limit must be between 1 and maximum limit');
  if (draft.max_limit > 10_000) errors.push('Maximum limit cannot exceed 10,000');
  if (!draft.tables.length) errors.push('At least one table is required');
  for (const table of draft.tables) {
    if (!table.columns.length)
      errors.push(`${table.object_ref.table_name}: select at least one field`);
    const columnIds = new Set(table.columns.map((column) => column.object_ref.object_id));
    if (!table.primary_key.length || table.primary_key.some((ref) => !columnIds.has(ref.object_id)))
      errors.push(`${table.object_ref.table_name}: primary key is incomplete`);
  }
  const collections: Array<[string, string[]]> = [
    ['metric', draft.metrics.map((item) => item.metric_key)],
    ['relationship', draft.relationships.map((item) => item.relationship_key)],
    ['query pattern', draft.query_patterns.map((item) => item.pattern_key)],
    ['SQL rule', draft.sql_rules.map((item) => item.rule_key)],
    ['policy', draft.access_policies.map((item) => item.policy_key)],
    ['quality case', draft.quality_cases.map((item) => item.case_key)],
    ['source trace', draft.source_traces.map((item) => item.source_path)],
  ];
  for (const [label, keys] of collections) {
    if (new Set(keys).size !== keys.length) errors.push(`Duplicate ${label} key`);
    if (keys.some((key) => !key.trim())) errors.push(`${label} key is required`);
    if (label !== 'source trace' && keys.some((key) => !KEY_PATTERN.test(key)))
      errors.push(`${label} keys must use lowercase letters, numbers and underscores`);
  }
  if (draft.source_traces.some((trace) => !SHA_PATTERN.test(trace.source_sha256)))
    errors.push('Source trace SHA-256 must contain 64 lowercase hexadecimal characters');
  if (
    draft.access_policies.some(
      (policy) =>
        policy.starts_at &&
        policy.ends_at &&
        new Date(policy.ends_at).getTime() <= new Date(policy.starts_at).getTime(),
    )
  )
    errors.push('Policy end time must follow its start time');
  return errors;
}

export function terminologyMatches(
  terminology: Record<string, string[]>,
  question: string,
): Array<{ term: string; evidence: string }> {
  const normalized = question.toLocaleLowerCase();
  return Object.entries(terminology).flatMap(([term, aliases]) => {
    const evidence = [term, ...aliases].find((candidate) =>
      normalized.includes(candidate.toLocaleLowerCase()),
    );
    return evidence ? [{ term, evidence }] : [];
  });
}

export const KEY_PATTERN = /^[a-z][a-z0-9_]{1,119}$/;
export const SHA_PATTERN = /^[a-f0-9]{64}$/;
