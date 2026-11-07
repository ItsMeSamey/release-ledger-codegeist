# Third-party notices

The app uses React and React DOM 18.3.1, Forge API 8.4.0, Forge Bridge 7.2.1 and Forge Resolver 2.0.2. Vite 8.3.5 builds the frontend. Local checks use esbuild, jsdom and YAML. Exact resolved versions and integrity values are in package-lock.json.

React and the main local build/test tools use MIT licences; YAML uses ISC. The installed Forge packages direct users to the [Atlassian Developer Terms](https://developer.atlassian.com/platform/marketplace/atlassian-developer-terms/). Their supplied licence text is retained with the other notices.

The third-party directory preserves licence and notice files found in the existing installed dependency tree, including development dependencies. PACKAGES.json records their package names and versions. This is a notice collection, not a claim that every listed package is in the browser bundle. The dependency code itself is obtained through the lockfile; the compiled UI includes the dependencies needed by that build.

The issue graph in the local demo is invented. Jira and Atlassian names identify the integration; this project is an independent app.
