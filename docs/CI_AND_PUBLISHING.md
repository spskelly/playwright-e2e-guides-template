# CI and publishing

Testing and publication are separate trust boundaries.

## Test workflow

.github/workflows/test.yml runs on pushes and pull requests. It installs locked
dependencies, installs Chromium, typechecks, runs the 30 guide contracts, runs
the synthetic application suite, and runs the documented journey in fast mode.
Playwright evidence is uploaded only when a failure needs diagnosis.

## Publication workflow

.github/workflows/publish-guides.yml runs on manual dispatch and qualifying
pushes to main only when the repository variable ENABLE_GUIDE_PAGES is true.
The variable is deliberately absent at repository creation so the first push
cannot publish before review. Once enabled, the workflow:

1. Prints the guide inventory and checkpoint location.
2. Records each incomplete synthetic guide.
3. Builds the static site from the current inventory.
4. Verifies every public link and required asset.
5. Uploads only guides-site as the Pages artifact.
6. Deploys only from main through the protected github-pages environment.

Failed checkpoints and Playwright evidence are diagnostic. They are not placed
in the Pages artifact.

## Permissions and concurrency

The test workflow has read-only repository access. The publication build also
has read-only access. Only the deployment job receives pages: write and
id-token: write. A Pages concurrency group prevents an older run from replacing
a newer deployment.

## First deployment gate

Before the first deployment, record:

- exact repository
- source revision
- guide inventory
- artifact byte size
- proposed Pages URL

Review the site locally and wait for owner approval before enabling or
dispatching Pages. After approval, create the repository variable with:

    gh variable set ENABLE_GUIDE_PAGES --body true

Then dispatch Publish guides from GitHub Actions. Removing the variable or
setting it to false disables both automatic and manual publication jobs.
