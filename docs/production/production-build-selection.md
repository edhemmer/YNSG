# Production build selection

Advances WEB-13 release operations. Both Vercel projects use the same built-in-only guard through `ignoreCommand`, with project-relative paths in their configuration. CI is unchanged: every pull request still receives full application/build/native/PostgreSQL checks.

## Pass/fail contract

- Continue building for any runtime source, migration, package/lockfile, deployment configuration, build/generation script, unknown path or change to the guard itself. No blanket scripts/config exemption.
- Ignore only explicit operator-tool paths, tests, engineering docs, two non-runtime completion/history registers and root README/AGENTS files. If runtime source/build code references any affected path or filename, build conservatively even if the reference is only a comment.
- Compare `VERCEL_GIT_PREVIOUS_SHA` (the last successful project/branch deployment) to the actual checked-out `VERCEL_GIT_COMMIT_SHA`. Do not compare only HEAD's immediate parent: an intervening runtime commit must never disappear behind a later documentation commit.
- Require both full commit identities, matching HEAD and a proven ancestor baseline. Missing/shallow/unavailable/diverged history, malformed diff, process errors or missing deployment context builds by default.
- Same-commit redeploys build, preserving the normal environment/configuration refresh path. `YNSG_FORCE_BUILD=1` deliberately forces a build, including a milestone release or a manual deployment requiring a new exact-SHA artifact.
- Return Vercel's documented semantics: exit zero ignores; exit one continues. No network, credentials, API calls or package install in the guard. It does not merge code, bypass CI, promote a preview or change domain assignments.
- Real isolated Git tests cover root/CRM working directories, multiple intervening commits, runtime changes behind documentation, runtime-to-doc renames, forced/manual rebuilds, uncertain baselines and referenced operator modules.

The installation changes both deployment configuration files, so that release must build normally. Later ignored builds keep the previous runtime artifact; a skipped tooling/docs commit must not be described as a new deployed application SHA. Compare actual aliases and deployed metadata when reporting runtime status. Full milestone acceptance can explicitly force a current-candidate build.

Official references: https://vercel.com/docs/project-configuration/vercel-json#ignorecommand and https://vercel.com/docs/environment-variables/system-environment-variables#vercel_git_previous_sha . Operational Vercel observation remains separate from isolated Git tests.
