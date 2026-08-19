# Development guide

## Release process

Releases are built and published by `.github/workflows/release.yml`. The workflow is triggered by a version tag such as `1.8.0`; the tagged commit must be on `main`, and the tag must exactly match the Python package version.

### One-time repository and registry configuration

Create a GitHub environment named `release` and configure required reviewers. Restrict the environment to protected version tags, and protect version tags so only release maintainers can create them.

Configure both trusted publishers with the GitHub owner `bokeh`, repository `ipywidgets_bokeh`, workflow `release.yml`, and environment `release`:

- On PyPI, configure the trusted publisher for the `ipywidgets_bokeh` project.
- On npm, configure the trusted publisher for `@bokeh/ipywidgets_bokeh` and allow `npm publish`.

Add an environment secret named `ANACONDA_API_TOKEN` to `release`. Use a token scoped to upload packages to the `bokeh` Anaconda.org channel; do not make it a repository-wide secret.

PyPI and npm use short-lived GitHub OIDC credentials and do not require stored API tokens. The conda upload is the only publishing job that receives `ANACONDA_API_TOKEN`.

### Prepare a release

From a clean checkout of `main`, choose the version and update every Python and npm version field together:

```bash
python scripts/release.py prepare 1.8.0
python scripts/release.py check
```

Commit the version change through the normal pull request process. After that commit is merged and CI succeeds on `main`, create and push the matching tag:

```bash
git tag 1.8.0
git push origin 1.8.0
```

The `release` environment approval gates publication. The workflow builds and verifies the Python, npm, and conda artifacts once, publishes those exact artifacts to all three registries, and creates a GitHub Release with the artifacts and SHA-256 checksums only after every registry publication succeeds.

For a prerelease, use the Python version form as the tag and preparation input. The preparation script maps it to npm SemVer automatically, for example:

| Python and tag | npm |
| -------------- | --- |
| `2.0.0.dev1` | `2.0.0-dev.1` |
| `2.0.0a1` | `2.0.0-alpha.1` |
| `2.0.0b1` | `2.0.0-beta.1` |
| `2.0.0rc1` | `2.0.0-rc.1` |

Prereleases are marked as such on GitHub, use the npm `next` distribution tag, and are uploaded only to the Anaconda.org `dev` label. Stable releases are uploaded to both the `dev` and `main` Anaconda.org labels.

If a publishing job fails after another registry has accepted the release, use **Re-run failed jobs** in GitHub Actions. Do not create a second tag or rebuild artifacts manually.
