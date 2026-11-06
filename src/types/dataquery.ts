export type DataQuerySourceType = 'postgresql' | 'mysql';
export type DataQueryRiskLevel = 'low' | 'medium' | 'high';
export type DataQueryCredentialState =
  | 'missing'
  | 'legacy_env'
  | 'configured'
  | 'rotation_required'
  | 'revoked';
export type DataQueryConnectionStatus = 'not_tested' | 'passed' | 'failed' | 'stale';

export interface DataQuerySource {
  source_key: string;
  name: string;
  source_type: DataQuerySourceType;
  environment: string;
  enabled: boolean;
  owner_team: string | null;
  risk_level: DataQueryRiskLevel;
  secret_configured: boolean;
  credential_state: DataQueryCredentialState;
  last_connection_status: DataQueryConnectionStatus;
  last_connection_code: string | null;
  last_tested_at: string | null;
}

export interface DataQueryVersionSummary {
  version_key: string;
  status: 'draft' | 'ready' | 'published' | 'retired';
  revision: number;
  table_count: number;
  metric_count: number;
  sql_rule_count: number;
  access_policy_count: number;
  published_at: string | null;
  quality_status: 'not_run' | 'running' | 'passed' | 'failed';
  quality_blocking_codes: string[];
  quality_checked_at: string | null;
  created_at: string | null;
}

export interface DataQueryQualityCheck {
  check_key: string;
  status: 'passed' | 'failed' | 'skipped';
  severity: 'blocking' | 'warning';
  stable_code: string | null;
  summary: Record<string, string | number | boolean | null>;
}

export interface DataQueryQualityRun {
  quality_run_id: string;
  job_id: string;
  revision: number;
  status: 'queued' | 'running' | 'passed' | 'failed' | 'stale';
  progress_current: number;
  progress_total: number;
  stable_code: string | null;
  blocking_codes: string[];
  warning_codes: string[];
  checks: DataQueryQualityCheck[];
  schema_snapshot_hash: string | null;
  created_at: string | null;
  started_at: string | null;
  finished_at: string | null;
}

export interface DataQueryDomainColumn {
  object_ref: DataQueryObjectRef;
  data_type: string;
  nullable: boolean;
  sensitive: boolean;
  display_name: string | null;
  description: string | null;
  synonyms: string[];
}

export interface DataQueryDomainTable {
  object_ref: DataQueryObjectRef;
  display_name: string | null;
  description: string | null;
  primary_key: DataQueryObjectRef[];
  time_column: DataQueryObjectRef | null;
  organization_column: DataQueryObjectRef | null;
  columns: DataQueryDomainColumn[];
}

export interface DataQueryMetric {
  metric_type: 'configured';
  metric_key: string;
  name: string;
  description: string | null;
  metric_spec: {
    table: DataQueryObjectRef;
    time_column: DataQueryObjectRef | null;
    value_column: DataQueryObjectRef | null;
    aggregation: 'sum' | 'avg' | 'min' | 'max' | 'count' | 'latest';
    dimensions: DataQueryObjectRef[];
    allowed_filters: DataQueryObjectRef[];
    unit: string;
    display_format: string;
    max_time_range_hours: number;
  };
  enabled: boolean;
}

export interface DataQueryAccessPolicy {
  policy_key: string;
  action:
    | 'schema.read'
    | 'metric.query'
    | 'sql.generate'
    | 'sql.execute_generated'
    | 'sql.execute_direct';
  effect: 'allow' | 'deny';
  tables: DataQueryObjectRef[];
  columns: Record<string, DataQueryObjectRef[]>;
  row_scope: Array<{
    table: DataQueryObjectRef;
    column: DataQueryObjectRef;
    operator: 'eq';
    claim: 'subject_id' | 'org_id';
  }>;
  max_rows: number | null;
  max_time_range_days: number | null;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  enabled: boolean;
}

export interface DataQueryDomain {
  domain_key: string;
  name: string;
  description: string | null;
  enabled: boolean;
  source_key: string;
  source_type: DataQuerySourceType;
  published_version: string | null;
  versions: DataQueryVersionSummary[];
}

export interface SummaryProjectionConfig {
  count_tables: string[];
  count_columns: string[];
  distinct_columns: string[];
  group_columns: string[];
  integer_filters: string[];
  text_filters: string[];
  time_columns: string[];
  relationship_keys: string[];
}

