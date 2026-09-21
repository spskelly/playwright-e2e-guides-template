# Architecture

The template keeps application concerns at the edge and treats validated guide
output as a derived artifact.

## Flow

    synthetic or real app adapter
               |
               v
    page objects and application tests
               |
               v
    one documented Playwright journey
          |                 |
          v                 v
    fast regression    guide recording
                             |
                             v
                 atomic per-guide checkpoint
                             |
                             v
                  builder and verifier
                             |
                             v
                    static guide site

## Boundaries

e2e/app owns server lifecycle and deterministic data. e2e/pages owns reusable
interactions. e2e/journeys owns user outcomes. e2e/guide and scripts are
application-independent.

The recorder fingerprints the journey, guide configuration, lockfile, recorder,
and optional application revision. A matching complete checkpoint can resume.
A stale or incomplete checkpoint is replaced only after a new temporary unit
validates.

The builder compares checkpoint slugs with the live journey inventory. It
rejects missing, extra, duplicate, failed, stale, or unsafe inputs. It builds in
a temporary directory, verifies the complete site, and atomically replaces the
previous output.

The publication workflow receives only guides-site. Raw manifests,
test-results, traces, and .guide-work remain diagnostic.
