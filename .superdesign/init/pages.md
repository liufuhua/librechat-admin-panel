# 页面依赖树

## `/grants`

入口：`src/components/grants/GrantsPage.tsx`

- `src/components/grants/GrantsPage.tsx`
  - `src/components/grants/GrantManagementTab.tsx`
  - `src/components/grants/AuditLogTab.tsx`
  - `src/hooks/useCapabilities.ts`
  - `src/hooks/useLocalize.ts`
  - `src/constants/capabilities.ts`

此页面是 Task 13 的最接近结构参考：顶部 `Tabs`，下方受权限控制的管理内容和审计列表。

## `/configuration`

入口：`src/components/configuration/ConfigPage.tsx`

- `src/components/configuration/ConfigPage.tsx`
  - `ConfigTabBar.tsx`
  - `ContentToolbar.tsx`
  - `ConfigTabContent.tsx`
  - `ConfigSection.tsx`
  - `FieldRenderer.tsx`

## `/access`

入口：`src/components/access/AccessPage.tsx`

- `src/components/access/AccessPage.tsx`
  - `RolesTab.tsx`
  - `GroupsTab.tsx`
  - `RolePermissionsPanel.tsx`
  - `ConfirmDialog.tsx`
