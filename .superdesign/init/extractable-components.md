# 可提取组件

## Sidebar
- Source: `src/components/Sidebar.tsx`
- Category: layout
- Description: 管理后台固定左栏，品牌、导航、用户菜单和折叠控制。
- Extractable props: `collapsed`（boolean）、`activePath`（string）、`userName`（string）。
- Hardcoded: LibreChat 标识、Click UI 图标、现有导航视觉状态。

## Header
- Source: `src/components/Header.tsx`
- Category: layout
- Description: 页面标题与右侧操作栏。
- Extractable props: `title`（string）、`showSearch`（boolean）。
- Hardcoded: 搜索快捷键样式、边框和页面内间距。

## StatusToggle
- Source: `src/components/shared/StatusToggle.tsx`
- Category: basic
- Description: 启用/停用开关。
- Extractable props: `checked`（boolean）、`disabled`（boolean）、`label`（string）。
- Hardcoded: Click UI Switch 外观。

## EmptyState
- Source: `src/components/shared/EmptyState.tsx`
- Category: basic
- Description: 无数据时的图标、标题和说明。
- Extractable props: `icon`、`title`、`description`。
- Hardcoded: 居中布局和低强调文字。
