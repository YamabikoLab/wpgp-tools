# YamabikoLab/wpgp-tools repository instructions

These instructions apply to the entire repository.

## Working rules

- Make the smallest change that fully satisfies the current issue.
- Keep documentation aligned with code, commands, dependencies, and directories that exist on the current branch.
- Introduce shared abstractions only after a concrete shared responsibility exists.
- Keep Gutenberg-specific and Divi-specific integration responsibilities outside shared logic.
- Prefer public WordPress and Divi APIs at integration boundaries.
- Do not commit generated dependencies or build output such as `node_modules/`, `vendor/`, or `build/`.
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

## GitHub Actions

- Keep workflows narrowly scoped to their intended validation or security purpose.
- When `.github/workflows/` changes, review the final diff for unrelated changes and obsolete assumptions.
- Treat GitHub-hosted Actions as the authoritative CI result.

## Validation

- Run the narrowest applicable checks while iterating.
- Do not invent commands for build, typecheck, Jest, Knip, or E2E before those responsibilities exist.
