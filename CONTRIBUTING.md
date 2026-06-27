# Contributing

Thanks for your interest in improving Ghost Connector for Claude. This doc covers the dev workflow and how releases happen.

## Development setup

```bash
git clone https://github.com/qutek/ghost-connector-claude-extension.git
cd ghost-connector-claude-extension
bun install
```

Requirements:
- [Bun](https://bun.sh) ≥ 1.3 (or Node ≥ 20 with npm — Bun is preferred, matches CI)
- A Ghost site for integration testing (Ghost Pro or self-hosted)

### Useful scripts

```bash
bun test             # run the test suite (node:test + experimental TS stripping)
bun run build        # esbuild bundle → build/server/index.js
bun run pack         # produce .mcpb via @anthropic-ai/mcpb
bun run validate     # validate manifest.json against the MCPB schema
bun run inspector    # launch mcp-inspector for interactive debugging
```

### Architecture

See the [Development section of the README](README.md#development) for the source tree.

## Making a change

1. Branch from `main`:
   ```bash
   git checkout -b feat/my-change
   ```
2. Make your change. Add or update tests under `test/`.
3. **Add a changeset** describing the user-facing impact:
   ```bash
   bunx changeset
   ```
   - Pick `ghost-connector`
   - Pick bump type: `patch` (bugfix), `minor` (new tool/feature), `major` (breaking)
   - Write a one-line summary — this becomes the changelog entry verbatim
4. Commit the changeset file (`.changeset/*.md`) alongside your code.
5. Open a PR. CI runs tests, build, and manifest validation.

If your change has no user-facing impact (refactor, docs, test-only), skip the changeset.

## Releases

Releases are fully automated — no manual tagging, no npm publish.

The flow:

1. A PR with a changeset is merged to `main`.
2. The **Release** GitHub Actions workflow runs. It opens (or updates) a *"Version Packages"* PR that:
   - Bumps `package.json` and `manifest.json` versions
   - Updates `CHANGELOG.md`
3. Maintainer merges the Version PR.
4. The Release workflow runs again. With no pending changesets, it:
   - Builds the bundle
   - Packs the `.mcpb`
   - Creates a `vX.Y.Z` Git tag + GitHub Release with changelog notes
   - Attaches the `.mcpb` as a release asset

Users install by downloading the latest `.mcpb` from the [releases page](https://github.com/qutek/ghost-connector-claude-extension/releases).

## Code style

- TypeScript strict mode (types checked locally even though esbuild strips them at build time).
- Zod schemas are the single source of truth for each tool — never hand-write a JSON Schema alongside.
- New tools belong in `src/tools/<domain>.ts`; register via the domain's `*Tools()` function.
- Prefer pure functions for testable logic; keep I/O at the edges.

## Reporting bugs

[Open an issue](https://github.com/qutek/ghost-connector-claude-extension/issues). Include:
- Ghost version
- Node/Bun version
- The exact error message (from Claude Desktop or the inspector)
- Steps to reproduce
