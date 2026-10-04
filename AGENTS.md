# YamabikoLab/wpgp-tools repository instructions

These instructions apply to the entire repository.

## Working rules

- Make the smallest change that fully satisfies the current issue.
- Keep documentation aligned with code, commands, dependencies, and directories that exist on the current branch.
- Introduce shared abstractions only after a concrete shared responsibility exists.
- Do not commit secrets, credentials, personal paths, machine names, or other local-only environment details.

## Communication

- Do not narrate routine file reads, searches, edits, or successful commands unless the information helps the user make a decision or understand an important finding.
- Surface blocking issues, material changes in assumptions, required scope changes, and decisions that require user input.
- Keep communication concise and focused on information relevant to the requested work.

## Approval requests

- Request approval before taking a destructive, unexpected, or decision-sensitive action that is not already clearly authorized and could materially affect the repository, environment, dependencies, or user data.
- When approval is required, explain the action or issue, why a decision is needed, the expected effect or relevant options and tradeoffs, and the recommended choice. Keep simple, low-risk requests concise.
- Do not take an alternative approach or broaden the requested scope while such a material decision remains unresolved.
- Do not request additional approval for actions that are already clearly authorized by the user's request and applicable repository instructions.

## End-of-turn reports

- When repository work is performed, briefly report the work performed, changed files, validation results, and any open items.
- Do not require a structured work report for simple questions, explanations, or other responses that do not perform repository work.
- Never report validation as successful unless it actually ran successfully. If validation was not run or was intentionally left to the user, state that clearly.
- When changes are pushed, include a compare URL using the repository state at the start of the work and the pushed SHA.

## Review

- Prioritize correctness, data integrity, lifecycle, state ownership, accessibility, security, and meaningful performance issues.
- Avoid required fixes for low-frequency, low-impact presentation edge cases when the proposed complexity outweighs the impact.
- Do not add coordination layers, state, IDs, queues, or abstractions solely to eliminate negligible edge cases.

## Fork and upstream safety

- Treat the upstream repository `vlad-timotei/wpgp-tools` as read-only unless the user explicitly authorizes an upstream mutation in the current request.
- By default, all branches, commits, pushes, issues, comments, pull requests, reviews, releases, tags, and GitHub Actions mutations must target `YamabikoLab/wpgp-tools`.
- Do not create, update, close, merge, label, comment on, review, or otherwise mutate upstream issues or pull requests merely because upstream content is referenced during the task.
- Do not change Git remotes, push destinations, or pull request base/head repositories to upstream without explicit user authorization.
- Keep YamabikoLab-specific behavior isolated from upstream-derived code where practical. Prefer new fork-owned files, adapters, or integration points over embedding fork-specific responsibilities into upstream-derived files.
- Keep `src/js/wpgpt-checks.js` self-contained and suitable for reuse or proposal upstream. Do not introduce dependencies on YamabikoLab-only files, UI, storage conventions, or build infrastructure unless the requested work explicitly requires it.
- When modifying upstream-derived files, make the smallest necessary diff and avoid unrelated formatting, renaming, restructuring, or refactoring that would make future upstream synchronization harder.
- If a change appears suitable for upstream, implement and validate it in the YamabikoLab fork first. Do not publish, propose, or submit it upstream automatically; report it as a possible upstream candidate and wait for explicit user authorization.

## GitHub Actions

- Keep workflows narrowly scoped to their intended validation or security purpose.
- Treat GitHub-hosted Actions as the authoritative CI result.

## Validation

- Run the narrowest applicable checks while iterating.
- Do not invent commands for build, typecheck, Jest, Knip, or E2E before those responsibilities exist.
