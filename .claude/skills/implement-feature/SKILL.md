---
name: implement-feature
description: Implement the next uncommitted task of one feature plan (F<N>) by handing it to the developer agent, then rerun its tests, show the report, and commit as "F<N>.T<k>: <title>" only after the user says yes. Use when the user runs /implement-feature F<N>.
argument-hint: F<N> (e.g. F1)
model: haiku
disable-model-invocation: true
---

# Implement the next feature task

Build the next uncommitted task of one approved plan with the `developer` agent, check it, then commit it after the user approves. This skill writes no code itself. It never edits the plan or the spec.

Target feature: **$ARGUMENTS**

## 1. Resolve the feature

- Accept `F1`, `f1` or `1`. No argument → ask which feature.
- Find `docs/plans/F<N>-*.md` and the spec with the same file name in `docs/specs/features/`. If either is missing, stop and say so.
- Read the plan's `_Status:` line. If it is not `Approved`, stop and say which status it has.

## 2. Check the working tree

- Run `git status --short`.
- Ignore anything under `docs/activities-outputs/`.
- If anything else is uncommitted, stop. Say the previous task is not committed yet, and list the files.

## 3. Pick the next task

- Run `git log --format=%s` and collect the subjects that start with `F<N>.T<k>:`. Those tasks are done.
- The next task is the first `### F<N>.T<k>` heading in the plan, in plan order, with no matching commit.
- If every task is committed, say the feature is done and stop.
- Tell the user which task is next, and which tasks are already done.

## 4. Hand the task to the agent

Call the `developer` agent (Agent tool, `subagent_type: developer`). Send only:

- the task ID and title, and its Files, Does, Covers and Done when lines, copied exactly from the plan;
- the text of each AC and rule the task covers, copied from the spec;
- the rows of the spec's API table for every endpoint the task builds or calls, copied exactly, including request and response bodies and error shapes;
- the spec path and the plan path.

Never send the whole plan.

## 5. Verify

Do not trust the agent's report alone.

- Rerun each command in the task's Done when line yourself.
- Skip any command that starts a long-running server (`npm run dev`). List it as a manual check for the user.
- A test command that reports "No tests found" or 0 tests run is a failure, not a pass, unless the task's Covers line says it has no ACs.
- Show:
  - the agent's report, unchanged;
  - the test command and its result: pass or fail, and the names of any failing tests;
  - the output of `git status --short`;
  - any changed file that is not in the task's Files list, flagged for review.

## 6. Retry at most once

- Allow at most two agent runs per task.
- If the first run is Blocked or Partial, or the tests fail, call the agent once more. Send the same task, plus the failure output or the blocker.
- If the second run still fails, stop. Do not commit. Do not edit the plan or the spec.
- Say what is unclear or failing. Tell the user to clarify the plan task, then run `/implement-feature F<N>` again.

## 7. Commit only after a yes

When the tests pass, ask:

> Commit as "F<N>.T<k>: <title>"? (yes/no)

- Commit only after an explicit yes.
- Stage only the files the task changed, with `git add <paths>`. Never use `git add -A`. Never stage anything under `docs/activities-outputs/`.
- Run `git commit -m "F<N>.T<k>: <title>"`.
- Never push.
- On no, leave the changes uncommitted and stop.
- After committing, tell the user to run `/clear` before the next task.
