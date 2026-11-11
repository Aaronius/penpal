# Repository Instructions

## Code comments

- Write for a developer who is new to Penpal. Name the method, callback, or side
  of the connection when a phrase like "the method" leaves the reader guessing.
  Give enough context to understand any protocol terms the comment relies on.
- Explain why the code is needed and connect the trigger to its consequence.
  For example, say that `initialize()` can call `onDisconnect()`, which closes
  the connection before Penpal sends its initial handshake message.
- State the general behavior first. Use concrete examples when they help, and
  make clear that they illustrate a broader rule.
- Before finishing, reread each new or edited comment alongside the nearby
  code. Check that a reader can tell who does what, when it happens, and why it
  matters without having to trace other files or callers.

## Defensive code

- Avoid adding guards or recovery branches for states or message sequences that
  Penpal cannot produce in supported use. Trace the actual code path first.
- Before adding a defensive check, identify the realistic scenario or public
  contract that requires it.

## Releases

- Treat the Release Workflow section in `CONTRIBUTING.md` as authoritative.
- Use the repository-local `penpal-release` skill for actual publication.
- Publish only when the user explicitly requests a specific version. A request
  to prepare, plan, review, or test a release does not authorize publication.
- An explicit publication request authorizes the skill to update, commit, and
  push the two package version files as documented in `CONTRIBUTING.md`.
- Never run `npm publish` locally; dispatch the repository's Release workflow.
- Never overwrite, move, or force-push an existing release tag.
