import type * as t from '@/types';
import { useLocalize } from '@/hooks';

interface CredentialFieldsProps {
  credential: t.DataQueryCredentialInput;
  onChange: (credential: t.DataQueryCredentialInput) => void;
  disabled?: boolean;
}

const inputClass =
  'rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm font-normal';

export function CredentialFields({ credential, onChange, disabled }: CredentialFieldsProps) {
  const localize = useLocalize();
  const updateText = (key: 'host' | 'database' | 'username' | 'password', value: string) =>
    onChange({ ...credential, [key]: value });

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {localize('com_data_query_host')}
        <input
          value={credential.host}
          disabled={disabled}
          onChange={(event) => updateText('host', event.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {localize('com_data_query_port')}
        <input
          type="number"
          min={1}
          max={65535}
          value={credential.port}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...credential,
              port: Number.parseInt(event.target.value, 10) || 0,
            })
          }
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {localize('com_data_query_database')}
        <input
          value={credential.database}
          disabled={disabled}
          onChange={(event) => updateText('database', event.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {localize('com_data_query_username')}
        <input
          autoComplete="off"
          value={credential.username}
          disabled={disabled}
          onChange={(event) => updateText('username', event.target.value)}
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {localize('com_data_query_password')}
        <input
          type="password"
          autoComplete="new-password"
          value={credential.password}
          disabled={disabled}
          onChange={(event) => updateText('password', event.target.value)}
          className={inputClass}
        />
      </label>
      {credential.sourceType === 'postgresql' ? (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_ssl_mode')}
          <select
            value={credential.sslMode ?? 'require'}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...credential,
                sslMode: event.target.value as t.DataQueryPostgresCredentialInput['sslMode'],
              })
            }
            className={inputClass}
          >
            {['disable', 'allow', 'prefer', 'require', 'verify-ca', 'verify-full'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <label className="flex flex-col gap-1.5 text-sm font-medium">
          {localize('com_data_query_tls_mode')}
          <select
            value={credential.tlsMode ?? 'required'}
            disabled={disabled}
            onChange={(event) =>
              onChange({
                ...credential,
                tlsMode: event.target.value as t.DataQueryMysqlCredentialInput['tlsMode'],
              })
            }
            className={inputClass}
          >
            {['disabled', 'preferred', 'required', 'verify-ca', 'verify-identity'].map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        </label>
      )}
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {localize('com_data_query_ca_secret_reference')}
        <input
          value={credential.caSecretRef ?? ''}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...credential,
              caSecretRef: event.target.value.trim() || null,
            })
          }
          className={inputClass}
        />
      </label>
      <label className="flex flex-col gap-1.5 text-sm font-medium">
        {localize('com_data_query_connection_timeout')}
        <input
          type="number"
          min={1}
          max={60}
          value={credential.connectTimeoutSeconds}
          disabled={disabled}
          onChange={(event) =>
            onChange({
              ...credential,
              connectTimeoutSeconds: Number.parseInt(event.target.value, 10) || 0,
            })
          }
          className={inputClass}
        />
      </label>
    </div>
  );
}
