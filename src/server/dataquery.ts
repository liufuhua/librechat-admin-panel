import { queryOptions } from '@tanstack/react-query';
import { createServerFn } from '@tanstack/react-start';
import { z } from 'zod';
import type * as t from '@/types';
import { apiFetch, extractApiError } from './utils/api';
import { assistantMode } from './utils/assistant';

const sourceSchema = z
  .object({
    source_key: z.string(),
    name: z.string(),
    source_type: z.enum(['postgresql', 'mysql']),
    environment: z.string(),
    enabled: z.boolean(),
    owner_team: z.string().nullable(),
    risk_level: z.enum(['low', 'medium', 'high']),
    secret_configured: z.boolean(),
    credential_state: z.enum([
      'missing',
      'legacy_env',
      'configured',
      'rotation_required',
      'revoked',
    ]),
    last_connection_status: z.enum(['not_tested', 'passed', 'failed', 'stale']),
    last_connection_code: z.string().nullable(),
    last_tested_at: z.string().nullable(),
  })
  .strict();

const connectionSchema = z
  .object({
    source_key: z.string().regex(/^[a-z][a-z0-9_]{1,119}$/),
    status: z.enum(['passed', 'failed']),
    code: z.string(),
  })
  .strict();

const objectRefSchema = z
  .object({
    object_id: z.string().regex(/^dbo_[a-f0-9]{40}$/),
    kind: z.enum(['table', 'column']),
    catalog_name: z.string().nullable(),
    schema_name: z.string().nullable(),
    table_name: z.string(),
    column_name: z.string().nullable(),
  })
  .strict();
const discoveryEvidenceSchema = z
  .object({
    source_key: z.string(),
    source_type: z.enum(['postgresql', 'mysql']),
    method: z.literal('sqlalchemy_inspector'),
    sample_rows_read: z.literal(0),
    object_count: z.number().int().nonnegative(),
  })
  .strict();
const catalogResultSchema = z
  .object({
    items: z.array(z.object({ catalog_name: z.string() }).strict()),
    evidence: discoveryEvidenceSchema,
  })
  .strict();
const namespaceSchema = z
  .object({
    catalog_name: z.string(),
    schema_name: z.string().nullable(),
    namespace_name: z.string(),
    namespace_kind: z.enum(['schema', 'database']),
  })
  .strict();
const namespaceResultSchema = z
  .object({ items: z.array(namespaceSchema), evidence: discoveryEvidenceSchema })
  .strict();
const tableSchema = z
  .object({ object_ref: objectRefSchema, table_type: z.literal('table') })
  .strict();
const tableResultSchema = z
  .object({ items: z.array(tableSchema), evidence: discoveryEvidenceSchema })
  .strict();
const columnSchema = z
  .object({
    object_ref: objectRefSchema,
    data_type: z.string(),
    nullable: z.boolean(),
    primary_key: z.boolean(),
  })
  .strict();
const foreignKeySchema = z
  .object({
    constraint_name: z.string().nullable(),
    constrained_columns: z.array(objectRefSchema),
    referred_table: objectRefSchema,
    referred_columns: z.array(objectRefSchema),
  })
  .strict();
const columnResultSchema = z
  .object({
    table: objectRefSchema,
    items: z.array(columnSchema),
    primary_key: z.array(objectRefSchema),
    foreign_keys: z.array(foreignKeySchema),
    evidence: discoveryEvidenceSchema,
  })
  .strict();
const snapshotJobSchema = z
  .object({
    job_id: z.string().uuid(),
    object_key: z.string(),
    revision: z.number().int().nullable(),
    snapshot_id: z.string().uuid().nullable(),
    status: z.enum(['queued', 'running', 'passed', 'failed', 'cancelled', 'stale']),
    progress_current: z.number().int().nonnegative(),
    progress_total: z.number().int().nonnegative(),
    stable_code: z.string().nullable(),
    created_at: z.string(),
    started_at: z.string().nullable(),
    finished_at: z.string().nullable(),
  })
  .strict();
const snapshotTableSchema = z
  .object({
    table: objectRefSchema,
    table_type: z.literal('table'),
    columns: z.array(columnSchema),
    primary_key: z.array(objectRefSchema),
    foreign_keys: z.array(foreignKeySchema),
  })
  .strict();
const snapshotSchema = z
  .object({
    snapshot_id: z.string().uuid(),
    source_key: z.string(),
    source_type: z.enum(['postgresql', 'mysql']),
    scope: z
      .object({
        catalog_name: z.string().nullable(),
        schema_names: z.array(z.string()),
      })
      .strict(),
    structure_hash: z.string().regex(/^[a-f0-9]{64}$/),
    table_count: z.number().int().nonnegative(),
    column_count: z.number().int().nonnegative(),
    foreign_key_count: z.number().int().nonnegative(),
    structure: z
      .object({
        format_version: z.literal(1),
        catalogs: z.array(z.object({ catalog_name: z.string() }).strict()),
        namespaces: z.array(namespaceSchema),
        tables: z.array(snapshotTableSchema),
        sample_rows_read: z.literal(0),
      })
      .strict(),
    created_at: z.string(),
  })
  .strict();
const schemaImpactSchema = z
  .object({
    asset_type: z.enum(['metric', 'relationship', 'policy', 'row_scope', 'quality_case']),
    asset_key: z.string(),
    object_id: z.string().regex(/^dbo_[a-f0-9]{40}$/),
    category: z.enum(['removed', 'changed', 'permission_lost']),
    blocking: z.literal(true),
  })
  .strict();
const schemaDiffSchema = z
  .object({
    domain_key: z.string(),
    version_key: z.string(),
    revision: z.number().int().positive(),
    snapshot_id: z.string().uuid(),
    snapshot_hash: z.string().regex(/^[a-f0-9]{64}$/),
    items: z.array(
      z
        .object({
          category: z.enum(['added', 'removed', 'changed', 'permission_lost']),
          object_ref: objectRefSchema,
          changed_fields: z.array(z.enum(['data_type', 'nullable', 'primary_key'])),
          blocking: z.boolean(),
          dependencies: z.array(schemaImpactSchema),
        })
        .strict(),
    ),
    added_count: z.number().int().nonnegative(),
    removed_count: z.number().int().nonnegative(),
    changed_count: z.number().int().nonnegative(),
    permission_lost_count: z.number().int().nonnegative(),
    blocking_count: z.number().int().nonnegative(),
  })
  .strict();
