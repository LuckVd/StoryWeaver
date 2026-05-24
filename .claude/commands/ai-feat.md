引导轻量特性开发流程：需求澄清、方案设计、实现与验证。

本命令是 `/ai-goal` 的轻量替代，适用于已有当前目标下的临时特性开发。不修改 `roadmap.md`，不进行阶段提交。

Respond in Chinese for all user-facing natural language output. Keep commands, file paths, and code identifiers in their original form.

Use these skills when needed:

- `feat-analysis`
- `constraints-loader`
- `project-fit-check`

Required workflow:

1. **需求分析与澄清**：根据用户输入，阅读项目代码和 `current-goal.md`，理解当前开发上下文。将用户描述拆解为具体需求点，对不明确的地方逐一追问，直到所有需求都清晰无歧义。
2. **设计特性方案**：结合项目现有代码结构、当前目标进度和已加载约束，给出一份完整的特性开发文档，包含：
   - 需求摘要
   - 涉及的模块和文件
   - 实现步骤（细化到可执行的任务）
   - 验收标准
   - 测试方案
   - 与现有代码的集成方式
   提交给用户确认。
3. **迭代优化方案**：根据用户的反馈和建议修改开发方案，直到用户确认最终方案。
4. **实现与验证**：按照确认的方案进行开发，开发完成后运行相关测试验证功能正确性。
5. **记录结果**：在 `docs/ai/current-goal.md` 中新增本次特性开发的结果记录，包含实现内容、修改的文件和验收状态。

Guardrails:

- 不修改 `roadmap.md`。
- 不自动执行 git commit 或 git push。
- 未获得用户对方案的明确确认前，不开始编码。
- 修改应融入现有项目结构，不创建孤立代码。
- 遵循项目已加载的约束。
- 如果发现需求与当前目标冲突，必须先向用户确认如何处理。
