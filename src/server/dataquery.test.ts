import { describe, expect, it } from 'vitest';
import {
  summaryProjectionRuleSchema,
  parseDataQueryConnectionResponse,
  parseDataQuerySchemaDiffResponse,
  parseDataQuerySnapshotJobResponse,
  parseDataQuerySnapshotResponse,
  parseDataQuerySourceDeleteResponse,
  parseDataQuerySourceResponse,
} from './dataquery';

const sourceResponse = {
  source_key: 'orders_readonly',
  name: 'Orders reporting',
  source_type: 'postgresql',
  environment: 'production',
  enabled: true,
  owner_team: 'analytics',
  risk_level: 'medium',
  secret_configured: true,
  credential_state: 'configured',
  last_connection_status: 'passed',
  last_connection_code: 'connection_passed',
  last_tested_at: '2026-07-31T01:02:03Z',
} as const;

describe('data query v2 admin response contracts', () => {
  it('accepts the secret-free source read DTO', () => {
    expect(parseDataQuerySourceResponse(sourceResponse)).toEqual(sourceResponse);
  });

  it('rejects source responses containing a password or DSN', () => {
    expect(() =>
      parseDataQuerySourceResponse({
        ...sourceResponse,
        password: 'must-not-reach-browser',
      }),
    ).toThrow();
    expect(() =>
      parseDataQuerySourceResponse({
        ...sourceResponse,
        dsn: 'postgresql://private',
      }),
    ).toThrow();
  });

  it('rejects source responses containing a secret provider reference', () => {
    expect(() =>
      parseDataQuerySourceResponse({
        ...sourceResponse,
        secret_ref: 'local-encrypted:source/orders',
      }),
    ).toThrow();
  });

  it('validates connection and deletion responses with strict schemas', () => {
    expect(
      parseDataQueryConnectionResponse({
        source_key: 'orders_readonly',
        status: 'passed',
        code: 'connection_passed',
      }),
    ).toEqual({
      source_key: 'orders_readonly',
      status: 'passed',
      code: 'connection_passed',
    });
    expect(
      parseDataQuerySourceDeleteResponse({
        source_key: 'orders_readonly',
        status: 'deleted',
      }),
    ).toEqual({ source_key: 'orders_readonly', status: 'deleted' });
  });

  it('validates resumable snapshot jobs and object-id based schema snapshots', () => {
    const tableId = `dbo_${'a'.repeat(40)}`;
    const columnId = `dbo_${'b'.repeat(40)}`;
    expect(
      parseDataQuerySnapshotJobResponse({
        job_id: '4f036593-d498-48a9-8384-74961f25c496',
        object_key: 'orders_readonly',
        revision: 1,
        snapshot_id: 'c4d95de9-1b4d-4735-bf2b-16ecab30af9c',
        status: 'passed',
        progress_current: 1,
        progress_total: 1,
        stable_code: null,
        created_at: '2026-07-31T01:02:03Z',
        started_at: '2026-07-31T01:02:04Z',
        finished_at: '2026-07-31T01:02:05Z',
      }).status,
    ).toBe('passed');
    const snapshot = parseDataQuerySnapshotResponse({
      snapshot_id: 'c4d95de9-1b4d-4735-bf2b-16ecab30af9c',
      source_key: 'orders_readonly',
      source_type: 'postgresql',
      scope: { catalog_name: 'orders', schema_names: ['Sales Reporting'] },
      structure_hash: 'c'.repeat(64),
      table_count: 1,
      column_count: 1,
      foreign_key_count: 0,
      structure: {
        format_version: 1,
        catalogs: [{ catalog_name: 'orders' }],
        namespaces: [
          {
            catalog_name: 'orders',
            schema_name: 'Sales Reporting',
            namespace_name: 'Sales Reporting',
            namespace_kind: 'schema',
          },
        ],
        tables: [
          {
            table: {
              object_id: tableId,
              kind: 'table',
              catalog_name: 'orders',
              schema_name: 'Sales Reporting',
              table_name: 'Daily Orders',
              column_name: null,
            },
            table_type: 'table',
            columns: [
              {
                object_ref: {
                  object_id: columnId,
                  kind: 'column',
                  catalog_name: 'orders',
                  schema_name: 'Sales Reporting',
                  table_name: 'Daily Orders',
                  column_name: 'Order ID',
                },
                data_type: 'bigint',
                nullable: false,
                primary_key: true,
              },
            ],
            primary_key: [
              {
                object_id: columnId,
                kind: 'column',
                catalog_name: 'orders',
                schema_name: 'Sales Reporting',
                table_name: 'Daily Orders',
                column_name: 'Order ID',
              },
            ],
            foreign_keys: [],
          },
        ],
        sample_rows_read: 0,
      },
      created_at: '2026-07-31T01:02:05Z',
    });
    expect(snapshot.structure.tables[0].table.object_id).toBe(tableId);
    expect(snapshot.structure.tables[0].table.table_name).toBe('Daily Orders');
  });

  it('rejects malformed diff object IDs at the browser boundary', () => {
    expect(() =>
      parseDataQuerySchemaDiffResponse({
        domain_key: 'orders',
        version_key: 'v1',
        revision: 1,
        snapshot_id: 'c4d95de9-1b4d-4735-bf2b-16ecab30af9c',
        snapshot_hash: 'c'.repeat(64),
        items: [
          {
            category: 'added',
            object_ref: {
              object_id: 'Daily Orders',
              kind: 'table',
              catalog_name: 'orders',
              schema_name: 'public',
              table_name: 'Daily Orders',
              column_name: null,
            },
            changed_fields: [],
            blocking: false,
            dependencies: [],
          },
        ],
        added_count: 1,
        removed_count: 0,
        changed_count: 0,
        permission_lost_count: 0,
        blocking_count: 0,
      }),
    ).toThrow();
  });
});

// The same schema is used by draft create/update, so purposes survive the proxy.
it('accepts explicit summary purposes and refuses injected grants or unknown options', () => {
  const rule = {rule_key: 'summary', rule_type: 'summary_projection', enabled: true,
    rule_config: {count_tables: ['table-id'], count_columns: [], distinct_columns: [], group_columns: [], integer_filters: [], text_filters: [], time_columns: [], relationship_keys: []}};
  expect(summaryProjectionRuleSchema.parse(rule)).toEqual(rule);
  expect(() => summaryProjectionRuleSchema.parse({...rule, grants: ['all']})).toThrow();
  expect(() => summaryProjectionRuleSchema.parse({...rule, rule_config: {...rule.rule_config, allow_all: true}})).toThrow();
});