const schemaImportResultSchema = z
  .object({
    domain_key: z.string(),
    version_key: z.string(),
    revision: z.number().int().positive(),
    snapshot_id: z.string().uuid(),
    snapshot_hash: z.string().regex(/^[a-f0-9]{64}$/),
    table_count: z.number().int().positive(),
    column_count: z.number().int().positive(),
    dependency_impacts: z.array(schemaImpactSchema),
    quality_status: z.literal('not_run'),
  })
  .strict();

const sourceDeleteSchema = z
  .object({
    source_key: z.string().regex(/^[a-z][a-z0-9_]{1,119}$/),
    status: z.literal('deleted'),
  })
  .strict();

const versionSchema = z
  .object({
    version_key: z.string(),
    status: z.enum(['draft', 'ready', 'published', 'retired']),
    revision: z.number().int().positive(),
    table_count: z.number().int().nonnegative(),
    metric_count: z.number().int().nonnegative(),
    sql_rule_count: z.number().int().nonnegative(),
    access_policy_count: z.number().int().nonnegative(),
    published_at: z.string().nullable(),
    quality_status: z.enum(['not_run', 'running', 'passed', 'failed']),
    quality_blocking_codes: z.array(z.string()),
    quality_checked_at: z.string().nullable(),
    created_at: z.string().nullable(),
  })
  .strict();
const versionMutationSchema = versionSchema.extend({ domain_key: z.string() }).strict();
const policySchema = z
  .object({
  policy_key: z.string(),
  action: z.enum([
    'schema.read',
    'metric.query',
    'sql.generate',
    'sql.execute_generated',
    'sql.execute_direct',
  ]),
  effect: z.enum(['allow', 'deny']),
  tables: z.array(objectRefSchema),
  columns: z.record(z.string(), z.array(objectRefSchema)),
  row_scope: z.array(
    z
      .object({
        table: objectRefSchema,
        column: objectRefSchema,
        operator: z.literal('eq'),
        claim: z.enum(['subject_id', 'org_id']),
      })
      .strict(),
  ),
  max_rows: z.number().int().positive().nullable(),
  max_time_range_days: z.number().int().positive().nullable(),
  priority: z.number().int().min(0).max(1000),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
  enabled: z.boolean(),
  })
  .strict();

const domainSchema = z
  .object({
    domain_key: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    enabled: z.boolean(),
    source_key: z.string(),
    source_type: z.enum(['postgresql', 'mysql']),
    published_version: z.string().nullable(),
    versions: z.array(versionSchema),
  })
  .strict();

const columnDraftSchema = z
  .object({
    object_ref: objectRefSchema,
    data_type: z.string(),
    nullable: z.boolean(),
    sensitive: z.boolean(),
    display_name: z.string().nullable(),
    description: z.string().nullable(),
    synonyms: z.array(z.string()),
  })
  .strict();
const tableDraftSchema = z
  .object({
    object_ref: objectRefSchema,
    display_name: z.string().nullable(),
    description: z.string().nullable(),
    primary_key: z.array(objectRefSchema).min(1),
    time_column: objectRefSchema.nullable(),
    organization_column: objectRefSchema.nullable(),
    columns: z.array(columnDraftSchema).min(1),
  })
  .strict();
const metricSchema = z
  .object({
    metric_type: z.literal('configured'),
    metric_key: z.string(),
    name: z.string(),
    description: z.string().nullable(),
    metric_spec: z
      .object({
        table: objectRefSchema,
        time_column: objectRefSchema.nullable(),
        value_column: objectRefSchema.nullable(),
        aggregation: z.enum(['sum', 'avg', 'min', 'max', 'count', 'latest']),
        dimensions: z.array(objectRefSchema),
        allowed_filters: z.array(objectRefSchema),
        unit: z.string(),
        display_format: z.string(),
        max_time_range_hours: z.number().int().positive(),
      })
      .strict(),
    enabled: z.boolean(),
  })
  .strict();
