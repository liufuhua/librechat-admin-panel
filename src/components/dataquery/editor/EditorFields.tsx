import type { ReactNode } from 'react';
import { useLocalize } from '@/hooks/useLocalize';

export const fieldClass =
  'w-full rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) px-3 py-2 text-sm disabled:opacity-60';

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="flex flex-col gap-1.5 text-sm font-medium">
      {label}
      {children}
      {hint && <span className="text-xs font-normal text-(--cui-color-text-muted)">{hint}</span>}
    </label>
  );
}

export function Section({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-(--cui-color-stroke-default) p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {description && (
            <p className="mt-1 text-sm text-(--cui-color-text-muted)">{description}</p>
          )}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function RemoveButton({
  disabled,
  title,
  onClick,
}: {
  disabled?: boolean;
  title?: string;
  onClick: () => void;
}) {
  const localize = useLocalize();
  return (
    <button
      type="button"
      disabled={disabled}
      title={title}
      onClick={onClick}
      className="text-sm text-(--cui-color-text-danger) underline disabled:cursor-not-allowed disabled:opacity-50"
    >
      {localize('com_data_query_editor_remove_c3812f')}
    </button>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md bg-(--cui-color-background-secondary) p-4 text-sm text-(--cui-color-text-muted)">
      {children}
    </p>
  );
}

export function MultiSelect({
  values,
  options,
  disabled,
  onChange,
}: {
  values: string[];
  options: Array<{ value: string; label: string }>;
  disabled?: boolean;
  onChange: (values: string[]) => void;
}) {
  return (
    <select
      multiple
      value={values}
      disabled={disabled}
      onChange={(event) =>
        onChange([...event.currentTarget.selectedOptions].map((item) => item.value))
      }
      className={`${fieldClass} min-h-28`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
