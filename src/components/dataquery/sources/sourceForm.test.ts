import { describe, expect, it } from 'vitest';
import {
  credentialIsComplete,
  credentialWithoutPassword,
  emptyCredential,
  emptySourceInput,
  sourceBasicInformationIsComplete,
} from './sourceForm';

describe('data source form contracts', () => {
  it('creates structured PostgreSQL and MySQL credentials without a DSN field', () => {
    const postgres = emptyCredential('postgresql');
    const mysql = emptyCredential('mysql');

    expect(postgres).toMatchObject({ sourceType: 'postgresql', port: 5432 });
    expect(mysql).toMatchObject({ sourceType: 'mysql', port: 3306 });
    expect('dsn' in postgres).toBe(false);
    expect('readonlyDsnSecretRef' in emptySourceInput()).toBe(false);
  });

  it('requires all credential fields and a valid immutable source key', () => {
    const input = emptySourceInput();
    expect(sourceBasicInformationIsComplete(input)).toBe(false);
    expect(credentialIsComplete(input.credential)).toBe(false);

    input.name = 'Orders reporting';
    input.sourceKey = 'orders_readonly';
    input.credential.host = 'database.internal';
    input.credential.database = 'orders';
    input.credential.username = 'readonly';
    input.credential.password = 'temporary-password';

    expect(sourceBasicInformationIsComplete(input)).toBe(true);
    expect(credentialIsComplete(input.credential)).toBe(true);
  });

  it('clears the password while preserving non-secret form fields', () => {
    const credential = emptyCredential('postgresql');
    credential.host = 'database.internal';
    credential.password = 'temporary-password';

    expect(credentialWithoutPassword(credential)).toMatchObject({
      host: 'database.internal',
      password: '',
    });
  });
});
