Drive the current-goal workflow for **one sub-goal at a time**.

Respond in Chinese for all user-facing natural language output. Keep commands, file paths, and code identifiers in their original form.

Use these skills when needed:

- `goal-discovery`
- `goal-design`
- `constraints-loader`
- `project-fit-check`
- `tdd-execution`

## Core Rule: One Sub-Goal Per Cycle

This command operates on a **single sub-goal** (e.g. `G01-S03`) from the roadmap, NOT an entire phase. The workflow:

1. Read `roadmap.md` and `current-goal.state.yaml`.
2. Find the **next sub-goal** to work on:
   - If `current-goal.state.yaml` has a completed sub-goal → pick the next one in dependency order.
   - If no active goal → pick the first `planned` sub-goal that has all dependencies satisfied.
   - User may explicitly pass a sub-goal ID as argument (e.g. `/ai-goal G01-S05`).
3. Write **only that sub-goal** into `current-goal.md` with:
   - Goal ID and title
   - Specific acceptance criteria (for this sub-goal only)
   - Concrete file list to create/modify
   - Key implementation points
   - Test plan
   - Steps (broken down to task level)
4. Update `current-goal.state.yaml` with the sub-goal ID and `stage: confirm_plan`.
5. **Wait for user confirmation before coding.**
6. After implementation, mark the sub-goal as done in roadmap, then the user can run `/ai-goal` again for the next one.

## Workflow Stages

- `discover` → read roadmap, find next sub-goal
- `design` → write detailed plan for this one sub-goal
- `confirm_plan` → update current-goal files, wait for user OK
- `implement` → code, test, commit
- `done` → mark complete in roadmap, suggest next sub-goal

## Guardrails

- NEVER set an entire phase (e.g. G01) as the current goal. Always drill down to a single sub-goal (e.g. G01-S03).
- NEVER start coding before explicit user confirmation.
- NEVER skip clarification when the design is ambiguous.
- Keep `current-goal.md` concise — only the active sub-goal, not the full roadmap.
- Reference `docs/ai/tech-spec-v1.md` for detailed design when needed.
- After completing a sub-goal, suggest the next one but do NOT auto-advance.
