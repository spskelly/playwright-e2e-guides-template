# Guide authoring

A guide should help a person achieve an outcome. It is not a transcript of
every click.

## Required metadata

Call guide.describe once with:

- a portable, stable slug
- a user-facing title
- a concrete description
- the intended audience
- relevant tags
- an honest estimated duration when useful

## Steps

Use imperative titles such as "Add a task to the project." Keep narration short
and explain why the step matters or what success looks like.

One guide.step should cover one meaningful state transition. Assert the visible
outcome inside the step so a failed action cannot produce publishable
documentation.

## Selectors and page objects

Prefer accessible roles and labels, then stable test identifiers. Put repeated
interactions in page objects. Avoid text selectors when translated or changing
copy is not the control's identity.

## Privacy

Default masks live in guide.config.json. A step can add selectors or locators
with its mask option. Use guide.sensitive around credential entry or other
actions whose intermediate frames must not appear in video.

The recorder removes URL credentials, fragments, and query parameters not on
the allowlist. Review the allowlist whenever a route changes.

## Screenshots, clips, and timing

Steps capture the viewport by default. Set screenshot to false when a visual
adds no value. Use clip with a stable selector when the relevant state is one
small panel.

GUIDE_STEP_PAUSE controls caption dwell time and GUIDE_SLOWMO controls action
pacing. Defaults are starting values, not measured accessibility thresholds.
Document evidence when changing them.

Split a journey when it exceeds one clear user outcome, has distinct audiences,
or approaches the per-guide recording timeout.
