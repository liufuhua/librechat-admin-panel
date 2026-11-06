import { Button } from '@clickhouse/click-ui';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useLocalize } from '@/hooks';
import { EmptyState, FormDialog, LoadingState } from '@/components/shared';
import {
  allRolesQueryOptions,
  createDataQueryGrantFn,
  dataQueryDomainsOptions,
  getDataQueryCurrentOrganizationFn,
  listDataQueryGrantsFn,
  searchUsersFn,
  setDataQueryGrantEnabledFn,
  updateDataQueryGrantActionsFn,
} from '@/server';
import type { DataQueryGrant } from '@/types';
import { notifyError, notifySuccess } from '@/utils';
import { GrantUserChoices, type GrantUserChoice } from './GrantUserChoices';

const actions = [
  'domain.read', 'schema.read', 'metric.query', 'sql.generate', 'sql.execute_generated',
  'sql.execute_direct', 'result.read_own', 'result.read_shared',
] as const;
const actionLabels = {
  "domain.read": "com_data_query_auth_domain_read",
  "schema.read": "com_data_query_auth_schema_read",
  "metric.query": "com_data_query_auth_metric_query",
  "sql.generate": "com_data_query_auth_sql_generate",
  "sql.execute_generated": "com_data_query_auth_sql_execute_generated",
  "sql.execute_direct": "com_data_query_auth_sql_execute_direct",
  "result.read_own": "com_data_query_auth_result_read_own",
  "result.read_shared": "com_data_query_auth_result_read_shared"
} as const;
type SubjectType = 'user' | 'role' | 'organization';

export function AuthorizationsPage() {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const domains = useQuery(dataQueryDomainsOptions);
  const [domainKey, setDomainKey] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<DataQueryGrant | null>(null);
  const grants = useQuery({
    queryKey: ['data-query-v2', 'grants', domainKey],
    queryFn: () => listDataQueryGrantsFn({ data: { domainKey } }),
    enabled: Boolean(domainKey),
  });
  const revoke = useMutation({
    mutationFn: (data: { grantId: number; enabled: boolean; reason: string }) =>
      setDataQueryGrantEnabledFn({ data: { domainKey, ...data } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'grants', domainKey] });
      notifySuccess(localize('com_data_query_auth_updated'));
    },
    onError: (error: Error) => notifyError(error.message),
  });
  if (domains.isLoading) return <LoadingState />;
  let grantContent = <div className="overflow-x-auto rounded-lg border border-(--cui-color-stroke-default)">
    <table className="w-full text-left text-sm">
      <thead><tr className="border-b border-(--cui-color-stroke-default) bg-(--cui-color-background-muted)">{(['subject', 'effect', 'actions', 'window', 'status', 'operations'] as const).map((name) => <th key={name} className="px-4 py-3 font-medium">{localize(`com_data_query_auth_${name}`)}</th>)}</tr></thead>
      <tbody>{grants.data?.map((grant) => <tr key={grant.grant_id} className="border-b border-(--cui-color-stroke-default) last:border-0">
        <td className="px-4 py-3"><p>{localize(`com_data_query_auth_${grant.subject_type}`)}</p><p className="text-sm">{grant.subject_type === 'user' ? grant.subject_name || localize('com_data_query_auth_name_unavailable') : grant.subject_key}</p></td>
        <td className="px-4 py-3">{localize(`com_data_query_auth_${grant.effect}`)}</td><td className="px-4 py-3">{grant.actions.map((action) => Object.hasOwn(actionLabels, action) ? localize(actionLabels[action as keyof typeof actionLabels]) : action).join('、')}</td>
        <td className="px-4 py-3 text-xs">{grant.starts_at ?? localize('com_data_query_auth_immediate')}<br />{grant.ends_at ?? localize('com_data_query_auth_no_expiry')}</td>
        <td className="px-4 py-3">{grant.enabled ? localize('com_data_query_auth_active') : localize('com_data_query_auth_revoked')}</td>
        <td className="px-4 py-3"><div className="flex flex-wrap gap-2">{grant.enabled && <Button type="secondary" label={localize('com_data_query_auth_edit')} onClick={() => setEditing(grant)} />}<Button type="secondary" label={grant.enabled ? localize('com_data_query_auth_revoke') : localize('com_data_query_auth_restore')} onClick={() => {
          const reason = window.prompt(grant.enabled ? localize('com_data_query_auth_revoke_reason') : localize('com_data_query_auth_restore_reason'));
          if (reason?.trim()) revoke.mutate({ grantId: grant.grant_id, enabled: !grant.enabled, reason });
        }} /></div></td>
      </tr>)}{grants.data?.length === 0 && <tr><td colSpan={6}><EmptyState message={localize('com_data_query_auth_empty')} /></td></tr>}</tbody>
    </table>
  </div>;
  if (!domainKey) grantContent = <EmptyState message={localize('com_data_query_auth_select_hint')} />;
  if (domainKey && grants.isLoading) grantContent = <LoadingState />;
  return (
    <main className="flex flex-col gap-5 p-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{localize('com_data_query_auth_title')}</h1>
          <p className="mt-1 text-sm text-(--cui-color-text-muted)">{localize('com_data_query_auth_description')}</p>
        </div>
        <Button type="primary" label={localize('com_data_query_auth_create')} disabled={!domainKey} onClick={() => setDialogOpen(true)} />
      </header>
      <label className="max-w-md text-sm font-medium">
        {localize('com_data_query_auth_domain')}
        <select value={domainKey} onChange={(event) => setDomainKey(event.target.value)} className="mt-1 block w-full rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 font-normal">
          <option value="">{localize('com_data_query_auth_select_domain')}</option>
          {domains.data?.map((domain) => <option key={domain.domain_key} value={domain.domain_key}>{domain.name} ({domain.domain_key})</option>)}
        </select>
      </label>
      {grantContent}
      {editing && <EditGrantActions key={editing.grant_id} domainKey={domainKey} grant={editing} onClose={() => setEditing(null)} />}
      <GrantDialog open={dialogOpen} domainKey={domainKey} onClose={() => setDialogOpen(false)} />
    </main>
  );
}

