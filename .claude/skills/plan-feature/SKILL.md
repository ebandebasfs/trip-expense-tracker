---
name: plan-feature
description: Turn one Approved feature spec for the Trip Expense Tracker (F<N>) into an implementation plan in docs/plans/, with small ordered tasks and a unit test for every acceptance criterion. Use when the user runs /plan-feature F<N>, says plan feature F<N>, or asks for the plan of a feature by its ID.
argument-hint: F<N> (e.g. F2)
model: haiku
---

# Plan a feature

Turn one approved spec in `docs/specs/features/` into a build plan at `docs/plans/F<N>-<slug>.md`. The plan is the only file this skill writes.

Target feature: **$ARGUMENTS**

## 1. Resolve the feature

- Expect an ID like `F2` (accept `f2` or `2`). No argument → list the spec files in `docs/specs/features/` by ID and name, and ask which one.
- Find the spec whose file name starts with that ID (`F2-*.md`). Not found → say so, list the specs that exist, and say to run `/spec-feature F<N>` first if the feature has no spec. Don't guess a close match.
- `<slug>` = the spec's file name without `.md`, so the plan matches it (`F2-trips.md` → `docs/plans/F2-trips.md`).

## 2. Check the spec is ready

Read the whole spec. If any check fails, stop and write nothing.

- **Status:** the `_Status:` line must say `Approved`. Otherwise say which status it has.
- **Open questions:** no `- [ ]` line may remain. Quote each unticked question.
- **Placeholders:** no "copy needed", "TBD", or unfilled template text such as `<YYYY-MM-DD>`. Quote each one with its line number.

When something blocks the plan, list every blocker, then say: "Fix this in the spec with `/spec-feature F<N>`, then run `/plan-feature F<N>` again."

## 3. Gather context (read, don't skim)

- The whole spec.
- `docs/specs/product.md`, `CLAUDE.md`, and every file in `docs/rules/`.
- Every file in `docs/plans/`, if the folder exists. Reuse their task structure. If the spec depends on a feature whose plan exists, reuse that plan's tasks for shared work instead of planning it again, and say so in the Summary.

## 4. Break the work into tasks

- Give tasks IDs `F<N>.T1`, `F<N>.T2`, and so on. Each task is one commit's worth of work. Its commit message starts with the task ID (for example `F3.T2 add people repository`), which the session hook uses to remind the user to run `/clear`.
- Order the tasks so each builds only on the ones before it. Put the pure domain logic (`app/api/src/domain/`) before the services that use it, and the services before the controllers and UI.
- Each task lists:
  - **Files:** real paths that follow the CLAUDE.md layout (`app/api/src/<feature>/…`, `app/api/src/domain/…`, `app/api/prisma/…`, `app/web/src/app/…`, `app/web/src/components/…`, `app/web/src/lib/…`). Put each unit test file next to the code it tests, named `*.spec.ts` or `*.test.tsx`. Say for each file whether it is new or changed.
  - **Does:** what the task builds, in a few short lines.
  - **Covers:** the requirement and AC IDs the task delivers.
  - **Done when:** a check anyone can run. Name the test and the CLAUDE.md command, for example `npm test -w app/api -- -t "\bF3\.AC4\b"` passes.

## 5. Map every acceptance criterion

- Every `**F<N>.AC<k>**` in the spec gets exactly one row in the coverage table.
- Plan unit tests only (project rules). Each row names the test file and a test name that starts with the full AC ID, for example `F3.AC4 rejects a duplicate name`.
- Write "code review" only for what project-rules.md says unit tests can't prove: the ownership check in database queries, database constraints, and cascading deletes. Give a one-line reason.
- If an AC seems to need a real database or the full app, move the logic into a pure function or a service with fakes, so a unit test can prove it. Use "code review" only if that still isn't possible.
- Plan no integration or end-to-end tests.

## 6. Product questions stop the plan

Technical choices that stay within the spec and CLAUDE.md go in the plan's Decisions log. If planning raises a product question (behavior, limits, copy, scope, priority), stop and write nothing. Name the question, and tell the user to take it back to the spec with `/spec-feature F<N>`. Never edit the spec or `docs/specs/product.md` from this skill.

## 7. Revise, don't restart

If `docs/plans/F<N>-<slug>.md` already exists, read it and revise it. Keep every Decisions log entry. If the spec has changed since the plan was written, update the tasks and the coverage table to match. If the plan was `Approved` and its substance changes, set it back to `Draft` and note that in the Decisions log.

## 8. Check, then save

Before saving, check that:

- every AC ID in the spec appears in the coverage table exactly once, and no table row names an AC the spec doesn't have;
- every task has Files, Does, Covers and Done when;
- every ID in a task's Covers list exists in the spec.

Fix any failure first. Then fill in [plan-template.md](plan-template.md), the template in this skill's folder, and save it to `docs/plans/F<N>-<slug>.md` with `_Status: Draft_`. Create `docs/plans/` if it does not exist.

## 9. Finish

Reply with:

- the file path;
- the number of tasks;
- AC coverage: how many ACs are mapped, and how many of those are "code review";
- any shared work reused from another plan.

Then ask whether to approve the plan. Set `_Status: Approved_` (with today's date) only when the user explicitly says yes, in this run or later. Never approve a plan on your own.
