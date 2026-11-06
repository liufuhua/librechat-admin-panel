import type * as t from '@/types';

// Keep the displayed discovery provenance in the create request. Without this,
// the first quality run cannot associate the selected structure with a snapshot.
export function domainDraftCreateInput(
  draft: t.DataQueryDomainDraft,
  snapshot: t.DataQuerySchemaSnapshot,
  reason: string,
) {
  return { draft, snapshot_id: snapshot.snapshot_id, reason };
}

const STORAGE_PREFIX = 'data-query-v2-domain-selection:';

export interface StoredDomainSelection {
  snapshot: t.DataQuerySchemaSnapshot;
  selectedObjectIds: string[];
}

export interface DomainBasics {
  domainKey: string;
  displayName: string;
  description: string;
  versionKey: string;
  defaultLimit: number;
  maxLimit: number;
  routingKeywords: string[];
}

export interface TableMetadata {
  displayName: string;
  description: string;
  timeColumnObjectId: string | null;
  organizationColumnObjectId: string | null;
  sensitiveColumnObjectIds: string[];
}

export type TableMetadataById = Record<string, TableMetadata>;

export const saveDomainSelection = (selection: StoredDomainSelection): string => {
  const token = crypto.randomUUID();
  sessionStorage.setItem(`${STORAGE_PREFIX}${token}`, JSON.stringify(selection));
  return token;
};

export const loadDomainSelection = (token: string | undefined): StoredDomainSelection | null => {
  if (!token) return null;
  const raw = sessionStorage.getItem(`${STORAGE_PREFIX}${token}`);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as StoredDomainSelection;
    if (
      !parsed.snapshot?.snapshot_id ||
      !parsed.snapshot?.source_key ||
      !Array.isArray(parsed.selectedObjectIds)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const selectedSnapshotTables = (
  selection: StoredDomainSelection,
): t.DataQuerySnapshotTable[] => {
  const selected = new Set(selection.selectedObjectIds);
  return selection.snapshot.structure.tables.filter((table) =>
    selected.has(table.table.object_id),
  );
};

export const initialTableMetadata = (selection: StoredDomainSelection): TableMetadataById =>
  Object.fromEntries(
    selectedSnapshotTables(selection).map((table) => [
      table.table.object_id,
      {
        displayName: table.table.table_name,
        description: '',
        timeColumnObjectId: null,
        organizationColumnObjectId: null,
        sensitiveColumnObjectIds: [],
      },
    ]),
  );

export const validateDomainSelection = (selection: StoredDomainSelection): string[] => {
  const selected = new Set(selection.selectedObjectIds);
  const errors: string[] = [];
  for (const table of selectedSnapshotTables(selection)) {
    const selectedColumns = table.columns.filter((column) =>
      selected.has(column.object_ref.object_id),
    );
    if (selectedColumns.length === 0) errors.push(`${table.table.table_name}:no_columns`);
    if (table.primary_key.length === 0) errors.push(`${table.table.table_name}:no_primary_key`);
    if (!table.primary_key.every((column) => selected.has(column.object_id))) {
      errors.push(`${table.table.table_name}:primary_key_incomplete`);
    }
  }
  if (selectedSnapshotTables(selection).length === 0) errors.push('no_tables');
  return errors;
};

export const buildDomainDraft = (
  source: t.DataQuerySource,
  selection: StoredDomainSelection,
  basics: DomainBasics,
  metadata: TableMetadataById,
): t.DataQueryDomainDraft => {
  const selected = new Set(selection.selectedObjectIds);
  const tables = selectedSnapshotTables(selection).map((table) => {
    const tableMetadata = metadata[table.table.object_id];
    const sensitive = new Set(tableMetadata?.sensitiveColumnObjectIds ?? []);
    const columns = table.columns
      .filter((column) => selected.has(column.object_ref.object_id))
      .map((column) => ({
        object_ref: column.object_ref,
        data_type: column.data_type,
        nullable: column.nullable,
        sensitive: sensitive.has(column.object_ref.object_id),
        display_name: column.object_ref.column_name,
        description: null,
        synonyms: [],
      }));
    const columnById = new Map(columns.map((column) => [column.object_ref.object_id, column]));
    return {
      object_ref: table.table,
      display_name: tableMetadata?.displayName || table.table.table_name,
      description: tableMetadata?.description || null,
      primary_key: table.primary_key,
      time_column: tableMetadata?.timeColumnObjectId
        ? (columnById.get(tableMetadata.timeColumnObjectId)?.object_ref ?? null)
        : null,
      organization_column: tableMetadata?.organizationColumnObjectId
        ? (columnById.get(tableMetadata.organizationColumnObjectId)?.object_ref ?? null)
        : null,
      columns,
    };
  });
  return {
    domain_key: basics.domainKey,
    display_name: basics.displayName,
    description: basics.description || null,
    source_key: source.source_key,
    source_type: source.source_type,
    version_key: basics.versionKey,
    default_limit: basics.defaultLimit,
    max_limit: basics.maxLimit,
    routing_keywords: basics.routingKeywords,
    tables,
    terminology: {},
    metrics: [],
    sql_rules: [
      {
        rule_key: 'readonly_query',
        rule_type: 'readonly',
        rule_config: {},
        enabled: true,
      },
      {
        rule_key: 'limit_required',
        rule_type: 'limit_required',
        rule_config: {},
        enabled: true,
      },
    ],
    relationships: [],
    query_patterns: [],
    source_traces: [],
    access_policies: [],
    quality_cases: [
      {
        case_key: 'initial_schema_shape',
        case_type: 'result_shape',
        object_refs: tables.map((table) => table.object_ref),
        expected_tables: tables.map((table) => table.object_ref),
        expected_columns: [],
        expected_max_rows: basics.maxLimit,
      },
    ],
  };
};

export const domainQuality = (
  domain: t.DataQueryDomain,
): 'failed' | 'passed' | 'not_run' | 'running' => {
  const statuses = domain.versions.map((version) => version.quality_status);
  if (statuses.includes('failed')) return 'failed';
  if (statuses.includes('running')) return 'running';
  if (statuses.includes('passed')) return 'passed';
  return 'not_run';
};

export const editableDomainVersion = (
  domain: t.DataQueryDomain,
): t.DataQueryVersionSummary | null =>
  [...domain.versions]
    .filter((version) => version.status === 'draft' || version.status === 'ready')
    .sort((left, right) => (right.created_at ?? '').localeCompare(left.created_at ?? ''))[0] ??
  null;