function EditGrantActions({ domainKey, grant, onClose }: { domainKey: string; grant: DataQueryGrant; onClose: () => void }) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState(grant.actions);
  const [reason, setReason] = useState('');
  const changed = selected.length !== grant.actions.length || selected.some(action => !grant.actions.includes(action));
  const save = useMutation({
    mutationFn: () => updateDataQueryGrantActionsFn({ data: {
      domainKey, grantId: grant.grant_id, expectedActions: grant.actions, actions: selected, reason: reason.trim(),
    } }),
    onSuccess: ({ conflict }) => {
      queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'grants', domainKey] });
      if (conflict) notifyError(localize('com_data_query_auth_changed'));
      else notifySuccess(localize('com_data_query_auth_updated'));
      onClose();
    },
    onError: (error: Error) => notifyError(error.message),
  });
  return <FormDialog open title={localize('com_data_query_auth_edit')} submitLabel={localize('com_ui_save')}
    submitDisabled={!changed || !selected.length || !reason.trim()} saving={save.isPending}
    onSubmit={() => save.mutate()} onClose={onClose}>
    <p>{localize(`com_data_query_auth_${grant.effect}`)} · {grant.subject_type === 'user' ? grant.subject_name || localize('com_data_query_auth_name_unavailable') : grant.subject_key}</p>
    <fieldset className="flex flex-wrap gap-3"><legend>{localize('com_data_query_auth_actions')}</legend>
      {Array.from(new Set([...actions, ...grant.actions])).map(action => <label key={action} className="flex items-center gap-1 text-sm">
        <input type="checkbox" checked={selected.includes(action)} onChange={event => setSelected(event.target.checked ? [...selected, action] : selected.filter(item => item !== action))} />
        {Object.hasOwn(actionLabels, action) ? localize(actionLabels[action as keyof typeof actionLabels]) : action}
      </label>)}
    </fieldset>
    <label>{localize('com_data_query_auth_reason')}<textarea maxLength={500} value={reason} onChange={event => setReason(event.target.value)} className="mt-1 block w-full rounded-md border p-2" /></label>
  </FormDialog>;
}

