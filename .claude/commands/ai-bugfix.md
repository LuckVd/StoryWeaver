引导 bug 修复流程：确认问题、排查根因、给出方案并验证修复。

Respond in Chinese for all user-facing natural language output. Keep commands, file paths, and code identifiers in their original form.

Use these skills when needed:

- `constraints-loader`
- `project-fit-check`

Required workflow:

1. **确认问题**：根据用户描述，阅读相关代码和文档，复现或确认 bug 是否真实存在。如果无法确认，向用户追问具体复现条件或错误信息。
2. **排查根因**：定位 bug 的根因，明确指出涉及的文件、函数或逻辑分支。向用户说明排查过程和结论。
3. **提出修复方案**：给出至少一个修复方案，说明每个方案的影响范围和权衡，让用户选择。根据用户的反馈和补充建议确定最终方案。
4. **执行修复**：按照确认的方案修改代码。修改应最小化，只修复目标 bug，不做无关重构。
5. **验证修复**：运行相关测试，确认 bug 已修复且未引入新问题。如果项目没有对应测试，建议补充一个回归测试。

Guardrails:

- 未确认 bug 存在前，不要开始修改代码。
- 未获得用户对修复方案的确认前，不要开始修改代码。
- 修复范围应最小化，不要借机做无关重构或代码风格调整。
- 如果修复可能影响其他模块，必须提前告知用户。
- 遵循项目已加载的约束。
