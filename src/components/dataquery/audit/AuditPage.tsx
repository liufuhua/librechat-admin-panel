import { Button, Dialog } from '@clickhouse/click-ui';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import type * as t from '@/types';
import { EmptyState, LoadingState } from '@/components/shared';
import { getDataQueryAuditFn, listDataQueryAuditsFn } from '@/server';

type Filters = {
  actorSubjectId?: string; action?: string; objectType?: string; objectKey?: string;
  result?: string; requestId?: string; createdAfter?: string; createdBefore?: string;
};

export function AuditPage() {
  const [filters, setFilters] = useState<Filters>({});
  const [applied, setApplied] = useState<Filters>({});
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const audits = useQuery({
    queryKey: ['data-query-v2', 'audits', applied],
    queryFn: () => listDataQueryAuditsFn({ data: { ...applied, limit: 100 } }),
  });
  let auditContent = <div className="overflow-x-auto rounded-lg border border-(--cui-color-stroke-default)"><table className="w-full text-left text-sm"><thead><tr className="border-b bg-(--cui-color-background-muted)">{['Time', 'Actor', 'Action', 'Object', 'Result', 'Reason', 'Request ID', ''].map((name) => <th key={name} className="px-4 py-3 font-medium">{name}</th>)}</tr></thead><tbody>{audits.data?.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="px-4 py-3">{item.created_at ?? '-'}</td><td className="px-4 py-3">{item.actor_subject_id}</td><td className="px-4 py-3">{item.action}</td><td className="px-4 py-3">{item.object_type}:{item.object_key}</td><td className="px-4 py-3">{item.result}</td><td className="max-w-48 truncate px-4 py-3">{item.reason ?? '-'}</td><td className="px-4 py-3 font-mono text-xs">{item.request_id}</td><td className="px-4 py-3"><Button type="secondary" label="Details" onClick={() => setSelectedId(item.id)} /></td></tr>)}{audits.data?.length === 0 && <tr><td colSpan={8}><EmptyState message="No audit entries match the current filters." /></td></tr>}</tbody></table></div>;
  if (audits.isLoading) auditContent = <LoadingState />;
  if (audits.isError) auditContent = <EmptyState message="Failed to load audit entries." />;
  return <main className="flex flex-col gap-5 p-6">
    <header><h1 className="text-2xl font-semibold">Management audit</h1><p className="mt-1 text-sm text-(--cui-color-text-muted)">仅展示脱敏后的配置摘要；凭据、DSN、Token、SQL 参数与业务数据不会进入此页面。</p></header>
    <form className="grid grid-cols-1 gap-3 rounded-lg border border-(--cui-color-stroke-default) p-4 md:grid-cols-4" onSubmit={(event) => { event.preventDefault(); setApplied(filters); }}>
      <AuditInput label="Actor" value={filters.actorSubjectId ?? ''} onChange={(value) => setFilters((current) => ({ ...current, actorSubjectId: value || undefined }))} />
      <AuditInput label="Action" value={filters.action ?? ''} onChange={(value) => setFilters((current) => ({ ...current, action: value || undefined }))} />
      <AuditInput label="Object type" value={filters.objectType ?? ''} onChange={(value) => setFilters((current) => ({ ...current, objectType: value || undefined }))} />
      <AuditInput label="Object key" value={filters.objectKey ?? ''} onChange={(value) => setFilters((current) => ({ ...current, objectKey: value || undefined }))} />
      <AuditInput label="Request ID" value={filters.requestId ?? ''} onChange={(value) => setFilters((current) => ({ ...current, requestId: value || undefined }))} />
      <label className="text-sm font-medium">Result<select value={filters.result ?? ''} onChange={(event) => setFilters((current) => ({ ...current, result: event.target.value || undefined }))} className="mt-1 block w-full rounded-md border px-3 py-2 font-normal"><option value="">All</option><option value="success">success</option><option value="failed">failed</option></select></label>
      <label className="text-sm font-medium">From<input type="datetime-local" value={filters.createdAfter ?? ''} onChange={(event) => setFilters((current) => ({ ...current, createdAfter: event.target.value ? new Date(event.target.value).toISOString() : undefined }))} className="mt-1 block w-full rounded-md border px-3 py-2 font-normal" /></label>
      <label className="text-sm font-medium">To<input type="datetime-local" value={filters.createdBefore ?? ''} onChange={(event) => setFilters((current) => ({ ...current, createdBefore: event.target.value ? new Date(event.target.value).toISOString() : undefined }))} className="mt-1 block w-full rounded-md border px-3 py-2 font-normal" /></label>
      <div className="flex items-end gap-2"><Button type="primary" label="Apply filters" /><Button type="secondary" label="Clear" onClick={() => { setFilters({}); setApplied({}); }} /></div>
    </form>
    {auditContent}
    <AuditDetail auditId={selectedId} onClose={() => setSelectedId(null)} />
  </main>;
}

function AuditInput({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="text-sm font-medium">{label}<input value={value} onChange={(event) => onChange(event.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2 font-normal" /></label>;
}

function AuditDetail({ auditId, onClose }: { auditId: number | null; onClose: () => void }) {
  const detail = useQuery({ queryKey: ['data-query-v2', 'audit', auditId], queryFn: () => getDataQueryAuditFn({ data: { auditId: auditId ?? 0 } }), enabled: auditId !== null });
  let content = null;
  if (detail.isLoading) content = <LoadingState />;
  if (detail.data) content = <AuditDetailBody item={detail.data} />;
  if (detail.isError) content = <p role="alert">Failed to load audit detail.</p>;
  return <Dialog open={auditId !== null} onOpenChange={(open) => { if (!open) onClose(); }}><Dialog.Content title="Audit detail" showClose onClose={onClose} className="modal-frost max-w-3xl!">{content}</Dialog.Content></Dialog>;
}

function AuditDetailBody({ item }: { item: t.DataQueryAuditDetail }) {
  return <div className="flex flex-col gap-4 text-sm"><dl className="grid grid-cols-2 gap-3"><Detail label="Action" value={item.action} /><Detail label="Object" value={`${item.object_type}:${item.object_key}`} /><Detail label="Request ID" value={item.request_id} /><Detail label="Result" value={item.result} /></dl><section><h2 className="mb-2 font-semibold">Before (sanitized)</h2><pre className="overflow-auto rounded bg-(--cui-color-background-muted) p-3 text-xs">{JSON.stringify(item.before_summary, null, 2)}</pre></section><section><h2 className="mb-2 font-semibold">After (sanitized)</h2><pre className="overflow-auto rounded bg-(--cui-color-background-muted) p-3 text-xs">{JSON.stringify(item.after_summary, null, 2)}</pre></section></div>;
}
function Detail({ label, value }: { label: string; value: string }) { return <div><dt className="text-(--cui-color-text-muted)">{label}</dt><dd className="break-all">{value}</dd></div>; }