export const summaryProjectionRuleSchema = z.object({
  rule_key: z.string(),
  rule_type: z.literal('summary_projection'),
  rule_config: z.object({
    count_tables: z.array(z.string()).max(100),
    count_columns: z.array(z.string()).max(500),
    distinct_columns: z.array(z.string()).max(500),
    group_columns: z.array(z.string()).max(500),
    integer_filters: z.array(z.string()).max(500),
    text_filters: z.array(z.string()).max(500),
    time_columns: z.array(z.string()).max(500),
    relationship_keys: z.array(z.string()).max(100),
  }).strict(),
  enabled: z.boolean(),
}).strict();
const sqlRuleSchema = z.discriminatedUnion('rule_type', [
  summaryProjectionRuleSchema,
  z.object({
    rule_key: z.string(),
    rule_type: z.literal('bounded_lookup'),
    rule_config: z.object({ tables: z.array(z.string()).min(1) }).strict(),
    enabled: z.boolean(),
  }).strict(),
  z
    .object({
      rule_key: z.string(),
      rule_type: z.literal('readonly'),
      rule_config: z.object({}).strict(),
      enabled: z.boolean(),
    })
    .strict(),
  z
    .object({
      rule_key: z.string(),
      rule_type: z.literal('limit_required'),
      rule_config: z.object({}).strict(),
      enabled: z.boolean(),
    })
    .strict(),
  z
    .object({
      rule_key: z.string(),
      rule_type: z.literal('time_range_required'),
      rule_config: z.object({ tables: z.array(z.string()).min(1) }).strict(),
      enabled: z.boolean(),
    })
    .strict(),
  z
    .object({
      rule_key: z.string(),
      rule_type: z.literal('schema_evidence_required'),
      rule_config: z.object({ core_tables: z.array(z.string()).min(1) }).strict(),
      enabled: z.boolean(),
    })
    .strict(),
  z
    .object({
      rule_key: z.string(),
      rule_type: z.literal('required_scope_column'),
      rule_config: z.object({ table: z.string(), column: z.string() }).strict(),
      enabled: z.boolean(),
    })
    .strict(),
]);
const queryPatternSchema = z.discriminatedUnion('pattern_type', [
  z
    .object({
      pattern_key: z.string(),
      pattern_type: z.literal('table_selection'),
      pattern_config: z
        .object({
          aliases: z.array(z.string()),
          report_table: z.string(),
          element_table: z.string().nullable(),
          time_column: z.string(),
        })
        .strict(),
      enabled: z.boolean(),
    })
    .strict(),
  z
    .object({
      pattern_key: z.string(),
      pattern_type: z.literal('entity_normalization'),
      pattern_config: z
        .object({
          entity: z.string(),
          format: z.string(),
          lookup_table: z.string(),
          lookup_column: z.string(),
        })
        .strict(),
      enabled: z.boolean(),
    })
    .strict(),
  z
    .object({
      pattern_key: z.string(),
      pattern_type: z.literal('pivot'),
      pattern_config: z
        .object({
          detail_tables: z.array(z.string()),
          pivot_columns: z.array(z.string()),
          value_column: z.string(),
          group_by: z.array(z.string()),
        })
        .strict(),
      enabled: z.boolean(),
    })
    .strict(),
  z
    .object({
      pattern_key: z.string(),
      pattern_type: z.literal('default_constraint'),
      pattern_config: z
        .object({
          default_period: z.string(),
          report_table: z.string(),
          element_table: z.string().nullable(),
        })
        .strict(),
      enabled: z.boolean(),
    })
    .strict(),
]);
const qualityCaseSchema = z.discriminatedUnion('case_type', [
  z
    .object({
      case_key: z.string(),
      case_type: z.literal('result_shape'),
      object_refs: z.array(objectRefSchema),
      expected_tables: z.array(objectRefSchema),
      expected_columns: z.array(z.string()),
      expected_max_rows: z.number().int().positive().nullable(),
    })
    .strict(),
  z
    .object({
      case_key: z.string(),
      case_type: z.literal('schema_table_coverage'),
      expected_table_count: z.number().int().positive(),
      expected_tables: z.array(objectRefSchema),
      source: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      case_key: z.string(),
      case_type: z.literal('query_pattern_coverage'),
      expected_pattern_keys: z.array(z.string()),
      source: z.string().nullable(),
    })
    .strict(),
]);
const domainDraftSchema = z
  .object({
    domain_key: z.string(),
    display_name: z.string(),
    description: z.string().nullable(),
    source_key: z.string(),
    source_type: z.enum(['postgresql', 'mysql']),
    version_key: z.string(),
    default_limit: z.number().int().positive(),
    max_limit: z.number().int().positive(),
    routing_keywords: z.array(z.string()),
    tables: z.array(tableDraftSchema),
    terminology: z.record(z.string(), z.array(z.string())),
    metrics: z.array(metricSchema),
    sql_rules: z.array(sqlRuleSchema),
    relationships: z.array(
      z
        .object({
          relationship_key: z.string(),
          left_table: objectRefSchema,
          left_column: objectRefSchema,
          right_table: objectRefSchema,
          right_column: objectRefSchema,
          join_type: z.enum(['inner', 'left']),
          description: z.string().nullable(),
        })
        .strict(),
    ),
    query_patterns: z.array(queryPatternSchema),
    source_traces: z.array(
      z
        .object({
          source_path: z.string(),
          source_sha256: z.string().regex(/^[a-f0-9]{64}$/),
          disposition: z.enum(['migrated', 'deferred', 'not_migrated']),
          note: z.string().nullable(),
        })
        .strict(),
    ),
    access_policies: z.array(policySchema),
    quality_cases: z.array(qualityCaseSchema),
  })
  .strict();
const versionDetailSchema = versionSchema
  .extend({ domain_key: z.string(), draft: domainDraftSchema })
  .strict();

const auditSchema = z.object({
  id: z.number(),
  request_id: z.string(),
  actor_subject_id: z.string(),
  action: z.string(),
  object_type: z.string(),
  object_key: z.string(),
  reason: z.string().nullable(),
  result: z.string(),
  created_at: z.string().nullable(),
}).strict();
const auditSummarySchema: z.ZodType<t.DataQueryAuditSummary> = z.record(z.string(), z.json());
const auditDetailSchema = auditSchema.extend({
  before_summary: auditSummarySchema,
  after_summary: auditSummarySchema,
}).strict();
const grantSchema = z.object({
  grant_id: z.number(),
  subject_type: z.enum(['user', 'role', 'organization']),
  subject_key: z.string(),
  effect: z.enum(['allow', 'deny']),
  actions: z.array(z.string()),
  enabled: z.boolean(),
  starts_at: z.string().nullable(),
  ends_at: z.string().nullable(),
});

const qualityCheckSchema = z.object({
  check_key: z.string(),
  status: z.enum(['passed', 'failed', 'skipped']),
  severity: z.enum(['blocking', 'warning']),
  stable_code: z.string().nullable(),
  summary: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])),
}).strict();
const qualityRunSchema: z.ZodType<t.DataQueryQualityRun> = z.object({
  quality_run_id: z.string().uuid(),
  job_id: z.string().uuid(),
  revision: z.number().int().positive(),
  status: z.enum(['queued', 'running', 'passed', 'failed', 'stale']),
  progress_current: z.number().int().nonnegative(),
  progress_total: z.number().int().nonnegative(),
  stable_code: z.string().nullable(),
  blocking_codes: z.array(z.string()),
  warning_codes: z.array(z.string()),
  checks: z.array(qualityCheckSchema),
  schema_snapshot_hash: z.string().nullable(),
  created_at: z.string().nullable(),
  started_at: z.string().nullable(),
  finished_at: z.string().nullable(),
}).strict();

const credentialBase = {
  host: z.string().min(1).max(253),
  port: z.number().int().min(1).max(65_535),
  database: z.string().min(1).max(256),
  username: z.string().min(1).max(256),
  password: z.string().min(1).max(4096),
  caSecretRef: z.string().min(1).max(500).nullable(),
  connectTimeoutSeconds: z.number().int().min(1).max(60),
};
const credentialInputSchema = z.discriminatedUnion('sourceType', [
  z
    .object({
      ...credentialBase,
      sourceType: z.literal('postgresql'),
      sslMode: z
        .enum(['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'])
        .nullable(),
    })
    .strict(),
  z
    .object({
      ...credentialBase,
      sourceType: z.literal('mysql'),
      tlsMode: z
        .enum(['disabled', 'preferred', 'required', 'verify-ca', 'verify-identity'])
        .nullable(),
    })
    .strict(),
]);

