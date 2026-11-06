import { describe, expect, it } from 'vitest';
import type * as t from '@/types';
import { objectDependencies, terminologyMatches, validateEditorDraft } from './editorUtils';

const table = {
  object_id: `dbo_${'1'.repeat(40)}`,
  kind: 'table',
  catalog_name: 'db',
  schema_name: 'public',
  table_name: 'orders',
  column_name: null,
} as const;
const column = {
  object_id: `dbo_${'2'.repeat(40)}`,
  kind: 'column',
  catalog_name: 'db',
  schema_name: 'public',
  table_name: 'orders',
  column_name: 'id',
} as const;
const draft: t.DataQueryDomainDraft = {
  domain_key: 'shop_ops',
  display_name: 'Shop',
  description: null,
  source_key: 'shop',
  source_type: 'mysql',
  version_key: 'v1',
  default_limit: 50,
  max_limit: 500,
  routing_keywords: [],
  tables: [
    {
      object_ref: table,
      display_name: null,
      description: null,
      primary_key: [column],
      time_column: null,
      organization_column: null,
      columns: [
        {
          object_ref: column,
          data_type: 'int',
          nullable: false,
          sensitive: false,
          display_name: null,
          description: null,
          synonyms: [],
        },
      ],
    },
  ],
  terminology: { revenue: ['sales'] },
  metrics: [],
  sql_rules: [],
  relationships: [],
  query_patterns: [],
  source_traces: [],
  access_policies: [],
  quality_cases: [],
};

describe('domain editor utilities', () => {
  it('validates an internally consistent draft', () =>
    expect(validateEditorDraft(draft)).toEqual([]));
  it('finds terminology evidence without executing SQL', () =>
    expect(terminologyMatches(draft.terminology, 'show sales')).toEqual([
      { term: 'revenue', evidence: 'sales' },
    ]));
  it('reports object dependencies', () => {
    const withMetric = structuredClone(draft);
    withMetric.metrics.push({
      metric_type: 'configured',
      metric_key: 'order_count',
      name: 'Orders',
      description: null,
      metric_spec: {
        table,
        time_column: null,
        value_column: column,
        aggregation: 'count',
        dimensions: [],
        allowed_filters: [],
        unit: 'count',
        display_format: '0',
        max_time_range_hours: 24,
      },
      enabled: true,
    });
    expect(objectDependencies(withMetric, column.object_id)).toEqual([
      { asset: 'Metric', key: 'order_count' },
    ]);
  });
});
