# Verification

Updated 7 November 2026. This record separates local checks, a past development-site proof and release preparation.

## Current release source

The production configuration exposes the Jira issue panel and its read-only resolver. The earlier untested Rovo agent, action and function registration are excluded. The public manifest also omits the creator's app ID. Register a new app before using Forge deployment commands.

The graph algorithm and Jira request functions retain the implementation used by the earlier development proof. The current UI includes keyboard continuity repairs and a refresh-race repair. While evidence refreshes, scenario controls are disabled. Accepting the response clears old assumptions.

Six focused checks passed on the private production stage: resolver initialization, production manifest exposure, local scenario/briefing/reset behavior, Done-root behavior, preserved historical manifest references, and deferred refresh behavior. The public package replaces private registered-manifest checks with a template-or-registered-fork check. The behavioral tests use synthetic data and a mocked Forge bridge, not a live Jira request.

One production build completed with the locked dependencies. Its output is supplied in dist. This does not establish that the build is installed in production.

The public manifest check passed separately. It accepts the supplied unregistered template or a fork with a valid non-nil registered ID, and checks the panel, resolver, read-only scope and compiled resource. Main application source and compiled UI match the private tested stage; private identity/history checks are not included in this package.

Current Forge lint is pending. Its preparation stopped before launching the CLI because the established credential handoff had been relocated. No provider authentication failure or current lint result is inferred from that local setup check. Earlier Forge lint and the development-site proof remain historical evidence. No current production deployment or external installation link is claimed.

## Preserved failures and fixes

The first staged manifest edit left part of the old action block. A YAML failure caught it before build. The corrected manifest is compared with the original private configuration, with only the intended registrations removed.

The first refresh regression failed at file level after a long run. A diagnostic attempt reached the final assertion and was stopped. Comparing a DOM object directly in a failed assertion produced an impractical diagnostic; comparing its presence as a Boolean gave a short, meaningful failure. That old-source failure showed a scenario created during refresh surviving the fresh response. The final regression verifies that scenario changes are blocked while waiting and that the accepted graph returns to the baseline.

The earlier resolver initialization failure and invoke acknowledgement timeout remain part of the project's development history. A later development-site proof succeeded; those earlier failures were not rewritten as successful runs.

## Earlier integration and browser evidence

On 31 October, a small synthetic Jira graph on one user's development site exercised fan-in, two hypothetical completions, a cycle and cleanup, invalid link-type rejection and recovery, and a Done root. This was a bounded integration check, not cross-user permission, scale or customer evidence.

On 7 November, normal browser controls in the local synthetic preview verified the baseline and scenario counts, unknown-issue display, reset and briefing visibility. A disappearing control initially left focus on the page body. The corrected path focused Reset after completion and the first completion control after reset. Navigation through a replaced evidence link also showed local keyboard continuity. The snapshot did not expose the exact heading identity or textarea value.

The refresh regression's focus assertion uses jsdom. It does not prove browser-native focus behavior. Pixel clipping, focus-ring appearance and current narrow-layout rendering were not established by those browser receipts.

A focused browser check of the new asynchronous refresh/error path is pending at this source release. Its test fixture uses the actual UI with a synthetic bridge and will be recorded separately. It does not access Jira.

## Scope of benefit

The app combines dependency paths, cycles, explicit unknowns and local what-if analysis around a selected Jira issue. It preserves unknown evidence instead of treating a failed read as completion. Native Jira issue links, timelines and Plans remain relevant alternatives. No measured speedup, user-study result, AI-agent result or competitive ranking is claimed.

Tests in this repository include the existing graph and link-type regressions. The November 7 focused run did not repeat the completed historical numerical or Jira fixture suite. Run npm test to execute the local suite on your own checkout.

## Provenance

Work began before this public repository was created. Earlier source, failed attempts and private integration receipts were retained locally. Public publication uses the real publication date; it does not invent earlier Git commits. Private account data, app identity, installation links and validation credentials are excluded.

Implementation, tests, documentation and review were assisted by OpenAI Codex. Independent reviews were also automated AI reviews, not a claim of separate human testing.