const sourceInputSchema = z
  .object({
    sourceKey: z.string().regex(/^[a-z][a-z0-9_]{1,119}$/),
    name: z.string().min(1).max(200),
    sourceType: z.enum(['postgresql', 'mysql']),
    credential: credentialInputSchema,
    environment: z.string().min(1).max(40),
    ownerTeam: z.string().max(120),
    riskLevel: z.enum(['low', 'medium', 'high']),
    reason: z.string().min(1).max(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.sourceType === value.credential.sourceType) return;
    context.addIssue({
      code: 'custom',
      message: 'source_credential_type_mismatch',
      path: ['credential', 'sourceType'],
    });
  });

const sourceKeySchema = z.string().regex(/^[a-z][a-z0-9_]{1,119}$/);
const nativeIdentifierSchema = z
  .string()
  .min(1)
  .max(256)
  .refine((value) => !/[\u0000-\u001f]/.test(value));
const discoveryScopeSchema = z
  .object({
    sourceKey: sourceKeySchema,
    catalog: nativeIdentifierSchema.nullable(),
    schema: nativeIdentifierSchema.nullable(),
  })
  .strict();
const columnDiscoverySchema = discoveryScopeSchema
  .extend({ table: nativeIdentifierSchema })
  .strict();
const snapshotCreateSchema = z
  .object({
    sourceKey: sourceKeySchema,
    catalog: nativeIdentifierSchema.nullable(),
    schemas: z.array(nativeIdentifierSchema).max(200),
    reason: z.string().min(1).max(500),
  })
  .strict();
const snapshotLookupSchema = z
  .object({
    sourceKey: sourceKeySchema,
    id: z.string().uuid(),
  })
  .strict();
const schemaDiffInputSchema = z
  .object({
    domainKey: z.string().min(1),
    versionKey: z.string().min(1),
    snapshotId: z.string().uuid(),
    reason: z.string().min(1).max(500),
  })
  .strict();
const schemaImportInputSchema = schemaDiffInputSchema
  .extend({
    selectedObjectIds: z.array(z.string().regex(/^dbo_[a-f0-9]{40}$/)).min(1),
    expectedRevision: z.number().int().positive(),
  })
  .strict();
const reasonInputSchema = z
  .object({
    sourceKey: sourceKeySchema,
    reason: z.string().min(1).max(500),
  })
  .strict();
const enabledInputSchema = reasonInputSchema.extend({ enabled: z.boolean() });
const sourceMetadataInputSchema = z
  .object({
    sourceKey: sourceKeySchema,
    name: z.string().min(1).max(200).optional(),
    environment: z.string().min(1).max(40).optional(),
    ownerTeam: z.string().max(120).nullable().optional(),
    riskLevel: z.enum(['low', 'medium', 'high']).optional(),
    reason: z.string().min(1).max(500),
  })
  .strict()
  .refine(
    (value) =>
      value.name !== undefined ||
      value.environment !== undefined ||
      value.ownerTeam !== undefined ||
      value.riskLevel !== undefined,
    { message: 'source_update_requires_change' },
  );
const sourceCredentialInputSchema = z
  .object({
    sourceKey: sourceKeySchema,
    credential: credentialInputSchema,
    requireConnectionSuccess: z.boolean(),
    reason: z.string().min(1).max(500),
  })
  .strict();
const versionActionSchema = z.object({
  domainKey: z.string(),
  versionKey: z.string(),
  expectedRevision: z.number().int().positive(),
  reason: z.string().min(1).max(500),
});
const policyInputSchema = z.object({
  domainKey: z.string().min(1),
  versionKey: z.string().min(1),
  policyKey: z.string().regex(/^[a-z][a-z0-9_]{1,119}$/),
  action: z.enum([
    'schema.read',
    'metric.query',
    'sql.generate',
    'sql.execute_generated',
    'sql.execute_direct',
  ]),
  effect: z.enum(['allow', 'deny']),
  tables: z.array(z.string().min(1)).min(1),
  columns: z.record(z.string(), z.array(z.string())),
  rowScope: z.array(
    z.object({ table: z.string(), column: z.string(), claim: z.enum(['subject_id', 'org_id']) }),
  ),
  maxRows: z.number().int().positive().nullable(),
  maxTimeRangeDays: z.number().int().positive().nullable(),
  priority: z.number().int().min(0).max(1000),
  expectedRevision: z.number().int().positive(),
  reason: z.string().min(1).max(500),
});
const policyEnabledInputSchema = z.object({
  domainKey: z.string(),
  versionKey: z.string(),
  policyKey: z.string(),
  enabled: z.boolean(),
  expectedRevision: z.number().int().positive(),
  reason: z.string().min(1).max(500),
});
const grantInputSchema = z.object({
  domainKey: z.string(),
  subjectType: z.enum(['user', 'role', 'organization']),
  subjectKey: z.string().min(1).max(160),
  effect: z.enum(['allow', 'deny']),
  actions: z
    .array(
      z.enum([
        'source.manage',
        'source.test',
        'domain.read',
        'domain.draft.manage',
        'domain.publish',
        'domain.rollback',
        'grant.manage',
        'schema.read',
        'metric.query',
        'sql.generate',
        'sql.execute_generated',
        'sql.execute_direct',
        'result.read_own',
        'result.read_shared',
        'audit.read',
      ]),
    )
    .min(1),
  startsAt: z.string().datetime({ offset: true }).nullable(),
  endsAt: z.string().datetime({ offset: true }).nullable(),
  reason: z.string().min(1).max(500),
}).refine((value) => value.startsAt == null || value.endsAt == null || new Date(value.endsAt) > new Date(value.startsAt), { message: 'grant_time_window_invalid' });
const grantEnabledInputSchema = z.object({
  domainKey: z.string().min(1),
  grantId: z.number().int().positive(),
  enabled: z.boolean(),
  reason: z.string().min(1).max(500),
});
const fullDomainDraftInputSchema = z
  .object({
    draft: domainDraftSchema,
    snapshot_id: z.string().min(1).max(120).optional(),
    reason: z.string().min(1).max(500),
  })
  .strict();
