# Penpal GitHub Release Notes

Use these patterns as a baseline, then inspect the current releases on GitHub
before drafting. They summarize Penpal's release history through v7.0.6.

## Gather Evidence

1. Inspect at least the latest major release and the latest three standard
   releases. Also inspect the most recent release of the same kind as the
   target.
2. Compare the target commit with the previous published version. Read the
   relevant commits, merged pull requests, tests, README migration guidance,
   and public type changes. Generated notes are an inventory, not final copy.
3. Include changes that affect consumers. Omit release machinery, test-only
   refactors, formatting, and dependency updates unless they change package
   behavior, compatibility, security, supported environments, or artifacts.
4. Describe observed behavior and migration work. Do not infer breaking changes
   or compatibility guarantees from commit subjects alone.

## Title

Use the exact tag, `v<version>`, for major, minor, patch, and prerelease titles.

## Stable Major Releases

An exact stable `X.0.0` receives a curated migration guide, not a short change
list. The current pattern is established most clearly by v7.0.0, with v6.0.0
and v5.0.0 providing earlier examples.

Use this structure when the corresponding content exists:

```markdown
Version X is here! <Brief statement of the release's scope.>

# Migration

<Required upgrade order, interoperability details, and migration links.>

# Breaking changes

## <Consumer-facing change>

### What

<Precisely describe the old and new contract.>

### Why

<Explain the engineering or user reason for the change.>

# New features

## <Feature>

<Describe the capability and link to its documentation.>

# Bug fixes

<List user-visible fixes included in the release.>
```

- Open with one short paragraph announcing the major version and its scope.
- Put migration guidance first when users must coordinate upgrades or change
  code. Make sequencing and cross-version compatibility explicit.
- Group breaking changes separately. Give each meaningful change `What` and
  `Why` subsections, as Penpal's v5-v7 major notes do.
- Follow with new features and bug fixes. Include only sections supported by
  actual release content; do not add filler such as an unverified claim that no
  bugs exist.
- Link to stable README sections or migration documentation for complete usage
  examples. Keep the release useful if those links are opened independently.
- Prefer consumer terminology and concrete API names over internal refactoring
  details.

## Standard Releases

Use this format for minor, patch, and prerelease versions:

```markdown
- <Concise consumer-facing change and its practical effect. Link an issue or PR
  when useful.>
- <Another change, if present.>

Thanks @contributor for the [contribution](pull-request-url)!
```

- Keep a single-change release to one focused paragraph or bullet. Use a short
  bullet list for multiple changes.
- State what changed and why a consumer would notice or care. Preserve precise
  API, error-code, package-format, and platform names.
- Link directly to relevant issues, pull requests, or documentation. Thank an
  external contributor when applicable, following the v5.3.0 and v6.2.0 style.
- Use the same concise style for prereleases. Mention its preview status only
  when it adds useful context; GitHub already displays the prerelease badge.
- Do not paste commit subjects, contributor inventories, or generic full
  changelogs. Penpal's recent v7 patch releases are intentionally direct and
  usually contain one consumer-focused bullet.

## Final Review

- Verify the title is exactly `v<version>` and the Markdown renders cleanly.
- Use Penpal, GitHub, npm, TypeScript, and Node.js capitalization consistently.
- Check links, issue numbers, PR numbers, code identifiers, and compatibility
  claims.
- Ensure a major release explains every public breaking change and its
  migration. Ensure a standard release stays concise.
- Remove generated boilerplate such as "What's Changed" and full-changelog
  compare links unless they add information not already conveyed.
