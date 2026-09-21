# Playwright E2E Guides Template

Use one Playwright journey twice: as a fast regression test on every change and
as a checkpointed recording that produces a validated static guide site.

The repository includes a deterministic synthetic application. It needs no
database, cloud service, secret, or paid API.

## Start here

Follow [GETTING_STARTED.md](GETTING_STARTED.md) for a complete first run. The
short version is:

    npm ci
    npm run install:browsers
    npm test

The synthetic account is alex@example.test with password
synthetic-password. The reserved example.test domain makes it visibly
non-production data.

## What is included

- An application-independent guide recorder and Playwright fixture.
- Checkpointed, resumable guide recording.
- Atomic static-site generation with inventory validation.
- Markdown, HTML, JSON, WebVTT, screenshots, and WebM output.
- A local synthetic server, two page objects, and smoke, behavior, failure-path,
  journey, and guide-core tests.
- Separate CI workflows for testing and Pages publication.

## Repository map

    e2e/app/          synthetic API and server adapter
    e2e/guide/        reusable recorder, manifest, schema, and styles
    e2e/journeys/     documented user outcomes
    e2e/pages/        example page objects
    e2e/tests/        application and guide-core tests
    scripts/          recorder, builder, verifier, and local site server
    docs/             adaptation, authoring, architecture, and CI guidance

Read [docs/ADAPTING_THE_TEMPLATE.md](docs/ADAPTING_THE_TEMPLATE.md) before
connecting the template to a real application.

## Safety model

Raw recordings and failed checkpoints stay in ignored diagnostic directories.
Only guides-site is publication-ready, and only after guides:verify succeeds.
URL credentials, fragments, and unapproved query parameters are removed from
manifests. Screenshots support default and per-step masks, while sensitive
actions can be hidden from the entire video.

## License

MIT. See [LICENSE](LICENSE).
