# Project Tree

只保留重要路径，保持紧凑。

```text
.
├── packages/
│   ├── core/src/                 # 核心引擎（无 React 依赖）
│   │   ├── agents/               # Writer/Brainstormer/Auditor/Summarizer/Curator + router + prompts + base-agent
│   │   ├── llm/                  # LLMClient 接口 + OpenAI Provider + factory
│   │   ├── models/               # 类型（book/chapter/chat/knowledge/memory/review/workspace/api/config/agent）
│   │   ├── search/               # InMemorySearchEngine（倒排索引 + 中英文分词 + summary 索引）
│   │   └── storage/              # 文件存储（book/chapter/version/knowledge/outline/relation/summary/workspace + path）
│   └── studio/src/
│       ├── api/                  # Hono 后端
│       │   ├── routes/           # book / chapters / chat / knowledge / search / summaries / reviews / workspace / events
│       │   ├── services/         # book / chapter / chat / knowledge / workspace / summary / review + file-watcher
│       │   ├── server.ts         # createServer（组装服务 + 路由）
│       │   └── start.ts          # 入口（serve :3001 + fileWatcher.start）
│       ├── pages/                # dashboard / chapters / chapter-edit / chat / knowledge / review / summaries / search / settings
│       ├── components/           # chapter / chat / editor(diff-viewer, version-panel, chapter-editor) / knowledge / layout / review / ui(confirm-dialog...)
│       ├── stores/               # zustand: book / chapter / chat / knowledge
│       ├── hooks/use-chat-sse.ts
│       ├── lib/                  # api-client / utils
│       └── App.tsx               # 路由
├── docs/ai/                      # 工作流：roadmap / current-goal(.state.yaml) / change-log / project-summary / project-tree / constraints / tech-spec-v1
├── .env                          # OPENAI_API_KEY / OPENAI_BASE_URL / OPENAI_MODEL / API_PORT（gitignored）
├── pnpm-workspace.yaml           # workspace + onlyBuiltDependencies
└── package.json
```

## Key Entry Points

- 后端：`packages/studio/src/api/start.ts` → `pnpm --filter @storyweaver/studio run dev:api`（:3001）
- 前端：`packages/studio/src/main.tsx` + `App.tsx` → vite（:3000，代理 `/api` → :3001）
- 一体启动：`pnpm --filter @storyweaver/studio run dev:all`（concurrently 前后端）
- core 导出：`packages/core/src/index.ts`

## Key Config Files

- `pnpm-workspace.yaml`（workspace 包 + `onlyBuiltDependencies`）
- `.env`（项目根；`start.ts` 从 `../../../../.env` 加载）
- `packages/studio/vite.config.ts`（:3000 + `/api` 代理 :3001 + 别名 `@`）
- `docs/ai/roadmap.md`（阶段 / 子目标 / 进度表，单一事实源）
- `docs/ai/constraints/`（`global.md` + `project.md`）

## Runtime Data（gitignored，由 studio 运行时生成）

- `packages/studio/volumes/vXX/chXXX.md` — 章节正文
- `packages/studio/knowledge/` — 知识库 JSON
- `packages/studio/memory/summaries/chXXX.json` — 章节摘要
- `packages/studio/reviews/chXXX-review-*.json` — 审稿报告
