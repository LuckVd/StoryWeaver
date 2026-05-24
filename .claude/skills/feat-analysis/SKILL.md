# feat-analysis

Use this skill when `/ai-feat` needs to analyze and decompose a feature request.

Use Chinese for all user-facing natural language output. Keep commands, file paths, and code identifiers in their original form.

Workflow:

1. Parse the user's feature description and extract key requirements, constraints, and implied expectations.
2. Read `docs/ai/current-goal.md` to understand the active goal and current progress.
3. Inspect the relevant source files and project structure to understand what already exists and where the new feature should integrate.
4. Decompose the feature into concrete, actionable requirement items.
5. Identify every ambiguity, missing detail, or assumption that could materially change the implementation.
6. Present the decomposed requirements and ambiguity list to the user for clarification.

Output:

- 需求拆解列表：每个需求点的具体描述
- 不明确项清单：需要用户进一步确认的问题
- 现有代码关联：特性涉及哪些已有模块和文件
- 当前目标影响：该特性与 current-goal 的关系和潜在冲突

Rules:

- Do not design the solution at this stage; focus on understanding and clarifying requirements.
- Base analysis on the actual codebase, not assumptions.
- If the feature conflicts with the current goal or constraints, flag it explicitly.
- Keep questions concrete and actionable, avoid vague open-ended prompts.
