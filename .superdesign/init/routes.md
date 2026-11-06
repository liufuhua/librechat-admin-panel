# 路由地图

路由使用 TanStack Router 的文件路由，入口配置在 `src/router.tsx`：

```tsx
const router = createTanStackRouter({
  routeTree,
  basepath: import.meta.env.VITE_BASE_PATH || '/',
  context: { queryClient },
  scrollRestoration: true,
  defaultPreload: 'intent',
});
```

主要页面：

- `/`：Dashboard，`src/components/dashboard/DashboardPage.tsx`
- `/configuration`：配置编辑器，`src/components/configuration/ConfigPage.tsx`
- `/access`：角色与用户组，`src/components/access/AccessPage.tsx`
- `/grants`：授权和审计，`src/components/grants/GrantsPage.tsx`
- `/help`：帮助页，`src/components/help/HelpPage.tsx`

Task 13 将新增 `/data-query`，仅管理后台身份可见；使用既有 `Header`、`Sidebar` 和 Click UI。
