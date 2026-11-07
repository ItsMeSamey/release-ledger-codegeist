# Release Ledger privacy

For the Jira panel source in this repository. Updated 7 November 2026.

Release Ledger is maintained by Sanyam Singh Brar, who publishes as ItsMeSamey. Questions can be raised through the project's public support page. Use a synthetic example rather than private Jira content in a public report.

## Data used

The panel asks Jira for the current issue and visible linked issues using the current user's access. It reads issue keys, summaries, status, assignee information, update times and issue links. It also reads the site's issue-link type definitions. Jira responses pass through a Forge function. The returned graph includes the assignee's display name; it does not retain the assignee's account ID, email or avatar fields.

Issue summaries and display names can contain personal data. The panel uses these fields to show dependency evidence and prepare a briefing. Hypothetical completions stay in the panel and do not change Jira issues.

## Processing and retention

The app uses Atlassian Forge and the browser to process the graph. Its reviewed source uses no application database, persistent browser storage or external data service. It contains no application logging statements. Atlassian still operates the hosting, request and platform logging systems under its own policies.

The graph, scenario and briefing remain in the panel's memory. Refreshing replaces the graph. Closing or reloading the panel releases its application state. The current source has no automatic retention timer, so an open panel can retain a snapshot for more than 24 hours. Browser memory release is not a secure-erasure guarantee.

A briefing is displayed in a text area. If you copy it elsewhere, that destination's access and retention rules apply. The app does not send the briefing to an AI service.

## Access and changes

Jira controls which issues the current user can read when the app requests them. A displayed snapshot can become stale after an access or issue change. Refresh the panel to request current evidence. Corrections to source issue data should be made in Jira through the site's normal process.

The public support tracker is separate from Jira. Information you post there is public and is handled by its hosting platform. Use the support page for questions about this app's handling of data.

This page will be updated when the app's data handling changes. Atlassian's platform privacy information is available at https://developer.atlassian.com/platform/forge/faq-privacy-security/.
