import type * as t from '@/types';

/** A table is selected iff at least one of its explicitly selected columns is selected. */
export function normalizeSnapshotSelection(
  tables: t.DataQuerySnapshotTable[],
  selected: ReadonlySet<string>,
): Set<string> {
  const next = new Set<string>();
  for (const table of tables) {
    const columns = table.columns.filter((column) => selected.has(column.object_ref.object_id));
    if (!columns.length) continue;
    next.add(table.table.object_id);
    for (const column of columns) next.add(column.object_ref.object_id);
  }
  return next;
}

export function selectSnapshotColumn(
  tables: t.DataQuerySnapshotTable[],
  selected: ReadonlySet<string>,
  objectId: string,
  checked: boolean,
): Set<string> {
  const next = new Set(selected);
  checked ? next.add(objectId) : next.delete(objectId);
  return normalizeSnapshotSelection(tables, next);
}

export function selectSnapshotTable(
  tables: t.DataQuerySnapshotTable[],
  selected: ReadonlySet<string>,
  table: t.DataQuerySnapshotTable,
  checked: boolean,
): Set<string> {
  const next = new Set(selected);
  for (const column of table.columns) {
    checked ? next.add(column.object_ref.object_id) : next.delete(column.object_ref.object_id);
  }
  return normalizeSnapshotSelection(tables, next);
}
