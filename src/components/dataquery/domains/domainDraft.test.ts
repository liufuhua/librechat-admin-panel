import { describe, expect, it } from 'vitest';
import type * as t from '@/types';
import {
  buildDomainDraft,
  domainDraftCreateInput,
  domainQuality,
  initialTableMetadata,
  validateDomainSelection,
  type StoredDomainSelection,
} from './domainDraft';

const tableRef: t.DataQueryObjectRef = {
  object_id: `dbo_${'a'.repeat(40)}`,
  kind: 'table',
  catalog_name: null,
  schema_name: 'public',
  table_name: 'orders',
  column_name: null,
};
const idRef: t.DataQueryObjectRef = {
  object_id: `dbo_${'b'.repeat(40)}`,
  kind: 'column',
  catalog_name: null,
  schema_name: 'public',
  table_name: 'orders',
  column_name: 'id',
};
const amountRef: t.DataQueryObjectRef = {
  object_id: `dbo_${'c'.repeat(40)}`,
  kind: 'column',
  catalog_name: null,
  schema_name: 'public',
  table_name: 'orders',
  column_name: 'amount',
};
const selection: StoredDomainSelection = {
  selectedObjectIds: [tableRef.object_id, idRef.object_id, amountRef.object_id],
  snapshot: {
    snapshot_id: '11111111-1111-4111-8111-111111111111',
    source_key: 'shop_readonly',
    source_type: 'postgresql',
    scope: { catalog_name: null, schema_names: ['public'] },
    structure_hash: 'a'.repeat(64),
    table_count: 1,
    column_count: 2,
    foreign_key_count: 0,
    structure: {
      format_version: 1,
      catalogs: [],
      namespaces: [
        {
          catalog_name: 'shop',
          schema_name: 'public',
          namespace_name: 'public',
          namespace_kind: 'schema',
        },
      ],
      tables: [
        {
          table: tableRef,
          table_type: 'table',
          columns: [
            { object_ref: idRef, data_type: 'bigint', nullable: false, primary_key: true },
            { object_ref: amountRef, data_type: 'numeric', nullable: false, primary_key: false },
          ],
          primary_key: [idRef],
          foreign_keys: [],
        },
      ],
      sample_rows_read: 0,
    },
    created_at: '2026-07-31T00:00:00Z',
  },
};
const source: t.DataQuerySource = {
  source_key: 'shop_readonly',
  name: 'Shop',
  source_type: 'postgresql',
  environment: 'test',
  enabled: true,
  owner_team: null,
  risk_level: 'medium',
  secret_configured: true,
  credential_state: 'configured',
  last_connection_status: 'passed',
  last_connection_code: 'connection_passed',
  last_tested_at: '2026-07-31T00:00:00Z',
};

describe('domain draft builder', () => {
  it('builds a complete strict draft from snapshot-issued object references', () => {
    const metadata = initialTableMetadata(selection);
    metadata[tableRef.object_id].sensitiveColumnObjectIds = [amountRef.object_id];
    metadata[tableRef.object_id].timeColumnObjectId = idRef.object_id;

    const draft = buildDomainDraft(
      source,
      selection,
      {
        domainKey: 'shop_ops',
        displayName: 'Shop operations',
        description: '',
        versionKey: 'v1',
        defaultLimit: 100,
        maxLimit: 1000,
        routingKeywords: ['orders'],
      },
      metadata,
    );

    expect(draft.tables[0].primary_key[0]).toEqual(idRef);
    const request = domainDraftCreateInput(draft, selection.snapshot, 'reviewed schema');
    expect(request.snapshot_id).toBe(selection.snapshot.snapshot_id);
    expect(request.draft).toBe(draft);
    expect(request.reason).toBe('reviewed schema');
    expect(draft.tables[0].time_column).toEqual(idRef);
    expect(draft.tables[0].columns.find((column) => column.object_ref === amountRef)?.sensitive).toBe(
      true,
    );
    expect(draft.sql_rules.map((rule) => rule.rule_type)).toEqual([
      'readonly',
      'limit_required',
    ]);
  });

  it('rejects a selection that omits a primary-key field', () => {
    const invalid = { ...selection, selectedObjectIds: [tableRef.object_id, amountRef.object_id] };
    expect(validateDomainSelection(invalid)).toContain('orders:primary_key_incomplete');
  });

  it('summarizes the strongest current quality state', () => {
    const version = {
      version_key: 'v1',
      status: 'draft' as const,
      revision: 1,
      table_count: 1,
      metric_count: 0,
      sql_rule_count: 2,
      access_policy_count: 0,
      published_at: null,
      quality_status: 'failed' as const,
      quality_blocking_codes: ['missing_policy'],
      quality_checked_at: null,
      created_at: null,
    };
    expect(
      domainQuality({
        domain_key: 'shop_ops',
        name: 'Shop',
        description: null,
        enabled: true,
        source_key: 'shop_readonly',
        source_type: 'postgresql',
        published_version: null,
        versions: [version],
      }),
    ).toBe('failed');
  });
});
