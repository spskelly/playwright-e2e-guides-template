# Adapting the template

Replace components in this order so each step remains testable.

## 1. Change product metadata

Edit guide.config.json:

- productName, siteName, and siteDescription
- publicationBasePath for the final Pages URL
- allowedUrlQueryParameters
- defaultScreenshotMasks
- caption colors and timing only when there is evidence for the change

## 2. Replace the server adapter

e2e/app/server-adapter.ts owns application startup and shutdown. Replace
startExampleServer with an adapter that returns a base URL and an asynchronous
close function. Keep worker isolation and deterministic cleanup.

For a separately managed environment, return the configured URL and make close
a no-op. Do not embed secrets in the adapter.

## 3. Replace synthetic authentication and API fixtures

Replace e2e/app/mock-api.ts with deterministic fixtures or calls to a dedicated
test backend. Keep identities visibly synthetic. Put credentials in ignored
local environment files and CI secrets, never in source.

## 4. Add page objects

Put stable interaction boundaries in e2e/pages. Prefer labels, roles, and
purpose-built test identifiers. Keep assertions about user outcomes in tests
and journeys.

## 5. Replace example feature specs

Replace e2e/tests/app with small independently rerunnable groups:

- smoke paths
- important behavior
- failure and recovery paths

Run them without guide delays or video.

## 6. Replace the example journey

Replace e2e/journeys/create-task.workflow.ts with one outcome-oriented journey.
Each workflow file must declare exactly one guide and one portable slug.

## 7. Configure privacy controls

Review every page and URL the journey reaches. Add stable selectors to
defaultScreenshotMasks, allow only safe query parameter names, and wrap
credential or private-value entry in guide.sensitive.

Inspect native screenshots and representative video frames. A passing test does
not prove private pixels are absent.

## 8. Enable publication after review

Run the complete sequence locally:

    npm run guides:record -- --list
    npm run guides:record
    npm run guides:build
    npm run guides:verify
    npm run guides:open

Review the site at desktop and mobile widths. Enable the Pages environment only
after the repository, source revision, guide inventory, artifact size, and URL
are approved.
