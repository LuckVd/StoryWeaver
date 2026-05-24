# Current Goal

## Goal

G01-S01 — Monorepo 脚手架

创建 pnpm monorepo 项目基础结构，确保 `pnpm install && pnpm build` 零错误通过。

## Current State

从 roadmap G01-S01 激活，准备实施。

## Chosen Approach

创建根配置 + 两个 workspace 包 (`@storyweaver/core`, `@storyweaver/studio`)，配置 TS 编译、ESLint、Prettier，验证构建流水线跑通。

## Acceptance Criteria

- [ ] `pnpm install` 成功，生成 `node_modules` 和 `pnpm-lock.yaml`
- [ ] `packages/core` 可用 `tsup` 构建出 dist
- [ ] `packages/studio` 可用 `vite build` 构建出 dist
- [ ] `pnpm build` 从根目录一次性构建两个包，零错误
- [ ] `@storyweaver/studio` 可导入 `@storyweaver/core` 的导出

## Test Plan

- `pnpm install` 成功
- `pnpm build` 零错误
- studio 中 `import { } from '@storyweaver/core'` 编译通过

## Steps

### Step 1: 根配置文件

创建以下文件：

```
StoryWeaver/
├── package.json              # name: storyweaver, private: true, scripts: { build, dev, lint, format }
├── pnpm-workspace.yaml       # packages: ['packages/*']
├── tsconfig.base.json        # 共享 TS 配置 (target: ES2022, module: ESNext, strict)
├── tsconfig.json              # extends tsconfig.base.json (根级引用)
├── .gitignore
├── .prettierrc
├── .eslintrc.cjs
```

### Step 2: packages/core 包

```
packages/core/
├── package.json              # @storyweaver/core, main/dist/module 导出
├── tsconfig.json             # extends ../../tsconfig.base.json
├── tsup.config.ts            # entry: src/index.ts, format: esm/cjs
├── vitest.config.ts
└── src/
    └── index.ts              # export const VERSION = '0.1.0'
```

### Step 3: packages/studio 包

```
packages/studio/
├── package.json              # @storyweaver/studio, deps: @storyweaver/core
├── tsconfig.json
├── vite.config.ts            # React plugin + dev proxy 配置
├── index.html
└── src/
    ├── main.tsx              # React 入口
    └── App.tsx               # 导入 core 验证依赖可用
```

### Step 4: 验证构建流水线

- 运行 `pnpm install`
- 运行 `pnpm build`
- 确认两个包均构建成功
- 确认 studio 可导入 core

## Tasks

- [ ] 创建根配置文件 (package.json, pnpm-workspace.yaml, tsconfig, gitignore, prettier, eslint)
- [ ] 创建 packages/core 包骨架
- [ ] 创建 packages/studio 包骨架
- [ ] 验证 pnpm install + pnpm build 通过

## Blockers

- 无

## Open Questions

- 无

## Parent Goal

- G01 — Phase 1: MVP (roadmap)
- 完成后继续 → G01-S02 Core 类型定义

## Sync Notes

- 目标激活自 roadmap G01-S01
