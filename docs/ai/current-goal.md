# Current Goal

## Goal

G02-S09 — 文件监听：chokidar 监听 + 增量索引更新 + SSE 通知

## 验收标准

1. `FileWatcher` 使用 chokidar 监听 `volumes/**/*.md` 和 `knowledge/**/*.json`
2. 文件变化时增量更新 `InMemorySearchEngine` 索引
3. 文件变化时通过 SSE 广播 `file:changed` / `file:added` / `file:removed` 事件
4. `start()` 和 `stop()` 生命周期管理
5. `InMemorySearchEngine` 新增 `reindexChapter` / `indexChapterFromContent` 等方法支持增量更新
6. server.ts 集成：启动时创建 FileWatcher 并传入 SearchEngine + SSEEmitter
7. 所有新增代码有对应测试
8. `pnpm build` 零错误，`pnpm test` 全部通过

## 文件清单

### 新建
- `packages/studio/src/api/services/file-watcher.ts` — FileWatcher 服务
- `packages/studio/src/api/__tests__/file-watcher.test.ts` — FileWatcher 测试

### 修改
- `packages/core/src/search/search-engine.ts` — 新增增量更新方法
- `packages/core/src/search/__tests__/search-engine.test.ts` — 新增测试
- `packages/studio/src/api/server.ts` — 集成 FileWatcher

## 实现要点

### 1. InMemorySearchEngine 增量更新

新增方法：
- `updateChapter(id, title, content)` — 更新已有章节索引（先 remove 再 index）
- `updateKnowledge(id, title, content)` — 更新知识库条目
- `removeByPath(filePath)` — 根据文件路径移除文档

### 2. FileWatcher

```typescript
class FileWatcher {
  constructor(
    private searchEngine: InMemorySearchEngine,
    private sseEmitter: SSEEmitter,
    private projectRoot: string,
  )

  start(): void   // 启动 chokidar 监听
  stop(): void    // 关闭监听
}
```

事件处理：
- `change` → 解析文件路径 → 增量更新 SearchEngine → emit `file:changed`
- `add` → 解析文件路径 → 添加到 SearchEngine → emit `file:added`
- `unlink` → 解析文件路径 → 从 SearchEngine 移除 → emit `file:removed`

路径解析：
- `volumes/vXX/chXXX.md` → chapter 类型，提取 chapter ID
- `knowledge/**/*.json` → knowledge 类型，提取文件名作为 ID

### 3. server.ts 集成

```typescript
const searchEngine = new InMemorySearchEngine();
// rebuild 从文件系统加载索引
const fileWatcher = new FileWatcher(searchEngine, sseEmitter, projectRoot);
fileWatcher.start();
```

### 4. chokidar 依赖

需要安装 `chokidar` 到 `@storyweaver/studio`。注意：chokidar 是 dev server 依赖，不影响前端 bundle。

## 测试计划

- **SearchEngine 增量更新**: 测试 updateChapter / updateKnowledge / removeByPath
- **FileWatcher**: mock chokidar + SearchEngine + SSEEmitter，测试路径解析和事件分发

## Steps

1. **安装 chokidar** — `pnpm --filter @storyweaver/studio add chokidar`
2. **SearchEngine 增量方法** — updateChapter / updateKnowledge + 测试
3. **FileWatcher** — 实现 + 测试
4. **server.ts 集成** — 启动时创建 FileWatcher
5. **构建验证** — `pnpm build` + `pnpm test`

## Parent Goal

- G02 — Phase 2: 核心流水线 (roadmap) → **in progress**