const fullDomainDraftUpdateInputSchema = fullDomainDraftInputSchema
  .extend({
    domainKey: z.string().regex(/^[a-z][a-z0-9_]{1,119}$/),
    versionKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/),
    expectedRevision: z.number().int().positive(),
  })
  .strict();
const domainEnabledInputSchema = z
  .object({
    domainKey: z.string().regex(/^[a-z][a-z0-9_]{1,119}$/),
    enabled: z.boolean(),
    reason: z.string().min(1).max(500),
  })
  .strict();
const cloneVersionInputSchema = z
  .object({
    domainKey: z.string().regex(/^[a-z][a-z0-9_]{1,119}$/),
    versionKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/),
    newVersionKey: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/),
    reason: z.string().min(1).max(500),
  })
  .strict();

export const parseDataQuerySourceResponse = (value: object): t.DataQuerySource =>
  sourceSchema.parse(value);
export const parseDataQueryConnectionResponse = (value: object): t.DataQueryConnectionResult =>
  connectionSchema.parse(value);
export const parseDataQuerySourceDeleteResponse = (
  value: object,
): { source_key: string; status: 'deleted' } => sourceDeleteSchema.parse(value);
export const parseDataQuerySnapshotJobResponse = (value: object): t.DataQuerySnapshotJob =>
  snapshotJobSchema.parse(value);
export const parseDataQuerySnapshotResponse = (value: object): t.DataQuerySchemaSnapshot =>
  snapshotSchema.parse(value);
export const parseDataQuerySchemaDiffResponse = (value: object): t.DataQuerySchemaDiff =>
  schemaDiffSchema.parse(value);

const credentialPayload = (credential: z.infer<typeof credentialInputSchema>) => {
  const common = {
    source_type: credential.sourceType,
    host: credential.host,
    port: credential.port,
    database: credential.database,
    username: credential.username,
    password: credential.password,
    ca_secret_ref: credential.caSecretRef,
    connect_timeout_seconds: credential.connectTimeoutSeconds,
  };
  return credential.sourceType === 'postgresql'
    ? { ...common, ssl_mode: credential.sslMode }
    : { ...common, tls_mode: credential.tlsMode };
};

export const listDataQuerySourcesFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<t.DataQuerySource[]> => {
    const response = await apiFetch('/api/admin/data-query-v2/sources');
    if (!response.ok) await extractApiError(response, 'Failed to fetch data sources');
    return z.object({ items: z.array(sourceSchema) }).parse(await response.json()).items;
  },
);

export const listDataQueryDomainsFn = createServerFn({ method: 'GET' }).handler(
  async (): Promise<t.DataQueryDomain[]> => {
    const response = await apiFetch('/api/admin/data-query-v2/domains');
    if (!response.ok) await extractApiError(response, 'Failed to fetch data domains');
    return z.object({ items: z.array(domainSchema) }).parse(await response.json()).items;
  },
);

const auditFilterInputSchema = z.object({
  actorSubjectId: z.string().max(160).optional(), action: z.string().max(80).optional(),
  objectType: z.string().max(80).optional(), objectKey: z.string().max(200).optional(),
  result: z.string().max(30).optional(), requestId: z.string().max(160).optional(),
  createdAfter: z.string().datetime({ offset: true }).optional(), createdBefore: z.string().datetime({ offset: true }).optional(),
  offset: z.number().int().nonnegative().optional(), limit: z.number().int().min(1).max(200).optional(),
}).strict();
export const listDataQueryAuditsFn = createServerFn({ method: 'GET' }).inputValidator(auditFilterInputSchema).handler(
  async ({ data }): Promise<t.DataQueryAudit[]> => {
    const query = new URLSearchParams({ limit: String(data.limit ?? 50) });
    const pairs: Array<[string, string | number | undefined]> = [
      ['actor_subject_id', data.actorSubjectId], ['action', data.action], ['object_type', data.objectType], ['object_key', data.objectKey], ['result', data.result], ['request_id', data.requestId], ['created_after', data.createdAfter], ['created_before', data.createdBefore], ['offset', data.offset],
    ];
    pairs.forEach(([key, value]) => { if (value !== undefined && value !== '') query.set(key, String(value)); });
    const response = await apiFetch(`/api/admin/data-query-v2/audits?${query.toString()}`);
    if (!response.ok) await extractApiError(response, 'Failed to fetch data query audit entries');
    const parsed = z.object({ items: z.array(auditSchema), next_offset: z.number().nullable() }).strict().parse(await response.json());
    return parsed.items;
  },
);

export const getDataQueryAuditFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ auditId: z.number().int().positive() }).strict())
  .handler(async ({ data }): Promise<t.DataQueryAuditDetail> => {
    const response = await apiFetch(`/api/admin/data-query-v2/audits/${data.auditId}`);
    if (!response.ok) await extractApiError(response, 'Failed to fetch audit detail');
    return auditDetailSchema.parse(await response.json());
  });

export const getDataQueryCurrentOrganizationFn = createServerFn({ method: 'GET' })
  .handler(async (): Promise<{ organizationKey: string }> => {
    const response = await apiFetch('/api/admin/data-query-v2/subjects/current-organization');
    if (!response.ok) await extractApiError(response, 'Failed to fetch current organization');
    return z.object({ organization_key: z.string().min(1).max(160) }).strict().transform((value) => ({ organizationKey: value.organization_key })).parse(await response.json());
  });

export const createDataQuerySourceFn = createServerFn({ method: 'POST' })
  .inputValidator(sourceInputSchema)
  .handler(async ({ data }): Promise<t.DataQuerySource> => {
    const response = await apiFetch('/api/admin/data-query-v2/sources', {
      method: 'POST',
      body: JSON.stringify({
        source_key: data.sourceKey,
        name: data.name,
        source_type: data.sourceType,
        credential: credentialPayload(data.credential),
        environment: data.environment,
        owner_team: data.ownerTeam || null,
        risk_level: data.riskLevel,
        reason: data.reason,
      }),
    });
    if (!response.ok) await extractApiError(response, 'Failed to create data source');
    return parseDataQuerySourceResponse(await response.json());
  });

