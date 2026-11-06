import { Link } from '@tanstack/react-router';
import type { DraftUpdater } from './editorUtils';
import type * as t from '@/types';
import { Empty, Field, RemoveButton, Section, fieldClass } from './EditorFields';
import { objectDependencies, refLabel } from './editorUtils';
import { useLocalize } from '@/hooks/useLocalize';

interface StepProps {
  draft: t.DataQueryDomainDraft;
  readOnly: boolean;
  update: DraftUpdater;
}

export function BasicStep({ draft, readOnly, update }: StepProps) {
  const localize = useLocalize();
  return (
    <div className="flex flex-col gap-4">
      <Section
        title={localize('com_data_query_editor_basic_information_6c092c')}
        description={localize(
          'com_data_query_editor_routing_metadata_and_bounded_result_limits_the_d_23550c',
        )}
      >
        <div className="grid gap-4 md:grid-cols-2">
          <Field label={localize('com_data_query_editor_domain_name_421b1e')}>
            <input
              className={fieldClass}
              disabled={readOnly}
              value={draft.display_name}
              onChange={(e) =>
                update((d) => {
                  d.display_name = e.target.value;
                })
              }
            />
          </Field>
          <Field label={localize('com_data_query_editor_data_source_548c5b')}>
            <input
              className={fieldClass}
              disabled
              value={`${draft.source_key} (${draft.source_type})`}
            />
          </Field>
          <Field label={localize('com_data_query_editor_default_row_limit_aaa349')}>
            <input
              className={fieldClass}
              type="number"
              min={1}
              max={10000}
              disabled={readOnly}
              value={draft.default_limit}
              onChange={(e) =>
                update((d) => {
                  d.default_limit = Number(e.target.value);
                })
              }
            />
          </Field>
          <Field label={localize('com_data_query_editor_maximum_row_limit_e985b6')}>
            <input
              className={fieldClass}
              type="number"
              min={1}
              max={10000}
              disabled={readOnly}
              value={draft.max_limit}
              onChange={(e) =>
                update((d) => {
                  d.max_limit = Number(e.target.value);
                })
              }
            />
          </Field>
          <Field
            label={localize('com_data_query_editor_routing_keywords_b71f6c')}
            hint={localize(
              'com_data_query_editor_comma_separated_natural_language_routing_terms_19dcca',
            )}
          >
            <input
              className={fieldClass}
              disabled={readOnly}
              value={draft.routing_keywords.join(', ')}
              onChange={(e) =>
                update((d) => {
                  d.routing_keywords = e.target.value
                    .split(',')
                    .map((v) => v.trim())
                    .filter(Boolean);
                })
              }
            />
          </Field>
          <Field label={localize('com_data_query_editor_description_526e00')}>
            <textarea
              className={`${fieldClass} min-h-24`}
              disabled={readOnly}
              value={draft.description ?? ''}
              onChange={(e) =>
                update((d) => {
                  d.description = e.target.value || null;
                })
              }
            />
          </Field>
        </div>
      </Section>
    </div>
  );
}

