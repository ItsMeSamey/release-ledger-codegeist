# Release Ledger

Inspect the work that blocks a Jira issue. Release Ledger follows visible dependency links, shows cycles and unknowns, and lets you try hypothetical completions without changing Jira.

Start with a release or delivery issue. Choose the dependency link type, inspect the open ends of its chain, then try completing a task. The panel shows which direct dependents would lose their visible blockers. You can inspect the source evidence and copy a briefing into planning notes.

This adds a bounded dependency explanation and local scenario to Jira's issue links. Jira's native timelines and Plans also support dependency planning. This project has no measured speed advantage or user-study result against those features.

## Run the synthetic demo

Use a current Node.js version compatible with the locked dependencies, then run:

```sh
npm ci --ignore-scripts
npm run demo -- --port 8872
```

Open http://127.0.0.1:8872/?demo=1. The banner identifies invented issue data. This development preview needs no Jira account or credential. The production build disables that demo switch.

Run local tests and build with:

```sh
npm test
npm run build
```

The repository includes a compiled production UI in `dist/`. It needs a Forge issue-panel context; opening that build as a standalone website does not supply Jira evidence.

## Register your own Forge app

The public manifest is an unregistered template. It deliberately omits `app.id`. It is separate from the creator's registered private deployment configuration.

After setting up the official Forge CLI and your own authorized Atlassian account, run ordinary interactive `forge register` in this directory. Review its account, Developer Space and service terms. The CLI writes your new app ID into the manifest. Then build and use `forge lint --environment development`, `forge deploy --environment development` and `forge install --environment development` for your own site. Installation requires the appropriate site-admin access.

These commands are setup instructions, not an automatic deployment script. Atlassian's current allowances and overage terms apply. A missing payment method is not a spending cap. This project registers no Rovo agent or action and makes no LLM calls.

## What the evidence means

The panel reads Jira as the current user. It validates the link type, follows up to 60 issues and eight dependency levels, and stops traversal at Done issues. An unreadable or unvisited dependency remains unknown. Hidden links cannot be inferred.

A task with no visible open blockers can still lack capacity, approval or workflow readiness. The displayed order counts direct linked dependents cleared, then sorts by issue key. It is not a delivery forecast or a priority score.

Data stays in Forge request memory and the open panel's memory. The source has no persistent application store or external data service. An open tab has no fixed snapshot expiry. Read [Privacy](PRIVACY.md), [Terms](TERMS.md) and [Support](SUPPORT.md).

## Verification and credit

[Verification](VERIFICATION.md) records the tested scope, historical fixes and current limits. The native Jira proof used a small synthetic graph on one user's development site. The November 7 browser checks used the local synthetic preview; they do not establish current production behavior or narrow-layout pixels.

Created by Sanyam Singh Brar, publishing as ItsMeSamey. Implementation, tests, documentation and review were assisted by OpenAI Codex. [Third-party notices](THIRD_PARTY_NOTICES.md) identify the main dependencies. This repository contains the Jira panel; the earlier untested Rovo registration is excluded.
