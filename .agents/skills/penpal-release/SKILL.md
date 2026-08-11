---
name: penpal-release
description: Prepare and publish a specific Penpal npm prerelease or stable version, including updating and committing package versions, running release checks, dispatching the repository's GitHub Actions workflow, and curating and verifying its GitHub Release. Use only when the user explicitly asks to publish an exact Penpal version; do not use for release planning or readiness reviews.
---

# Penpal Release

Prepare and publish the exact version requested by the user. Treat the Release
Workflow section of `CONTRIBUTING.md` as authoritative.

## Safety Contract

- Require explicit authorization to publish an exact version. Do not interpret
  requests to prepare, review, test, or plan a release as authorization.
- Never run `npm publish` locally. Dispatch `.github/workflows/release.yml`,
  which publishes through npm trusted publishing.
- Never create, move, overwrite, or force-push a release tag locally. The
  workflow creates the tag after publication.
- An explicit request to publish an exact version authorizes changing only
  `package.json` and `package-lock.json` for that version, committing those
  changes, and pushing the version commit to the required release branch.
- Do not merge, rebase, switch branches, or include unrelated changes as an
  implicit part of publishing. Stop and explain any missing preparation.
- If preparation or validation fails after changing the version, do not commit,
  push, publish, or silently undo the files. Report the failure and leave the
  visible version changes for the user to review.
- Do not replace an existing release's notes unless it is the requested release
  and its tag resolves to the expected commit.

## Publish Workflow

1. Read `CONTRIBUTING.md` and `.github/workflows/release.yml` before acting.
2. Validate the exact target version from the user's request and derive:
   - tag: `v<target-version>`
   - channel: `next` for a prerelease, otherwise `latest`
   - required branch: `<major>.x` for a prerelease, otherwise `main`
3. Confirm the current branch is the required branch and the working tree is
   clean. Fetch the branch and tags, then confirm `HEAD` exists on and exactly
   matches `origin/<branch>`. Stop on any mismatch.
4. Verify `gh auth status` succeeds for GitHub.com. If `gh` is unavailable,
   install it only with the user's approval and then authenticate it.
5. Check npm and GitHub for the target version and tag before modifying files.
   Stop if either identifies a different release commit. If publication is
   partially complete, enter recovery only when the repository already contains
   the exact target version; do not create a new version commit.
6. Read the current versions from `package.json` and `package-lock.json`. If they
   do not already equal the target, set the exact target without creating a
   commit or tag:

   ```sh
   npm version <target-version> --no-git-tag-version
   ```

   Verify both files contain the exact target and no other tracked file changed.
   Stop if the target is not a valid forward SemVer transition or the diff
   contains anything beyond the expected version fields.

7. Run every release check documented in `CONTRIBUTING.md`, including the full
   browser matrix, package-content inspection, and fresh downstream-consumer
   smoke test. Stop on failures.
8. If step 6 changed the version, review the diff and create a commit containing
   only `package.json` and `package-lock.json` with the message
   `Prepare v<target-version>`. Push that commit to `origin/<required-branch>`,
   then verify local `HEAD` exactly matches the remote branch. If the repository
   already contained the committed target version, do not create an empty or
   duplicate version commit.
9. Draft the release title and Markdown description in a temporary file before
   dispatching. Read [release-notes.md](references/release-notes.md), inspect the
   releases currently on GitHub, and verify every claim against the commits,
   pull requests, documentation, and code since the previous release.
10. Dispatch and monitor the workflow:

```sh
gh workflow run release.yml --ref <required-branch>
gh run list --workflow release.yml --branch <required-branch> \
  --event workflow_dispatch --limit 1
gh run watch <run-id> --exit-status
```

Identify the run created by this dispatch; do not assume an older run is the
target merely because it is listed first.

11. After the workflow succeeds, update the requested GitHub Release with the
    drafted title and description:

```sh
gh release edit <tag> --title <title> --notes-file <temporary-notes-file>
```

Preserve the workflow's prerelease/latest classification. If editing fails
after npm publication, retry the edit and clearly report the partial state
rather than rerunning publication blindly.

12. Verify all final state independently:
    - `npm view penpal@<target-version> version` returns the version.
    - The expected npm dist-tag points to the version.
    - The Git tag resolves to the expected release commit.
    - The GitHub Release has the exact requested tag, expected prerelease state,
      curated title, and curated description.
13. Report the version, version commit, npm channel, workflow run, package, and
    GitHub Release URLs, plus any recovery action that was needed.

## Release Notes

Use `v<version>` as the title for every release. Use the stable-major format
only for an exact stable `X.0.0`; use the concise standard format for minor,
patch, and prerelease versions. Always inspect recent GitHub Releases at publish
time because established wording and structure may evolve.
