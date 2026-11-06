import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type * as t from '@/types';
import i18n from '@/locales/i18n';
import { BasicStep, SchemaStep } from './BasicSchemaSteps';
import { PoliciesStep, QualityTraceStep, RulesStep } from './GovernanceSteps';
import { MetricsStep, PatternsStep, RelationshipsStep, TerminologyStep } from './SemanticSteps';

vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a>,
}));

const table = (suffix: string, name: string): t.DataQueryDomainTable => {
  const tableRef: t.DataQueryObjectRef = {
    object_id: `dbo_${suffix.repeat(40)}`,
    kind: 'table',
    catalog_name: 'db',
    schema_name: 'public',
    table_name: name,
    column_name: null,
  };
  const columnRef: t.DataQueryObjectRef = {
    ...tableRef,
    object_id: `dbo_${(suffix === '1' ? '3' : '4').repeat(40)}`,
    kind: 'column',
    column_name: 'id',
  };
  return {
    object_ref: tableRef,
    display_name: name,
    description: null,
    primary_key: [columnRef],
    time_column: null,
    organization_column: null,
    columns: [
      {
        object_ref: columnRef,
        data_type: 'integer',
        nullable: false,
        sensitive: false,
        display_name: null,
        description: null,
        synonyms: [],
      },
    ],
  };
};
const draft: t.DataQueryDomainDraft = {
  domain_key: 'shop_ops',
  display_name: 'Shop',
  description: null,
  source_key: 'shop',
  source_type: 'postgresql',
  version_key: 'v1',
  default_limit: 50,
  max_limit: 500,
  routing_keywords: [],
  tables: [table('1', 'orders'), table('2', 'customers')],
  terminology: { revenue: ['sales'] },
  metrics: [],
  sql_rules: [],
  relationships: [],
  query_patterns: [],
  source_traces: [],
  access_policies: [],
  quality_cases: [],
};
const update = vi.fn();

describe('structured domain editor steps', () => {
  it('adds an explicit bounded lookup rule without editing access policies', async () => {
    await i18n.changeLanguage('en');
    const value = structuredClone(draft);
    const { unmount } = render(<RulesStep draft={value} readOnly={false} update={(fn) => fn(value)} />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'bounded_lookup' } });
    fireEvent.click(screen.getByRole('button', { name: /^Add$/ }));
    expect(value.sql_rules[0]).toMatchObject({ rule_type: 'bounded_lookup', enabled: true, rule_config: { tables: ['orders'] } });
    expect(value.access_policies).toEqual([]);
    unmount();
  });
  it('adds summary purposes with empty scope, saves IDs and leaves grants unchanged', async () => {
    await i18n.changeLanguage('en');
    const value = structuredClone(draft);
    const props = {draft: value, readOnly: false, update: (fn: (d: t.DataQueryDomainDraft) => void) => fn(value)};
    const {rerender, unmount} = render(<RulesStep {...props} />);
    fireEvent.change(screen.getByRole('combobox'), {target: {value: 'summary_projection'}});
    fireEvent.click(screen.getByRole('button', {name: /^Add$/}));
    const rule = value.sql_rules[0];
    expect(rule.rule_type).toBe('summary_projection');
    if (rule.rule_type !== 'summary_projection') throw new Error('wrong type');
    expect(Object.values(rule.rule_config).every(ids => ids.length === 0)).toBe(true);
    rerender(<RulesStep {...props} />);
    const select = screen.getByLabelText('允许计数的表') as HTMLSelectElement;
    expect(select.options[0].text).toBe('orders');
    select.options[0].selected = true;
    fireEvent.change(select);
    expect(rule.rule_config.count_tables).toEqual([value.tables[0].object_ref.object_id]);
    expect(value.access_policies).toEqual([]);
    expect((screen.getByLabelText('可等值筛选的文本（最多120字）') as HTMLSelectElement).options.length).toBe(0);
    unmount();
  });
  it.each([
    ['Basic information', BasicStep],
    ['Schema', SchemaStep],
    ['Terminology', TerminologyStep],
    ['Metrics', MetricsStep],
    ['Relationships', RelationshipsStep],
    ['Query patterns', PatternsStep],
    ['SQL rules', RulesStep],
    ['Access policies', PoliciesStep],
    ['Quality cases', QualityTraceStep],
  ] as const)('renders %s without a raw JSON or SQL editor', async (heading, Component) => {
    await i18n.changeLanguage('en');
    const { unmount } = render(
      <Component draft={structuredClone(draft)} readOnly={false} update={update} />,
    );
    expect(screen.getByText(heading)).toBeInTheDocument();
    expect(screen.queryByLabelText(/raw json|raw sql|yaml/i)).not.toBeInTheDocument();
    unmount();
  });
  it.each([
    ['基本信息', BasicStep],
    ['数据结构', SchemaStep],
    ['业务术语', TerminologyStep],
    ['指标', MetricsStep],
    ['表关系', RelationshipsStep],
    ['查询模式', PatternsStep],
    ['SQL 规则', RulesStep],
    ['访问策略', PoliciesStep],
    ['质量用例', QualityTraceStep],
  ] as const)('renders Chinese editor %s', async (heading, Component) => {
    await i18n.changeLanguage('zh');
    const { unmount, container } = render(
      <Component draft={structuredClone(draft)} readOnly={false} update={update} />,
    );
    expect(screen.getByText(heading)).toBeInTheDocument();
    expect(container.textContent).not.toContain('com_data_query_editor_');
    unmount();
  });
});