export const getDataQuerySourceFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ sourceKey: sourceKeySchema }).strict())
  .handler(async ({ data }): Promise<t.DataQuerySource> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/sources/${encodeURIComponent(data.sourceKey)}`,
    );
    if (!response.ok) await extractApiError(response, 'Failed to fetch data source');
    return parseDataQuerySourceResponse(await response.json());
  });

export const updateDataQuerySourceFn = createServerFn({ method: 'POST' })
  .inputValidator(sourceMetadataInputSchema)
  .handler(async ({ data }): Promise<t.DataQuerySource> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/sources/${encodeURIComponent(data.sourceKey)}`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          name: data.name,
          environment: data.environment,
          owner_team: data.ownerTeam,
          risk_level: data.riskLevel,
          reason: data.reason,
        }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to update data source');
    return parseDataQuerySourceResponse(await response.json());
  });

export const updateDataQuerySourceCredentialFn = createServerFn({ method: 'POST' })
  .inputValidator(sourceCredentialInputSchema)
  .handler(async ({ data }): Promise<t.DataQuerySource> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/sources/${encodeURIComponent(data.sourceKey)}/credential`,
      {
        method: 'PUT',
        body: JSON.stringify({
          credential: credentialPayload(data.credential),
          require_connection_success: data.requireConnectionSuccess,
          reason: data.reason,
        }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to rotate data source credential');
    return parseDataQuerySourceResponse(await response.json());
  });

export const deleteDataQuerySourceFn = createServerFn({ method: 'POST' })
  .inputValidator(reasonInputSchema)
  .handler(async ({ data }): Promise<void> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/sources/${encodeURIComponent(data.sourceKey)}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ reason: data.reason }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to delete data source');
    parseDataQuerySourceDeleteResponse(await response.json());
  });

export const testDataQuerySourceFn = createServerFn({ method: 'POST' })
  .inputValidator(reasonInputSchema)
  .handler(async ({ data }): Promise<t.DataQueryConnectionResult> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/sources/${encodeURIComponent(data.sourceKey)}/connection-test`,
      {
        method: 'POST',
        body: JSON.stringify({ reason: data.reason }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to test data source connection');
    return parseDataQueryConnectionResponse(await response.json());
  });

const discoveryQuery = (catalog: string | null, schema: string | null, table?: string): string => {
  const params = new URLSearchParams();
  if (catalog !== null) params.set('catalog', catalog);
  if (schema !== null) params.set('schema', schema);
  if (table !== undefined) params.set('table', table);
  const value = params.toString();
  return value ? `?${value}` : '';
};

export const listDataQueryCatalogsFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ sourceKey: sourceKeySchema }).strict())
  .handler(async ({ data }): Promise<t.DataQueryCatalog[]> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/sources/${encodeURIComponent(data.sourceKey)}/catalogs`,
    );
    if (!response.ok) await extractApiError(response, 'Failed to discover catalogs');
    return catalogResultSchema.parse(await response.json()).items;
  });

export const listDataQuerySchemasFn = createServerFn({ method: 'GET' })
  .inputValidator(discoveryScopeSchema.pick({ sourceKey: true, catalog: true }))
  .handler(async ({ data }): Promise<t.DataQueryNamespace[]> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/sources/${encodeURIComponent(data.sourceKey)}/schemas${discoveryQuery(data.catalog, null)}`,
    );
    if (!response.ok) await extractApiError(response, 'Failed to discover schemas');
    return namespaceResultSchema.parse(await response.json()).items;
  });

export const listDataQueryTablesFn = createServerFn({ method: 'GET' })
  .inputValidator(discoveryScopeSchema)
  .handler(async ({ data }): Promise<t.DataQueryTable[]> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/sources/${encodeURIComponent(data.sourceKey)}/tables${discoveryQuery(data.catalog, data.schema)}`,
    );
    if (!response.ok) await extractApiError(response, 'Failed to discover tables');
    return tableResultSchema.parse(await response.json()).items;
  });

export const listDataQueryColumnsFn = createServerFn({ method: 'GET' })
  .inputValidator(columnDiscoverySchema)
  .handler(async ({ data }): Promise<t.DataQueryColumnResult> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/sources/${encodeURIComponent(data.sourceKey)}/columns${discoveryQuery(data.catalog, data.schema, data.table)}`,
    );
    if (!response.ok) await extractApiError(response, 'Failed to discover columns');
    return columnResultSchema.parse(await response.json());
  });

export const createDataQuerySnapshotJobFn = createServerFn({ method: 'POST' })
  .inputValidator(snapshotCreateSchema)
  .handler(async ({ data }): Promise<t.DataQuerySnapshotJob> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/sources/${encodeURIComponent(data.sourceKey)}/schema-snapshot-jobs`,
      {
        method: 'POST',
        body: JSON.stringify({
          scope: { catalog_name: data.catalog, schema_names: data.schemas },
          reason: data.reason,
        }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to create schema snapshot');
    return snapshotJobSchema.parse(await response.json());
  });

export const getDataQuerySnapshotJobFn = createServerFn({ method: 'GET' })
  .inputValidator(snapshotLookupSchema)
  .handler(async ({ data }): Promise<t.DataQuerySnapshotJob> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/sources/${encodeURIComponent(data.sourceKey)}/schema-snapshot-jobs/${encodeURIComponent(data.id)}`,
    );
    if (!response.ok) await extractApiError(response, 'Failed to fetch schema snapshot job');
    return snapshotJobSchema.parse(await response.json());
  });

