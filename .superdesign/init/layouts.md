# 共享布局

## `src/components/Sidebar.tsx`

固定左侧栏：宽度展开时 `w-63`、折叠时 `w-14`；顶部品牌区，中间导航，底部用户菜单和折叠开关。导航项使用 `Link`、`Icon` 和 CSS 变量；当前项使用 `--cui-color-background-active`。页面应复用其 `Header + Sidebar + main` 三段式布局，不另建产品级导航。

关键渲染结构：

```tsx
<aside className={cn('sticky top-0 z-(--z-floating) flex h-screen shrink-0 flex-col overflow-hidden border-r border-(--cui-color-stroke-default) bg-(--cui-color-background-panel) transition-[width] duration-200', collapsed ? 'w-14' : 'w-63')}>
  <div className="flex h-14 shrink-0 items-center px-2">品牌</div>
  <nav className="flex-1 overflow-y-auto px-2 py-2" role="navigation">导航链接</nav>
  <div className="shrink-0">用户菜单</div>
  <button type="button">折叠</button>
</aside>
```

## `src/components/Header.tsx`

每页顶部栏，标题位于左侧，右侧保留子操作和命令搜索入口。

```tsx
<header className="shrink-0 border-b border-(--cui-color-stroke-default) bg-(--cui-color-background-panel)">
  <div className="flex items-center gap-3 px-4 py-3">
    <h1 className="text-base font-bold text-(--cui-color-text-default)">{title}</h1>
    <div className="flex min-w-0 flex-1 items-center justify-end gap-2">{children}</div>
  </div>
</header>
```
