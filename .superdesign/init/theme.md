# 设计令牌摘要

页面使用 Tailwind CSS 4 与 Click UI CSS 变量。浅色：默认背景 `#fff`，边框 `#e3e5e8`，默认文字 `#161517`，次级文字 `#6c6f77`，强调色 `#437eef`；深色：默认背景 `#1f1f1c`，面板背景 `#1f1f1c`，边框 `#323232`，强调色 `#faff69`。小圆角为 `0.375rem`。页面保持低对比灰白面板、紧凑表格与单一蓝色操作重点。

`src/styles.css` 的原始主题入口：

```css
@import 'tailwindcss';
@theme { --z-sticky: 10; --z-floating: 20; --z-overlay: 60; --z-toast: 80; }
@custom-variant dark { &:where(.dark, .dark *) { @slot; } }
@layer theme { :root { --cui-color-background-default: #ffffff; --cui-color-background-panel: #ffffff; --cui-color-text-default: #161517; --cui-color-text-muted: #6c6f77; --cui-color-accent: #437eef; --cui-color-outline: #437eef; --cui-radii-sm: 0.375rem; } .dark { --cui-color-background-default: #1f1f1c; --cui-color-background-panel: #1f1f1c; --cui-color-text-default: #ffffff; --cui-color-text-muted: #b3b6bd; --cui-color-accent: #faff69; } }
```