export const getDataQuerySnapshotFn = createServerFn({ method: 'GET' })
  .inputValidator(snapshotLookupSchema)
  .handler(async ({ data }): Promise<t.DataQuerySchemaSnapshot> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/sources/${encodeURIComponent(data.sourceKey)}/schema-snapshots/${encodeURIComponent(data.id)}`,
    );
    if (!response.ok) await extractApiError(response, 'Failed to fetch schema snapshot');
    return snapshotSchema.parse(await response.json());
  });

export const diffDataQueryDomainSchemaFn = createServerFn({ method: 'POST' })
  .inputValidator(schemaDiffInputSchema)
  .handler(async ({ data }): Promise<t.DataQuerySchemaDiff> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}/schema/diff`,
      {
        method: 'POST',
        body: JSON.stringify({ snapshot_id: data.snapshotId, reason: data.reason }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to compare schema snapshot');
    return schemaDiffSchema.parse(await response.json());
  });

export const importDataQueryDomainSchemaFn = createServerFn({ method: 'POST' })
  .inputValidator(schemaImportInputSchema)
  .handler(async ({ data }): Promise<t.DataQuerySchemaImportResult> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}/schema/import`,
      {
        method: 'POST',
        body: JSON.stringify({
          snapshot_id: data.snapshotId,
          selected_object_ids: data.selectedObjectIds,
          table_overrides: [],
          field_overrides: [],
          expected_revision: data.expectedRevision,
          reason: data.reason,
        }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to import schema snapshot');
    return schemaImportResultSchema.parse(await response.json());
  });

export const setDataQuerySourceEnabledFn = createServerFn({ method: 'POST' })
  .inputValidator(enabledInputSchema)
  .handler(async ({ data }): Promise<t.DataQuerySource> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/sources/${encodeURIComponent(data.sourceKey)}/enabled`,
      {
        method: 'PATCH',
        body: JSON.stringify({ enabled: data.enabled, reason: data.reason }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to update data source status');
    return parseDataQuerySourceResponse(await response.json());
  });

export const runDataQueryQualityFn = createServerFn({ method: 'POST' })
  .inputValidator(versionActionSchema)
  .handler(async ({ data }): Promise<t.DataQueryQualityRun> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}/quality-runs`,
      {
        method: 'POST',
        body: JSON.stringify({ expected_revision: data.expectedRevision, reason: data.reason }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to run domain quality checks');
    return qualityRunSchema.parse(await response.json());
  });

export const getLatestDataQueryQualityRunFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ domainKey: z.string().min(1), versionKey: z.string().min(1) }))
  .handler(async ({ data }): Promise<t.DataQueryQualityRun | null> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}/quality-runs/latest`,
    );
    if (response.status === 404) return null;
    if (!response.ok) await extractApiError(response, 'Failed to load the latest quality run');
    return qualityRunSchema.parse(await response.json());
  });

export const publishDataQueryVersionFn = createServerFn({ method: 'POST' })
  .inputValidator(versionActionSchema)
  .handler(async ({ data }): Promise<t.DataQueryVersionSummary> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}/publish`,
      {
        method: 'POST',
        body: JSON.stringify({ expected_revision: data.expectedRevision, reason: data.reason }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to publish domain version');
    return versionMutationSchema.parse(await response.json());
  });

export const rollbackDataQueryVersionFn = createServerFn({ method: 'POST' })
  .inputValidator(versionActionSchema)
  .handler(async ({ data }): Promise<t.DataQueryVersionSummary> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}/rollback`,
      {
        method: 'POST',
        body: JSON.stringify({ expected_revision: data.expectedRevision, reason: data.reason }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to roll back domain version');
    return versionMutationSchema.parse(await response.json());
  });

export const createDataQueryGrantFn = createServerFn({ method: 'POST' })
  .inputValidator(grantInputSchema)
  .handler(async ({ data }): Promise<void> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/grants`,
      {
        method: 'POST',
        body: JSON.stringify({
          subject_type: data.subjectType,
          subject_key: data.subjectKey,
          effect: data.effect,
          actions: data.actions,
          starts_at: data.startsAt,
          ends_at: data.endsAt,
          reason: data.reason,
        }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to create domain authorization');
  });

export const listDataQueryGrantsFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ domainKey: z.string().min(1) }))
  .handler(async ({ data }): Promise<t.DataQueryGrant[]> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/grants`,
    );
    if (!response.ok) await extractApiError(response, 'Failed to fetch domain authorizations');
    const grants = z.object({ items: z.array(grantSchema) }).parse(await response.json()).items;
    if (!grants.some((grant) => grant.subject_type === 'user')) return grants;

    // Use the caller's account directory so historical grants reflect current names.
    const local = assistantMode();
    const directory = await apiFetch(local ? '/api/admin/accounts' : '/api/admin/users');
    if (!directory.ok) return grants;
    const accounts = await directory.json();
    const users = z.array(z.object({ id: z.string(), name: z.string().nullish() }))
      .parse(local ? accounts.items : accounts.users);
    const names = new Map(users.map((user) => [user.id, user.name?.trim()]));
    return grants.map((grant) => grant.subject_type === 'user'
      ? { ...grant, subject_name: names.get(grant.subject_key) }
      : grant);
  });

export const updateDataQueryGrantActionsFn = createServerFn({ method: 'POST' })
  .inputValidator(z.object({
    domainKey: z.string().min(1), grantId: z.number().int().positive(),
    actions: z.array(z.string()).min(1), expectedActions: z.array(z.string()),
    reason: z.string().trim().min(1).max(500),
  }))
  .handler(async ({ data }) => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/grants/${data.grantId}/actions`,
      { method: 'PATCH', body: JSON.stringify({ actions: data.actions, expected_actions: data.expectedActions, reason: data.reason }) },
    );
    if (response.status === 409) return { conflict: true };
    if (!response.ok) await extractApiError(response, 'Failed to update authorization');
    return { conflict: false };
  });

export const setDataQueryGrantEnabledFn = createServerFn({ method: 'POST' })
  .inputValidator(grantEnabledInputSchema)
  .handler(async ({ data }): Promise<t.DataQueryGrant> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/grants/${data.grantId}/enabled`,
      { method: 'PATCH', body: JSON.stringify({ enabled: data.enabled, reason: data.reason }) },
    );
    if (!response.ok) await extractApiError(response, 'Failed to update domain authorization');
    return grantSchema.parse(await response.json());
  });

export const getDataQueryVersionFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ domainKey: z.string().min(1), versionKey: z.string().min(1) }))
  .handler(async ({ data }): Promise<t.DataQueryDomainVersionDetail> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}`,
    );
    if (!response.ok) await extractApiError(response, 'Failed to fetch domain version');
    return versionDetailSchema.parse(await response.json());
  });

export const createDataQueryFullDomainDraftFn = createServerFn({ method: 'POST' })
  .inputValidator(fullDomainDraftInputSchema)
  .handler(async ({ data }): Promise<t.DataQueryVersionSummary> => {
    const response = await apiFetch('/api/admin/data-query-v2/domains/drafts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!response.ok) await extractApiError(response, 'Failed to create domain draft');
    return versionMutationSchema.parse(await response.json());
  });

export const updateDataQueryDomainDraftFn = createServerFn({ method: 'POST' })
  .inputValidator(fullDomainDraftUpdateInputSchema)
  .handler(async ({ data }): Promise<t.DataQueryVersionSummary> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}/draft`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          draft: data.draft,
          expected_revision: data.expectedRevision,
          reason: data.reason,
        }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to update domain draft');
    return versionMutationSchema.parse(await response.json());
  });

