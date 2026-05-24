# bugfix-investigation

Use this skill when `/ai-bugfix` needs to investigate and confirm a reported bug.

Use Chinese for all user-facing natural language output. Keep commands, file paths, and code identifiers in their original form.

Workflow:

1. Parse the user's bug description and extract key signals: error messages, stack traces, expected vs actual behavior, affected features.
2. Read the relevant source files, tests, and configuration to understand the code path involved.
3. Check whether the bug can be confirmed from the code alone (e.g., logic error, missing condition, wrong variable).
4. If the bug cannot be confirmed from reading, ask the user for additional context: reproduction steps, environment, logs, or specific inputs.
5. Once confirmed, trace the root cause and identify the minimal set of files that need to change.

Output:

- 确认结论：bug 是否真实存在
- 根因分析：涉及哪些文件和逻辑
- 影响范围：修复可能影响的其他模块或功能
- 信心等级：高 / 中 / 低

Rules:

- Do not modify any code during investigation.
- Base conclusions on evidence from the codebase, not assumptions.
- If the bug cannot be reproduced or confirmed, say so explicitly rather than guessing.
