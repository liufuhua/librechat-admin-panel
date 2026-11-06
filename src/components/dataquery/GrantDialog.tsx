import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import type * as t from '@/types';
import { FormDialog } from '@/components/shared';
import { createDataQueryGrantFn } from '@/server';
import { notifyError, notifySuccess } from '@/utils';
import { useLocalize } from '@/hooks';

const actionOptions = [
  'domain.read',
  'schema.read',
  'metric.query',
  'sql.generate',
  'sql.execute_generated',
  'sql.execute_direct',
  'result.read_own',
  'result.read_shared',
] as const;
type SubjectType = 'user' | 'role' | 'organization';

export function GrantDialog({
  open,
  domains,
  onClose,
}: {
  open: boolean;
  domains: t.DataQueryDomain[];
  onClose: () => void;
}) {
  const localize = useLocalize();
  const [domainKey, setDomainKey] = useState('');
  const [subjectType, setSubjectType] = useState<SubjectType>('role');
  const [subjectKey, setSubjectKey] = useState('');
  const [effect, setEffect] = useState<'allow' | 'deny'>('allow');
  const [actions, setActions] = useState<string[]>(['domain.read']);
  const [reason, setReason] = useState('');
  const mutation = useMutation({
    mutationFn: () =>
      createDataQueryGrantFn({
        data: {
          domainKey,
          subjectType,
          subjectKey,
          effect,
          actions: actions as Array<(typeof actionOptions)[number]>,
          startsAt: null,
          endsAt: null,
          reason,
        },
      }),
    onSuccess: () => {
      notifySuccess(localize('com_data_query_authorization_created'));
      onClose();
    },
    onError: (error: Error) => notifyError(error.message),
  });
  const toggleAction = (action: string) =>
    setActions((current) =>
      current.includes(action) ? current.filter((item) => item !== action) : [...current, action],
    );
  return (
    <FormDialog
      open={open}
      title={localize('com_data_query_create_authorization')}
      submitLabel={localize('com_ui_create')}
      submitDisabled={!domainKey || !subjectKey || !reason || actions.length === 0}
      saving={mutation.isPending}
      onSubmit={() => mutation.mutate()}
      onClose={onClose}
      size="lg"
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_domain')}
          <select
            value={domainKey}
            onChange={(event) => setDomainKey(event.target.value)}
            className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal"
          >
            <option value="">{localize('com_ui_select')}</option>
            {domains.map((domain) => (
              <option key={domain.domain_key} value={domain.domain_key}>
                {domain.name}
              </option>
            ))}
          </select>
        </label>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {localize('com_data_query_subject_type')}
            <select
              value={subjectType}
              onChange={(event) => setSubjectType(event.target.value as SubjectType)}
              className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal"
            >
              {(['user', 'role', 'organization'] as SubjectType[]).map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            {localize('com_data_query_subject_key')}
            <input
              value={subjectKey}
              onChange={(event) => setSubjectKey(event.target.value)}
              className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal"
            />
          </label>
        </div>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_effect')}
          <select
            value={effect}
            onChange={(event) => setEffect(event.target.value as 'allow' | 'deny')}
            className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal"
          >
            <option value="allow">allow</option>
            <option value="deny">deny</option>
          </select>
        </label>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium">{localize('com_data_query_actions')}</legend>
          {actionOptions.map((action) => (
            <label key={action} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={actions.includes(action)}
                onChange={() => toggleAction(action)}
              />
              {action}
            </label>
          ))}
        </fieldset>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_reason')}
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            className="min-h-20 rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) p-2 text-sm font-normal"
          />
        </label>
      </div>
    </FormDialog>
  );
}