function GrantDialog({ open, domainKey, onClose }: { open: boolean; domainKey: string; onClose: () => void }) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const roles = useQuery(allRolesQueryOptions);
  const organization = useQuery({ queryKey: ['data-query-v2', 'current-organization'], queryFn: () => getDataQueryCurrentOrganizationFn() });
  const [subjectType, setSubjectType] = useState<SubjectType>('role');
  const [subjectKey, setSubjectKey] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [users, setUsers] = useState<Array<{ id: string; name: string; email: string }>>([]);
  const [selectedUser, setSelectedUser] = useState<GrantUserChoice | null>(null);
  const [effect, setEffect] = useState<'allow' | 'deny'>('allow');
  const [selectedActions, setSelectedActions] = useState<string[]>(['domain.read']);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [reason, setReason] = useState('');
  const create = useMutation({
    mutationFn: () => createDataQueryGrantFn({ data: { domainKey, subjectType, subjectKey, effect, actions: selectedActions as Array<(typeof actions)[number]>, startsAt: startsAt ? new Date(startsAt).toISOString() : null, endsAt: endsAt ? new Date(endsAt).toISOString() : null, reason } }),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'grants', domainKey] }); notifySuccess(localize('com_data_query_auth_created')); onClose(); },
    onError: (error: Error) => notifyError(error.message),
  });
  const selectSubjectType = (value: SubjectType) => { setSubjectType(value); setSubjectKey(value === 'organization' ? (organization.data?.organizationKey ?? '') : ''); setSelectedUser(null); };
  const search = async () => {
    if (userQuery.trim().length < 2) return;
    try { setUsers((await searchUsersFn({ data: { query: userQuery.trim() } })).users); } catch (error) { notifyError(error instanceof Error ? error.message : localize('com_data_query_auth_search_failed')); }
  };
  const toggleAction = (action: string) => setSelectedActions((current) => current.includes(action) ? current.filter((item) => item !== action) : [...current, action]);
  return <FormDialog open={open} title={localize('com_data_query_auth_create')} submitLabel={localize('com_data_query_auth_create')} submitDisabled={!subjectKey || !reason.trim() || !selectedActions.length} saving={create.isPending} onSubmit={() => create.mutate()} onClose={onClose} size="lg">
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="text-sm font-medium">{localize('com_data_query_auth_subject_type')}<select value={subjectType} onChange={(event) => selectSubjectType(event.target.value as SubjectType)} className="mt-1 block w-full rounded-md border px-3 py-2 font-normal"><option value="user">{localize('com_data_query_auth_user')}</option><option value="role">{localize('com_data_query_auth_role')}</option><option value="organization">{localize('com_data_query_auth_organization')}</option></select></label>
      {subjectType === 'role' && <label className="text-sm font-medium">{localize('com_data_query_auth_role')}<select value={subjectKey} onChange={(event) => setSubjectKey(event.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2 font-normal"><option value="">{localize('com_data_query_auth_select_role')}</option>{roles.data?.map((role) => <option key={role.id} value={role.id}>{role.name}</option>)}</select></label>}
      {subjectType === 'organization' && <label className="text-sm font-medium">{localize('com_data_query_auth_current_org')}<input readOnly value={subjectKey || organization.data?.organizationKey || ''} className="mt-1 block w-full rounded-md border px-3 py-2 font-normal" /></label>}
      {subjectType === 'user' && <div className="flex flex-col gap-2"><label className="text-sm font-medium">{localize('com_data_query_auth_search_user')}<input value={userQuery} onChange={(event) => setUserQuery(event.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2 font-normal" /></label><Button type="secondary" label={localize('com_data_query_auth_search')} onClick={(event) => { event.preventDefault(); void search(); }} /><GrantUserChoices users={users} selectedUser={selectedUser?.id === subjectKey ? selectedUser : null} onSelect={(user) => { setSubjectKey(user.id); setSelectedUser(user); }} /></div>}
      <label className="text-sm font-medium">{localize('com_data_query_auth_effect')}<select value={effect} onChange={(event) => setEffect(event.target.value as 'allow' | 'deny')} className="mt-1 block w-full rounded-md border px-3 py-2 font-normal"><option value="allow">{localize('com_data_query_auth_allow')}</option><option value="deny">{localize('com_data_query_auth_deny')}</option></select></label>
      <label className="text-sm font-medium">{localize('com_data_query_auth_starts')}<input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2 font-normal" /></label>
      <label className="text-sm font-medium">{localize('com_data_query_auth_ends')}<input type="datetime-local" value={endsAt} onChange={(event) => setEndsAt(event.target.value)} className="mt-1 block w-full rounded-md border px-3 py-2 font-normal" /></label>
    </div>
    <fieldset className="flex flex-wrap gap-3"><legend className="mb-2 text-sm font-medium">{localize('com_data_query_auth_actions')}</legend>{actions.map((action) => <label key={action} className="flex items-center gap-1 text-sm"><input type="checkbox" checked={selectedActions.includes(action)} onChange={() => toggleAction(action)} />{localize(actionLabels[action])}</label>)}</fieldset>
    <label className="text-sm font-medium">{localize('com_data_query_auth_reason')}<textarea value={reason} onChange={(event) => setReason(event.target.value)} className="mt-1 min-h-20 block w-full rounded-md border p-2 font-normal" /></label>
  </FormDialog>;
}