export type DataQuerySqlRule =
  | {
      rule_key: string;
      rule_type: 'summary_projection';
      rule_config: SummaryProjectionConfig;
      enabled: boolean;
    }
  | {
      rule_key: string;
      rule_type: 'readonly' | 'limit_required';
      rule_config: Record<string, never>;
      enabled: boolean;
    }
  | {
      rule_key: string;
      rule_type: 'time_range_required' | 'bounded_lookup';
      rule_config: { tables: string[] };
      enabled: boolean;
    }
  | {
      rule_key: string;
      rule_type: 'schema_evidence_required';
      rule_config: { core_tables: string[] };
      enabled: boolean;
    }
  | {
      rule_key: string;
      rule_type: 'required_scope_column';
      rule_config: { table: string; column: string };
      enabled: boolean;
    };

export interface DataQueryDomainDraft {
  domain_key: string;
  display_name: string;
  description: string | null;
  source_key: string;
  source_type: DataQuerySourceType;
  version_key: string;
  default_limit: number;
  max_limit: number;
  routing_keywords: string[];
  tables: DataQueryDomainTable[];
  terminology: Record<string, string[]>;
  metrics: DataQueryMetric[];
  sql_rules: DataQuerySqlRule[];
  relationships: Array<{
    relationship_key: string;
    left_table: DataQueryObjectRef;
    left_column: DataQueryObjectRef;
    right_table: DataQueryObjectRef;
    right_column: DataQueryObjectRef;
    join_type: 'inner' | 'left';
    description: string | null;
  }>;
  query_patterns: Array<
    | {
        pattern_key: string;
        pattern_type: 'table_selection';
        pattern_config: {
          aliases: string[];
          report_table: string;
          element_table: string | null;
          time_column: string;
        };
        enabled: boolean;
      }
    | {
        pattern_key: string;
        pattern_type: 'entity_normalization';
        pattern_config: {
          entity: string;
          format: string;
          lookup_table: string;
          lookup_column: string;
        };
        enabled: boolean;
      }
    | {
        pattern_key: string;
        pattern_type: 'pivot';
        pattern_config: {
          detail_tables: string[];
          pivot_columns: string[];
          value_column: string;
          group_by: string[];
        };
        enabled: boolean;
      }
    | {
        pattern_key: string;
        pattern_type: 'default_constraint';
        pattern_config: {
          default_period: string;
          report_table: string;
          element_table: string | null;
        };
        enabled: boolean;
      }
  >;
  source_traces: Array<{
    source_path: string;
    source_sha256: string;
    disposition: 'migrated' | 'deferred' | 'not_migrated';
    note: string | null;
  }>;
  access_policies: DataQueryAccessPolicy[];
  quality_cases: Array<
    | {
        case_key: string;
        case_type: 'result_shape';
        object_refs: DataQueryObjectRef[];
        expected_tables: DataQueryObjectRef[];
        expected_columns: string[];
        expected_max_rows: number | null;
      }
    | {
        case_key: string;
        case_type: 'schema_table_coverage';
        expected_table_count: number;
        expected_tables: DataQueryObjectRef[];
        source: string | null;
      }
    | {
        case_key: string;
        case_type: 'query_pattern_coverage';
        expected_pattern_keys: string[];
        source: string | null;
      }
  >;
}

export interface DataQueryDomainVersionDetail extends DataQueryVersionSummary {
  domain_key: string;
  draft: DataQueryDomainDraft;
}

export interface DataQueryAudit {
  id: number;
  request_id: string;
  actor_subject_id: string;
  action: string;
  object_type: string;
  object_key: string;
  reason: string | null;
  result: string;
  created_at: string | null;
}

export interface DataQueryAuditDetail extends DataQueryAudit {
  before_summary: DataQueryAuditSummary;
  after_summary: DataQueryAuditSummary;
}

export type DataQueryAuditSummaryValue =
  | string
  | number
  | boolean
  | null
  | DataQueryAuditSummary
  | DataQueryAuditSummaryValue[];

export interface DataQueryAuditSummary {
  [key: string]: DataQueryAuditSummaryValue;
}

export interface DataQueryGrant {
  grant_id: number;
  subject_type: 'user' | 'role' | 'organization';
  subject_key: string;
  subject_name?: string;
  effect: 'allow' | 'deny';
  actions: string[];
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
}

interface DataQueryCredentialBaseInput {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  caSecretRef: string | null;
  connectTimeoutSeconds: number;
}

export interface DataQueryPostgresCredentialInput extends DataQueryCredentialBaseInput {
  sourceType: 'postgresql';
  sslMode: 'disable' | 'allow' | 'prefer' | 'require' | 'verify-ca' | 'verify-full' | null;
}

export interface DataQueryMysqlCredentialInput extends DataQueryCredentialBaseInput {
  sourceType: 'mysql';
  tlsMode: 'disabled' | 'preferred' | 'required' | 'verify-ca' | 'verify-identity' | null;
}

export type DataQueryCredentialInput =
  | DataQueryPostgresCredentialInput
  | DataQueryMysqlCredentialInput;

