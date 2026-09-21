# Security policy

## Supported version

The default branch is the supported version of this template.

## Reporting a vulnerability

Use GitHub's private security advisory flow for this repository. Do not place
credentials, private URLs, personal data, or exploit details in a public issue.

Include the affected revision, reproduction steps using synthetic data, impact,
and a suggested mitigation when available.

## Template security boundaries

The included application is local and synthetic. Adapters for a real
application must preserve these boundaries:

- Never record production credentials or personal data.
- Keep live mutations disabled unless a dedicated test environment permits them.
- Mask private fields in screenshots and wrap private actions with
  guide.sensitive so video frames are covered.
- Allow only non-sensitive URL query parameters.
- Publish only output accepted by guides:verify.
- Keep raw manifests, traces, and failed checkpoints out of public artifacts.

Dependencies are locked. Run npm audit when updating them.
