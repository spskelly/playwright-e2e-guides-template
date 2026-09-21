# Getting started

This path reaches a successful local run before discussing architecture.
Commands work unchanged in PowerShell 5.1, PowerShell 7, and common Unix
shells.

## 1. Get the repository

Use the GitHub template button, or clone it:

    git clone https://github.com/spskelly/playwright-e2e-guides-template.git
    cd playwright-e2e-guides-template

## 2. Install locked dependencies

    npm ci

Use Node.js 20 or newer. Do not replace npm ci with npm install in CI because
the lockfile is part of the recording fingerprint.

## 3. Install Chromium

    npm run install:browsers

On Linux CI, use npx playwright install --with-deps chromium when operating
system libraries are also required.

## 4. Run the smoke tests

    npm run test:smoke

The two smoke tests start an isolated local server and verify the synthetic
home and sign-in pages.

## 5. Run the fast documented journey

    npm run test:journey

This runs the same journey used for recording without captions, pauses,
screenshots, or video.

## 6. Record and open the example guide

Preview the inventory and output location first:

    npm run guides:record -- --list

Record or resume the synthetic journey, then build and verify the site:

    npm run guides:record
    npm run guides:build
    npm run guides:verify
    npm run guides:open

The recorder writes one atomic checkpoint per journey under
.guide-work/current. An existing checkpoint is reused only when its workflow,
configuration, lockfile, recorder, and optional source revision still match.

guides:open serves the output over localhost. Stop it with Ctrl+C.

## 7. Find diagnostics

- playwright-report contains the HTML test report.
- test-results contains traces, failure screenshots, video, and server evidence.
- .guide-work/current contains validated checkpoints.
- .guide-work/current/.failed-* contains an incomplete recording kept for
  diagnosis.
- guides-site is the validated publication directory.

All of these runtime directories are ignored except source documentation.

## Complete local verification

    npm test
    npm run typecheck

Next, read [docs/ADAPTING_THE_TEMPLATE.md](docs/ADAPTING_THE_TEMPLATE.md).