export interface DataQuerySourceInput {
  sourceKey: string;
  name: string;
  sourceType: DataQuerySourceType;
  credential: DataQueryCredentialInput;
  environment: string;
  ownerTeam: string;
  riskLevel: DataQueryRiskLevel;
  reason: string;
}

export interface DataQuerySourceMetadataInput {
  sourceKey: string;
  name?: string;
  environment?: string;
  ownerTeam?: string | null;
  riskLevel?: DataQueryRiskLevel;
  reason: string;
}

export interface DataQuerySourceCredentialInput {
  sourceKey: string;
  credential: DataQueryCredentialInput;
  requireConnectionSuccess: boolean;
  reason: string;
}

export interface DataQuerySourceReasonInput {
  sourceKey: string;
  reason: string;
}

export interface DataQueryConnectionResult {
  source_key: string;
  status: 'passed' | 'failed';
  code: string;
}

export interface DataQueryObjectRef {
  object_id: string;
  kind: 'table' | 'column';
  catalog_name: string | null;
  schema_name: string | null;
  table_name: string;
  column_name: string | null;
}

export interface DataQueryDiscoveryEvidence {
  source_key: string;
  source_type: DataQuerySourceType;
  method: 'sqlalchemy_inspector';
  sample_rows_read: 0;
  object_count: number;
}

export interface DataQueryCatalog {
  catalog_name: string;
}

export interface DataQueryNamespace {
  catalog_name: string;
  schema_name: string | null;
  namespace_name: string;
  namespace_kind: 'schema' | 'database';
}

export interface DataQueryTable {
  object_ref: DataQueryObjectRef;
  table_type: 'table';
}

export interface DataQueryColumn {
  object_ref: DataQueryObjectRef;
  data_type: string;
  nullable: boolean;
  primary_key: boolean;
}

export interface DataQueryForeignKey {
  constraint_name: string | null;
  constrained_columns: DataQueryObjectRef[];
  referred_table: DataQueryObjectRef;
  referred_columns: DataQueryObjectRef[];
}

export interface DataQueryColumnResult {
  table: DataQueryObjectRef;
  items: DataQueryColumn[];
  primary_key: DataQueryObjectRef[];
  foreign_keys: DataQueryForeignKey[];
  evidence: DataQueryDiscoveryEvidence;
}

export type DataQuerySnapshotJobStatus =
  | 'queued'
  | 'running'
  | 'passed'
  | 'failed'
  | 'cancelled'
  | 'stale';

export interface DataQuerySnapshotJob {
  job_id: string;
  object_key: string;
  revision: number | null;
  snapshot_id: string | null;
  status: DataQuerySnapshotJobStatus;
  progress_current: number;
  progress_total: number;
  stable_code: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

export interface DataQuerySnapshotTable {
  table: DataQueryObjectRef;
  table_type: 'table';
  columns: DataQueryColumn[];
  primary_key: DataQueryObjectRef[];
  foreign_keys: DataQueryForeignKey[];
}

export interface DataQuerySchemaSnapshot {
  snapshot_id: string;
  source_key: string;
  source_type: DataQuerySourceType;
  scope: { catalog_name: string | null; schema_names: string[] };
  structure_hash: string;
  table_count: number;
  column_count: number;
  foreign_key_count: number;
  structure: {
    format_version: 1;
    catalogs: DataQueryCatalog[];
    namespaces: DataQueryNamespace[];
    tables: DataQuerySnapshotTable[];
    sample_rows_read: 0;
  };
  created_at: string;
}

export interface DataQuerySchemaImpact {
  asset_type: 'metric' | 'relationship' | 'policy' | 'row_scope' | 'quality_case';
  asset_key: string;
  object_id: string;
  category: 'removed' | 'changed' | 'permission_lost';
  blocking: true;
}

export interface DataQuerySchemaDiff {
  domain_key: string;
  version_key: string;
  revision: number;
  snapshot_id: string;
  snapshot_hash: string;
  items: Array<{
    category: 'added' | 'removed' | 'changed' | 'permission_lost';
    object_ref: DataQueryObjectRef;
    changed_fields: Array<'data_type' | 'nullable' | 'primary_key'>;
    blocking: boolean;
    dependencies: DataQuerySchemaImpact[];
  }>;
  added_count: number;
  removed_count: number;
  changed_count: number;
  permission_lost_count: number;
  blocking_count: number;
}

export interface DataQuerySchemaImportResult {
  domain_key: string;
  version_key: string;
  revision: number;
  snapshot_id: string;
  snapshot_hash: string;
  table_count: number;
  column_count: number;
  dependency_impacts: DataQuerySchemaImpact[];
  quality_status: 'not_run';
}
