import { Button } from '@clickhouse/click-ui';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useBlocker, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import type * as t from '@/types';
import {
  createDataQuerySourceFn,
  setDataQuerySourceEnabledFn,
  testDataQuerySourceFn,
  updateDataQuerySourceCredentialFn,
} from '@/server';
import { notifyError, notifySuccess } from '@/utils';
import { useLocalize } from '@/hooks';
import { CredentialFields } from './CredentialFields';
import {
  credentialIsComplete,
  credentialWithoutPassword,
  emptyCredential,
  emptySourceInput,
  sourceBasicInformationIsComplete,
} from './sourceForm';

type WizardStep = 1 | 2 | 3 | 4;

const inputClass =
  'rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal';

export function DataSourceCreatePage({ initialSource, onSourceCreated }: {
  initialSource?: t.DataQuerySource;
  onSourceCreated?: (sourceKey: string) => void;
} = {}) {
  const localize = useLocalize();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<WizardStep>(initialSource ? 3 : 1);
  const [input, setInput] = useState<t.DataQuerySourceInput>(() => initialSource ? {
    ...emptySourceInput(), sourceKey: initialSource.source_key, name: initialSource.name,
    sourceType: initialSource.source_type, credential: emptyCredential(initialSource.source_type),
    environment: initialSource.environment, ownerTeam: initialSource.owner_team || '', riskLevel: initialSource.risk_level,
  } : emptySourceInput());
  const [created, setCreated] = useState<t.DataQuerySource | null>(initialSource || null);
  const [connection, setConnection] = useState<t.DataQueryConnectionResult | null>(() =>
    initialSource && (initialSource.last_connection_status === 'passed' || initialSource.last_connection_status === 'failed') ? {
      source_key: initialSource.source_key, status: initialSource.last_connection_status,
      code: initialSource.last_connection_code || 'connection_result_unavailable',
    } : null);
  const [enableAfterCreate, setEnableAfterCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty =
    step < 3 &&
    Boolean(
      input.sourceKey ||
      input.name ||
      input.credential.host ||
      input.credential.database ||
      input.credential.username ||
      input.credential.password ||
      input.reason,
    );

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', warnBeforeUnload);
    return () => window.removeEventListener('beforeunload', warnBeforeUnload);
  }, [dirty]);
  useBlocker({
    shouldBlockFn: ({ current, next }) => {
      if (!dirty || current.pathname === next.pathname) return false;
      return !window.confirm(localize('com_data_query_unsaved_leave'));
    },
  });

  const createMutation = useMutation({
    mutationFn: async (submittedInput: t.DataQuerySourceInput) => {
      if (created) {
        // Rotate the existing record; the service tests the candidate before
        // replacing its credential. A failed candidate never overwrites it.
        const source = await updateDataQuerySourceCredentialFn({
          data: {
            sourceKey: created.source_key,
            credential: submittedInput.credential,
            reason: submittedInput.reason,
            requireConnectionSuccess: true,
          },
        });
        const result: t.DataQueryConnectionResult = {
          source_key: source.source_key,
          status: source.last_connection_status === 'passed' ? 'passed' : 'failed',
          code: source.last_connection_code || 'connection_result_unavailable',
        };
        return { source, result, testError: null };
      }
      const source = await createDataQuerySourceFn({ data: submittedInput });
      try {
        const result = await testDataQuerySourceFn({
          data: {
            sourceKey: source.source_key,
            reason: submittedInput.reason,
          },
        });
        return { source, result, testError: null };
      } catch (testError) {
        return {
          source,
          result: null,
          testError: testError instanceof Error ? testError.message : 'connection_test_failed',
        };
      }
    },
    onSuccess: ({ source, result, testError }) => {
      setCreated(source);
      setConnection(result);
      setError(testError);
      setStep(3);
      queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'sources'] });
      if (!created) onSourceCreated?.(source.source_key);
      if (!result) return;
      result.status === 'passed'
        ? notifySuccess(
            localize('com_data_query_connection_result', {
              status: result.status,
              code: result.code,
            }),
          )
        : notifyError(
            localize('com_data_query_connection_result', {
              status: result.status,
              code: result.code,
            }),
          );
    },
    onError: (mutationError: Error) => setError(mutationError.message),
    onSettled: (): void => { createMutation.reset(); },
  });

  const finishMutation = useMutation({
    mutationFn: async () => {
      if (!created) throw new Error('data_source_not_created');
      if (enableAfterCreate) {
        return setDataQuerySourceEnabledFn({
          data: {
            sourceKey: created.source_key,
            enabled: true,
            reason: input.reason,
          },
        });
      }
      return created;
    },
    onSuccess: (source) => {
      queryClient.invalidateQueries({ queryKey: ['data-query-v2', 'sources'] });
      createMutation.reset();
      navigate({
        to: '/data-query/sources/$sourceKey',
        params: { sourceKey: source.source_key },
      });
    },
    onError: (mutationError: Error) => setError(mutationError.message),
  });

  const changeSourceType = (sourceType: t.DataQuerySourceType) =>
    setInput((current) => ({
      ...current,
      sourceType,
      credential: emptyCredential(sourceType),
    }));

  const submitCredentials = () => {
    if (!credentialIsComplete(input.credential) || !input.reason.trim()) return;
    setError(null);
    setConnection(null);
    setEnableAfterCreate(false);
    createMutation.mutate({ ...input, credential: { ...input.credential } });
    setInput((current) => ({
      ...current,
      credential: credentialWithoutPassword(current.credential),
    }));
  };

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-(--cui-color-title-default)">
            {localize('com_data_query_create_source')}
          </h2>
          <p className="mt-1 text-sm text-(--cui-color-text-muted)">
            {localize('com_data_query_create_source_hint')}
          </p>
        </div>
        <Link to="/data-query/sources" className="text-sm text-(--cui-color-text-muted) underline">
          {localize('com_ui_cancel')}
        </Link>
      </header>

      <ol className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {[1, 2, 3, 4].map((number) => (
          <li
            key={number}
            className={`rounded-md border px-3 py-2 text-sm ${
              step === number
                ? 'border-(--cui-color-accent) text-(--cui-color-text-default)'
                : 'border-(--cui-color-stroke-default) text-(--cui-color-text-muted)'
            }`}
          >
            {localize(`com_data_query_create_step_${number}`)}
          </li>
        ))}
      </ol>

      {created && (
        <p className="text-sm text-(--cui-color-text-muted)">
          {localize('com_data_query_created_edit_connection')}
        </p>
      )}

      <section className="rounded-lg border border-(--cui-color-stroke-default) bg-(--cui-color-background-panel) p-5">
        {step === 1 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {localize('com_data_query_source_name')}
              <input
                value={input.name}
                disabled={Boolean(created)}
                onChange={(event) =>
                  setInput((current) => ({ ...current, name: event.target.value }))
                }
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {localize('com_data_query_source_key')}
              <input
                value={input.sourceKey}
                disabled={Boolean(created)}
                onChange={(event) =>
                  setInput((current) => ({ ...current, sourceKey: event.target.value }))
                }
                pattern="[a-z][a-z0-9_]{1,119}"
                className={inputClass}
              />
              <span className="text-xs font-normal text-(--cui-color-text-muted)">
                {localize('com_data_query_source_key_hint')}
              </span>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {localize('com_data_query_type')}
              <select
                value={input.sourceType}
                disabled={Boolean(created)}
                onChange={(event) => changeSourceType(event.target.value as t.DataQuerySourceType)}
                className={inputClass}
              >
                <option value="postgresql">PostgreSQL</option>
                <option value="mysql">MySQL</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {localize('com_data_query_environment')}
              <select
                value={input.environment}
                disabled={Boolean(created)}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    environment: event.target.value,
                  }))
                }
                className={inputClass}
              >
                <option value="dev">dev</option>
                <option value="test">test</option>
                <option value="staging">staging</option>
                <option value="production">production</option>
              </select>
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {localize('com_data_query_owner_team')}
              <input
                value={input.ownerTeam}
                disabled={Boolean(created)}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    ownerTeam: event.target.value,
                  }))
                }
                className={inputClass}
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {localize('com_data_query_risk')}
              <select
                value={input.riskLevel}
                disabled={Boolean(created)}
                onChange={(event) =>
                  setInput((current) => ({
                    ...current,
                    riskLevel: event.target.value as t.DataQueryRiskLevel,
                  }))
                }
                className={inputClass}
              >
                <option value="low">{localize('com_data_query_risk_low')}</option>
                <option value="medium">{localize('com_data_query_risk_medium')}</option>
                <option value="high">{localize('com_data_query_risk_high')}</option>
              </select>
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <CredentialFields
              credential={input.credential}
              onChange={(credential) => setInput((current) => ({ ...current, credential }))}
              disabled={createMutation.isPending}
            />
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              {localize('com_data_query_reason')}
              <textarea
                value={input.reason}
                disabled={createMutation.isPending}
                onChange={(event) =>
                  setInput((current) => ({ ...current, reason: event.target.value }))
                }
                className="min-h-24 rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) p-3 text-sm font-normal"
              />
            </label>
            <p className="text-xs text-(--cui-color-text-muted)">
              {localize('com_data_query_secret_never_displayed')}
            </p>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <h3 className="font-medium text-(--cui-color-title-default)">
              {localize('com_data_query_connection_test')}
            </h3>
            {connection ? (
              <div
                role="status"
                className={`rounded-md border p-4 text-sm ${
                  connection.status === 'passed'
                    ? 'border-(--cui-color-stroke-success)'
                    : 'border-(--cui-color-stroke-danger)'
                }`}
              >
                <p className="font-medium">{connection.status}</p>
                <p className="mt-1 text-(--cui-color-text-muted)">{connection.code}</p>
              </div>
            ) : (
              <p>{localize('com_data_query_connection_not_available')}</p>
            )}
            <p className="text-sm text-(--cui-color-text-muted)">
              {localize('com_data_query_created_disabled')}
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col gap-4">
            <div className="rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-secondary) p-4">
              <h3 className="font-medium">{localize('com_data_query_discovery_scope')}</h3>
              <p className="mt-2 text-sm text-(--cui-color-text-muted)">
                {localize('com_data_query_discovery_phase_two')}
              </p>
            </div>
            <label className="flex items-start gap-3 text-sm">
              <input
                type="checkbox"
                checked={enableAfterCreate}
                disabled={connection?.status !== 'passed'}
                onChange={(event) => setEnableAfterCreate(event.target.checked)}
              />
              <span>
                {localize('com_data_query_enable_after_create')}
                {connection?.status !== 'passed' && (
                  <span className="mt-1 block text-xs text-(--cui-color-text-muted)">
                    {localize('com_data_query_enable_requires_test')}
                  </span>
                )}
              </span>
            </label>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 text-sm text-(--cui-color-text-danger)">
            {error}
          </p>
        )}
      </section>

      <footer className="flex items-center justify-between">
        <Button
          type="secondary"
          label={localize('com_ui_back')}
          disabled={step === 1 || createMutation.isPending || finishMutation.isPending}
          onClick={() => {
            if (step === 3) {
              // A connection edit invalidates the previous test and enable choice.
              setConnection(null);
              setEnableAfterCreate(false);
              setError(null);
            }
            setStep((current) => (current > 1 ? (current - 1) as WizardStep : current));
          }}
        />
        {step === 1 && (
          <Button
            type="primary"
            label={localize('com_ui_next')}
            disabled={!sourceBasicInformationIsComplete(input)}
            onClick={() => setStep(2)}
          />
        )}
        {step === 2 && (
          <Button
            type="primary"
            label={
              createMutation.isPending
                ? localize('com_ui_loading')
                : localize(created ? 'com_data_query_rotate_and_test' : 'com_data_query_create_and_test')
            }
            disabled={
              createMutation.isPending ||
              !credentialIsComplete(input.credential) ||
              !input.reason.trim()
            }
            onClick={submitCredentials}
          />
        )}
        {step === 3 && (
          <Button type="primary" label={localize('com_ui_next')} onClick={() => setStep(4)} />
        )}
        {step === 4 && (
          <Button
            type="primary"
            label={localize('com_ui_done')}
            disabled={finishMutation.isPending}
            onClick={() => finishMutation.mutate()}
          />
        )}
      </footer>
    </div>
  );
}
