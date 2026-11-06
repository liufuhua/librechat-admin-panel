import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type * as t from '@/types';
import { FormDialog } from '@/components/shared';
import { createDataQuerySourceFn } from '@/server';
import { notifyError, notifySuccess } from '@/utils';
import { useLocalize } from '@/hooks';

const initial: t.DataQuerySourceInput = {
  sourceKey: '',
  name: '',
  sourceType: 'postgresql',
  credential: {
    sourceType: 'postgresql',
    host: '',
    port: 5432,
    database: '',
    username: '',
    password: '',
    caSecretRef: null,
    connectTimeoutSeconds: 5,
    sslMode: 'require',
  },
  environment: 'dev',
  ownerTeam: '',
  riskLevel: 'medium',
  reason: '',
};
type TextFieldKey = 'sourceKey' | 'name' | 'environment' | 'ownerTeam' | 'reason';

export function SourceDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const localize = useLocalize();
  const queryClient = useQueryClient();
  const [input, setInput] = useState<t.DataQuerySourceInput>(initial);
  const close = () => {
    setInput(initial);
    onClose();
  };
  const mutation = useMutation({
    mutationFn: () => createDataQuerySourceFn({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'sources'] });
      notifySuccess(localize('com_data_query_source_created'));
      close();
    },
    onError: (error: Error) => notifyError(error.message),
  });
  const updateText = (key: TextFieldKey, value: string) =>
    setInput((current) => ({ ...current, [key]: value }));
  const updateCredential = (key: 'host' | 'database' | 'username' | 'password', value: string) =>
    setInput((current) => ({
      ...current,
      credential: { ...current.credential, [key]: value },
    }));
  const changeSourceType = (sourceType: t.DataQuerySourceType) =>
    setInput((current) => {
      const common = {
        host: current.credential.host,
        database: current.credential.database,
        username: current.credential.username,
        password: current.credential.password,
        caSecretRef: current.credential.caSecretRef,
        connectTimeoutSeconds: current.credential.connectTimeoutSeconds,
      };
      return sourceType === 'postgresql'
        ? {
            ...current,
            sourceType,
            credential: { ...common, sourceType, port: 5432, sslMode: 'require' },
          }
        : {
            ...current,
            sourceType,
            credential: { ...common, sourceType, port: 3306, tlsMode: 'required' },
          };
    });
  const field = (key: TextFieldKey, label: string, type = 'text') => (
    <label className="flex flex-col gap-1.5 text-sm font-medium text-(--cui-color-text-default)">
      {label}
      <input
        type={type}
        value={input[key]}
        onChange={(event) => updateText(key, event.target.value)}
        className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal"
      />
    </label>
  );
  return (
    <FormDialog
      open={open}
      title={localize('com_data_query_create_source')}
      submitLabel={localize('com_ui_create')}
      submitDisabled={
        !input.sourceKey ||
        !input.name ||
        !input.credential.host ||
        !input.credential.database ||
        !input.credential.username ||
        !input.credential.password ||
        !input.reason
      }
      saving={mutation.isPending}
      onSubmit={() => mutation.mutate()}
      onClose={close}
      size="lg"
    >
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {field('sourceKey', localize('com_data_query_source_key'))}
        {field('name', localize('com_data_query_source_name'))}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_host')}
          <input
            value={input.credential.host}
            onChange={(event) => updateCredential('host', event.target.value)}
            className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_port')}
          <input
            type="number"
            min={1}
            max={65535}
            value={input.credential.port}
            onChange={(event) =>
              setInput((current) => ({
                ...current,
                credential: {
                  ...current.credential,
                  port: Number.parseInt(event.target.value, 10) || 0,
                },
              }))
            }
            className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_database')}
          <input
            value={input.credential.database}
            onChange={(event) => updateCredential('database', event.target.value)}
            className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_username')}
          <input
            autoComplete="off"
            value={input.credential.username}
            onChange={(event) => updateCredential('username', event.target.value)}
            className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal"
          />
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_password')}
          <input
            type="password"
            autoComplete="new-password"
            value={input.credential.password}
            onChange={(event) => updateCredential('password', event.target.value)}
            className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal"
          />
        </label>
        {field('environment', localize('com_data_query_environment'))}
        {field('ownerTeam', localize('com_data_query_owner_team'))}
        {field('reason', localize('com_data_query_reason'))}
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_type')}
          <select
            value={input.sourceType}
            onChange={(event) => changeSourceType(event.target.value as t.DataQuerySourceType)}
            className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal"
          >
            <option value="postgresql">PostgreSQL</option>
            <option value="mysql">MySQL</option>
          </select>
        </label>
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_risk')}
          <select
            value={input.riskLevel}
            onChange={(event) =>
              setInput((current) => ({
                ...current,
                riskLevel: event.target.value as t.DataQueryRiskLevel,
              }))
            }
            className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal"
          >
            <option value="low">{localize('com_data_query_risk_low')}</option>
            <option value="medium">{localize('com_data_query_risk_medium')}</option>
            <option value="high">{localize('com_data_query_risk_high')}</option>
          </select>
        </label>
      </div>
    </FormDialog>
  );
}
