# Contributing

Keep changes focused, tested, and safe to publish.

## Development loop

1. Add or update a focused test.
2. Run the narrowest relevant command.
3. Run npm test and npm run typecheck before committing.
4. Review generated guide output over localhost when visuals change.
5. Stage named files and use a small, descriptive commit.

Do not commit node_modules, test-results, playwright-report, .guide-work,
guides-site, environment files, recordings, or local editor settings.

## Journey rules

Each file under e2e/journeys must contain exactly one guide-producing test and
one portable slug. Describe a user outcome, not a sequence of clicks. Use page
objects and stable accessible selectors. Keep synthetic data obvious.

## Pull requests

Explain the user outcome, tests run, and any privacy or publication impact.
Generated guides are diagnostic until the verifier accepts the complete site.

## Commit history

Use small logical commits. Do not force-push shared or published history.