export const setDataQueryDomainEnabledFn = createServerFn({ method: 'POST' })
  .inputValidator(domainEnabledInputSchema)
  .handler(async ({ data }): Promise<t.DataQueryDomain> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/enabled`,
      {
        method: 'PATCH',
        body: JSON.stringify({ enabled: data.enabled, reason: data.reason }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to update domain status');
    return domainSchema.parse(await response.json());
  });

export const cloneDataQueryVersionFn = createServerFn({ method: 'POST' })
  .inputValidator(cloneVersionInputSchema)
  .handler(async ({ data }): Promise<t.DataQueryVersionSummary> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}/clone`,
      {
        method: 'POST',
        body: JSON.stringify({ new_version_key: data.newVersionKey, reason: data.reason }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to clone domain version');
    return versionMutationSchema.parse(await response.json());
  });

export const reopenDataQueryVersionFn = createServerFn({ method: 'POST' })
  .inputValidator(versionActionSchema)
  .handler(async ({ data }): Promise<t.DataQueryVersionSummary> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}/reopen`,
      {
        method: 'POST',
        body: JSON.stringify({ expected_revision: data.expectedRevision, reason: data.reason }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to reopen domain version');
    return versionMutationSchema.parse(await response.json());
  });

export const listDataQueryPoliciesFn = createServerFn({ method: 'GET' })
  .inputValidator(z.object({ domainKey: z.string().min(1), versionKey: z.string().min(1) }))
  .handler(async ({ data }): Promise<t.DataQueryAccessPolicy[]> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}/policies`,
    );
    if (!response.ok) await extractApiError(response, 'Failed to fetch access policies');
    return z.object({ items: z.array(policySchema) }).parse(await response.json()).items;
  });

const policyPayload = (data: z.infer<typeof policyInputSchema>) => ({
  expected_revision: data.expectedRevision,
  reason: data.reason,
  policy: {
    policy_key: data.policyKey,
    action: data.action,
    effect: data.effect,
    tables: data.tables,
    columns: data.columns,
    row_scope: data.rowScope.map((scope) => ({ ...scope, operator: 'eq' })),
    max_rows: data.maxRows,
    max_time_range_days: data.maxTimeRangeDays,
    priority: data.priority,
    enabled: true,
  },
});
export const createDataQueryPolicyFn = createServerFn({ method: 'POST' })
  .inputValidator(policyInputSchema)
  .handler(async ({ data }): Promise<void> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}/policies`,
      { method: 'POST', body: JSON.stringify(policyPayload(data)) },
    );
    if (!response.ok) await extractApiError(response, 'Failed to create access policy');
  });
export const updateDataQueryPolicyFn = createServerFn({ method: 'POST' })
  .inputValidator(policyInputSchema)
  .handler(async ({ data }): Promise<void> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}/policies/${encodeURIComponent(data.policyKey)}`,
      { method: 'PATCH', body: JSON.stringify(policyPayload(data)) },
    );
    if (!response.ok) await extractApiError(response, 'Failed to update access policy');
  });
export const setDataQueryPolicyEnabledFn = createServerFn({ method: 'POST' })
  .inputValidator(policyEnabledInputSchema)
  .handler(async ({ data }): Promise<void> => {
    const response = await apiFetch(
      `/api/admin/data-query-v2/domains/${encodeURIComponent(data.domainKey)}/versions/${encodeURIComponent(data.versionKey)}/policies/${encodeURIComponent(data.policyKey)}/enabled`,
      {
        method: 'PATCH',
        body: JSON.stringify({
          enabled: data.enabled,
          expected_revision: data.expectedRevision,
          reason: data.reason,
        }),
      },
    );
    if (!response.ok) await extractApiError(response, 'Failed to update access policy');
  });

export const dataQuerySourcesOptions = queryOptions({
  queryKey: ['data-query-v2', 'sources'],
  queryFn: () => listDataQuerySourcesFn(),
});
export const dataQuerySourceOptions = (sourceKey: string) =>
  queryOptions({
    queryKey: ['data-query-v2', 'sources', sourceKey],
    queryFn: () => getDataQuerySourceFn({ data: { sourceKey } }),
  });
export const dataQueryCatalogsOptions = (sourceKey: string) =>
  queryOptions({
    queryKey: ['data-query-v2', 'discovery', sourceKey, 'catalogs'],
    queryFn: () => listDataQueryCatalogsFn({ data: { sourceKey } }),
  });
export const dataQuerySchemasOptions = (sourceKey: string, catalog: string | null) =>
  queryOptions({
    queryKey: ['data-query-v2', 'discovery', sourceKey, 'schemas', catalog],
    queryFn: () => listDataQuerySchemasFn({ data: { sourceKey, catalog } }),
  });
export const dataQueryTablesOptions = (
  sourceKey: string,
  catalog: string | null,
  schema: string | null,
) =>
  queryOptions({
    queryKey: ['data-query-v2', 'discovery', sourceKey, 'tables', catalog, schema],
    queryFn: () => listDataQueryTablesFn({ data: { sourceKey, catalog, schema } }),
  });
export const dataQueryColumnsOptions = (
  sourceKey: string,
  catalog: string | null,
  schema: string | null,
  table: string,
) =>
  queryOptions({
    queryKey: ['data-query-v2', 'discovery', sourceKey, 'columns', catalog, schema, table],
    queryFn: () => listDataQueryColumnsFn({ data: { sourceKey, catalog, schema, table } }),
  });
export const dataQueryDomainsOptions = queryOptions({
  queryKey: ['data-query-v2', 'domains'],
  queryFn: () => listDataQueryDomainsFn(),
});
export const dataQueryAuditsOptions = queryOptions({
  queryKey: ['data-query-v2', 'audits'],
  queryFn: () => listDataQueryAuditsFn({ data: {} }),
});