export function SchemaStep({ draft, readOnly, update }: StepProps) {
  const localize = useLocalize();
  const removeColumn = (tableIndex: number, columnIndex: number) =>
    update((d) => {
      d.tables[tableIndex].columns.splice(columnIndex, 1);
    });
  return (
    <div className="flex flex-col gap-4">
      <Section
        title={localize('com_data_query_editor_schema_07b091')}
        description={localize(
          'com_data_query_editor_database_object_identity_is_snapshot_issued_and_644862',
        )}
        action={
          <Link
            to="/data-query/sources/$sourceKey"
            params={{ sourceKey: draft.source_key }}
            className="text-sm underline"
          >
            {localize('com_data_query_editor_rediscover_compare_snapshot_afd1e1')}
          </Link>
        }
      >
        <div className="flex flex-col gap-3">
          {draft.tables.map((table, tableIndex) => {
            const tableDeps = objectDependencies(draft, table.object_ref.object_id);
            return (
              <details
                key={table.object_ref.object_id}
                open={tableIndex === 0}
                className="rounded-md border border-(--cui-color-stroke-default) p-4"
              >
                <summary className="cursor-pointer font-medium">
                  {table.display_name || table.object_ref.table_name} · {table.columns.length}{' '}
                  {localize('com_data_query_editor_fields_bfe5d6')}
                </summary>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Field label={localize('com_data_query_editor_native_object_e3b2de')}>
                    <input disabled className={fieldClass} value={refLabel(table.object_ref)} />
                  </Field>
                  <Field label={localize('com_data_query_editor_display_name_2b7f6a')}>
                    <input
                      disabled={readOnly}
                      className={fieldClass}
                      value={table.display_name ?? ''}
                      onChange={(e) =>
                        update((d) => {
                          d.tables[tableIndex].display_name = e.target.value || null;
                        })
                      }
                    />
                  </Field>
                  <Field label={localize('com_data_query_editor_description_526e00')}>
                    <input
                      disabled={readOnly}
                      className={fieldClass}
                      value={table.description ?? ''}
                      onChange={(e) =>
                        update((d) => {
                          d.tables[tableIndex].description = e.target.value || null;
                        })
                      }
                    />
                  </Field>
                  <Field label={localize('com_data_query_editor_primary_key_033fc2')}>
                    <input
                      disabled
                      className={fieldClass}
                      value={table.primary_key.map(refLabel).join(', ')}
                    />
                  </Field>
                  <Field label={localize('com_data_query_editor_time_column_4ef724')}>
                    <select
                      disabled={readOnly}
                      className={fieldClass}
                      value={table.time_column?.object_id ?? ''}
                      onChange={(e) =>
                        update((d) => {
                          d.tables[tableIndex].time_column =
                            d.tables[tableIndex].columns.find(
                              (c) => c.object_ref.object_id === e.target.value,
                            )?.object_ref ?? null;
                        })
                      }
                    >
                      <option value="">{localize('com_data_query_editor_none_dc937b')}</option>
                      {table.columns.map((c) => (
                        <option key={c.object_ref.object_id} value={c.object_ref.object_id}>
                          {c.object_ref.column_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label={localize('com_data_query_editor_organization_column_1071ae')}>
                    <select
                      disabled={readOnly}
                      className={fieldClass}
                      value={table.organization_column?.object_id ?? ''}
                      onChange={(e) =>
                        update((d) => {
                          d.tables[tableIndex].organization_column =
                            d.tables[tableIndex].columns.find(
                              (c) => c.object_ref.object_id === e.target.value,
                            )?.object_ref ?? null;
                        })
                      }
                    >
                      <option value="">{localize('com_data_query_editor_none_dc937b')}</option>
                      {table.columns.map((c) => (
                        <option key={c.object_ref.object_id} value={c.object_ref.object_id}>
                          {c.object_ref.column_name}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
                {tableDeps.length > 0 && (
                  <p className="mt-3 text-xs text-(--cui-color-text-warning)">
                    {localize('com_data_query_editor_table_dependencies_9412c5')}
                    {tableDeps.map((d) => `${d.asset} ${d.key}`).join(', ')}
                  </p>
                )}
                <div className="mt-3 flex justify-end">
                  <RemoveButton
                    disabled={readOnly || draft.tables.length === 1 || tableDeps.length > 0}
                    title={
                      draft.tables.length === 1
                        ? 'A domain must retain at least one table'
                        : tableDeps
                            .map((dependency) => `${dependency.asset}: ${dependency.key}`)
                            .join(', ')
                    }
                    onClick={() =>
                      update((next) => {
                        next.tables.splice(tableIndex, 1);
                      })
                    }
                  />
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-2">
                          {localize('com_data_query_editor_field_type_102ece')}
                        </th>
                        <th className="p-2">
                          {localize('com_data_query_editor_display_metadata_bca506')}
                        </th>
                        <th className="p-2">{localize('com_data_query_editor_synonyms_181e7e')}</th>
                        <th className="p-2">
                          {localize('com_data_query_editor_sensitive_2c64c0')}
                        </th>
                        <th className="p-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {table.columns.map((column, columnIndex) => {
                        const deps = objectDependencies(draft, column.object_ref.object_id);
                        const isPk = table.primary_key.some(
                          (ref) => ref.object_id === column.object_ref.object_id,
                        );
                        return (
                          <tr key={column.object_ref.object_id} className="border-b align-top">
                            <td className="p-2">
                              <strong>{column.object_ref.column_name}</strong>
                              <br />
                              <span className="text-xs text-(--cui-color-text-muted)">
                                {column.data_type}
                                {column.nullable ? ' · nullable' : ''}
                                {isPk ? ' · PK' : ''}
                              </span>
                            </td>
                            <td className="p-2">
                              <input
                                disabled={readOnly}
                                aria-label={`${column.object_ref.column_name} display name`}
                                className={fieldClass}
                                placeholder={localize('com_data_query_editor_display_name_2b7f6a')}
                                value={column.display_name ?? ''}
                                onChange={(e) =>
                                  update((d) => {
                                    d.tables[tableIndex].columns[columnIndex].display_name =
                                      e.target.value || null;
                                  })
                                }
                              />
                              <input
                                disabled={readOnly}
                                aria-label={`${column.object_ref.column_name} description`}
                                className={`${fieldClass} mt-2`}
                                placeholder={localize('com_data_query_editor_description_526e00')}
                                value={column.description ?? ''}
                                onChange={(e) =>
                                  update((d) => {
                                    d.tables[tableIndex].columns[columnIndex].description =
                                      e.target.value || null;
                                  })
                                }
                              />
                            </td>
                            <td className="p-2">
                              <input
                                disabled={readOnly}
                                className={fieldClass}
                                value={column.synonyms.join(', ')}
                                onChange={(e) =>
                                  update((d) => {
                                    d.tables[tableIndex].columns[columnIndex].synonyms =
                                      e.target.value
                                        .split(',')
                                        .map((v) => v.trim())
                                        .filter(Boolean);
                                  })
                                }
                              />
                            </td>
                            <td className="p-2">
                              <input
                                type="checkbox"
                                disabled={readOnly}
                                checked={column.sensitive}
                                onChange={(e) =>
                                  update((d) => {
                                    d.tables[tableIndex].columns[columnIndex].sensitive =
                                      e.target.checked;
                                  })
                                }
                              />
                            </td>
                            <td className="p-2">
                              <RemoveButton
                                disabled={readOnly || isPk || deps.length > 0}
                                title={
                                  isPk
                                    ? 'Primary-key fields cannot be removed'
                                    : deps.map((d) => `${d.asset}: ${d.key}`).join(', ')
                                }
                                onClick={() => removeColumn(tableIndex, columnIndex)}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </details>
            );
          })}
          {!draft.tables.length && (
            <Empty>{localize('com_data_query_editor_no_schema_objects_selected_29bb95')}</Empty>
          )}
        </div>
      </Section>
    </div>
  );
}
