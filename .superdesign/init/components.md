# 共享 UI 组件

## `src/components/shared/StatusToggle.tsx`

状态开关。使用 Click UI `Switch`，用于数据源启用/停用。

```tsx
import { Switch } from '@clickhouse/click-ui';
import type * as t from '@/types';

export function StatusToggle({ checked, onCheckedChange, disabled, label }: t.StatusToggleProps) {
  return (
    <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} aria-label={label}>
      <Switch.Thumb />
    </Switch>
  );
}
```

## `src/components/shared/LoadingState.tsx`

加载中的统一区域。

```tsx
import { Spinner } from '@clickhouse/click-ui';
import { useLocalize } from '@/hooks';

export function LoadingState() {
  const localize = useLocalize();
  return (
    <div className="flex flex-1 items-center justify-center p-8" role="status">
      <Spinner />
      <span className="sr-only">{localize('com_ui_loading')}</span>
    </div>
  );
}
```

## `src/components/shared/EmptyState.tsx`

空列表状态。

```tsx
import { Icon } from '@clickhouse/click-ui';
import type * as t from '@/types';

export function EmptyState({ icon = 'inbox', title, description }: t.EmptyStateProps) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
      <Icon name={icon} size="lg" className="text-(--cui-color-text-muted)" />
      <h2 className="text-sm font-medium text-(--cui-color-text-default)">{title}</h2>
      {description && <p className="max-w-md text-sm text-(--cui-color-text-muted)">{description}</p>}
    </div>
  );
}
```

## `src/components/shared/SearchInput.tsx`

列表搜索框。

```tsx
import { Icon } from '@clickhouse/click-ui';
import type * as t from '@/types';

export function SearchInput({ value, onChange, placeholder, label }: t.SearchInputProps) {
  return (
    <label className="relative block">
      <span className="sr-only">{label}</span>
      <Icon name="search" size="sm" className="pointer-events-none absolute top-1/2 left-2.5 -translate-y-1/2 text-(--cui-color-text-muted)" />
      <input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="h-8 w-full rounded-md border border-(--cui-color-stroke-default) bg-(--cui-color-background-default) pr-3 pl-8 text-sm text-(--cui-color-text-default) outline-none focus:border-(--cui-color-outline)" />
    </label>
  );
}
```
