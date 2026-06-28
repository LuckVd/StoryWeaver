# AI 写作上下文注入架构

> 分支 `feat/context-injection`。重构「让 AI 帮我写小说」的核心:AI 拿到的上下文从"全量注入 + 预算盲"升级为"优先级四档 + 全局预算 + 按需 agentic 探索"。

## 一、四档注入模型(替代全量拼装)

`core/memory/injection-builder.ts` 的 `buildInjection` 按优先级产出四档,溢出从低优先级丢:

| 档 | 内容 | 截断 |
|---|---|---|
| **① 恒定** | 规则全量(按优先级)+ **当前章大纲导航**(±前后相邻)+ 剧情状态快照 | ❌ 不截断(绝对保留) |
| **② 当前章** | 章节标题/卷序 + 正文**尾部 2000 字**(接续点) | 按预算 |
| **③ 相关** | 按当前章实体检索的设定 + 远期记忆(相关章节/待回收伏笔/综合总结)+ 角色状态 | 按预算 |
| **④ 填充** | 近章摘要(近→远) | 按预算 |

最终 messages:`[Agent 人格]`(agent 自加)→ ① → ② → ③ → ④ → 滑动窗口对话历史。

## 二、全局预算协调

`coordinateBudget`:窗口 `W − ① − 输出(4000) − 真实对话 = 剩余`;②=20%、③=60%、④=剩余。**① 绝不丢**(规则/大纲/状态优先级最高)。对话走滑动窗口(窗口的 15%,从最新往回取)。

修掉的历史问题:旧 `calcLayer3Budget` 没计入知识库/章节正文/真实对话长度,`dialogHistory` 用固定 3500 估算 → 现在各档共享真实预算。

## 三、大纲当前章定位

`core/memory/outline-locator.ts`:`OutlineNode.chapterId` 精确定位当前章节点 + 前后相邻(`getOutlineNeighbors`)。chapterId 缺失 → 返回 null,跳过①的大纲部分(不解析标题,不可靠)。AI 现在知道"这章按计划该写什么"。

## 四、知识库相关性检索(替代全量)

旧:`buildKnowledgeContext` 全量注入 8000 字符,规则排第 5 易被截断。
新:`InMemorySearchEngine.search(entities, 'knowledge')` 按当前章涉及的角色/地点召回相关设定(top8)。`file-watcher.extractKnowledge` 索引补全 aliases/tags/profile,提升召回。

## 五、brainstormer 原生 FC agentic

构思是开放式任务,brainstormer 可按需调用只读工具查阅资料(不止静态注入):

- **原生 function calling**:`openai-provider` 透传 tools/解析 tool_calls,GLM/OpenAI/DeepSeek 共用一处覆盖;不支持 FC 的 provider 自动降级(忽略工具直接回答)。
- **5 工具**(`studio/api/services/agent-tools.ts`):`search_knowledge` / `get_character_history` / `search_chapters` / `get_hook_detail` / `get_outline_node`。
- **循环**:`BaseAgent.chatWithToolsStream` —— 非流式收集 toolCalls → 执行 → 追加 → 再调(≤5 轮)→ 伪流式输出最终回答。
- **SSE `agent:thinking`** 广播"查询 X",前端可选展示。

## 六、关键文件

| 文件 | 职责 |
|---|---|
| `core/memory/injection-builder.ts` | 四档构建 + 全局预算协调 |
| `core/memory/outline-locator.ts` | 大纲当前章定位(纯函数) |
| `core/agents/base-agent.ts` | `chatWithToolsStream` 工具执行循环 |
| `core/llm/openai-provider.ts` | 原生 FC 透传(覆盖 GLM/OpenAI/DeepSeek) |
| `studio/api/services/chat-service.ts` | 对话编排(路由 → 四档注入 → 流式/agentic) |
| `studio/api/services/agent-tools.ts` | brainstormer 5 工具 + executor |

## 七、设计原则

- **人主导、AI 辅助**:AI 只产出草稿,落不落、怎么落(append/replace)由人定。
- **规则不可丢**:① 恒定档绝对保留,溢出永远从 ④ 开始丢。
- **确定性优先**:writer/auditor 走静态四档(快、稳、可测);agentic 只给探索性的 brainstormer。
- **降级处处存在**:记忆/知识库/检索/FC 任一环节失败均降级为空或静态,不阻断对话。
