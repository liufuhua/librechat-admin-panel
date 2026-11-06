import type * as t from '@/types';

export const emptyCredential = (sourceType: t.DataQuerySourceType): t.DataQueryCredentialInput => {
  const common = {
    host: '',
    database: '',
    username: '',
    password: '',
    caSecretRef: null,
    connectTimeoutSeconds: 5,
  };
  return sourceType === 'postgresql'
    ? {
        ...common,
        sourceType,
        port: 5432,
        sslMode: 'require',
      }
    : {
        ...common,
        sourceType,
        port: 3306,
        tlsMode: 'required',
      };
};

export const emptySourceInput = (): t.DataQuerySourceInput => ({
  sourceKey: '',
  name: '',
  sourceType: 'postgresql',
  credential: emptyCredential('postgresql'),
  environment: 'dev',
  ownerTeam: '',
  riskLevel: 'medium',
  reason: '',
});

export const credentialIsComplete = (credential: t.DataQueryCredentialInput): boolean =>
  Boolean(
    credential.host.trim() &&
    credential.port > 0 &&
    credential.database.trim() &&
    credential.username.trim() &&
    credential.password,
  );

export const sourceBasicInformationIsComplete = (input: t.DataQuerySourceInput): boolean =>
  Boolean(
    input.name.trim() &&
    /^[a-z][a-z0-9_]{1,119}$/.test(input.sourceKey) &&
    input.environment.trim(),
  );

export const credentialWithoutPassword = (
  credential: t.DataQueryCredentialInput,
): t.DataQueryCredentialInput => ({ ...credential, password: '' });
