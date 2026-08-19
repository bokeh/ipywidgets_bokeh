from __future__ import annotations

import shutil
import sys
from pathlib import Path

import pytest


ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts"))
import release  # noqa: E402


@pytest.mark.parametrize(
    ("python_version", "npm_version", "prerelease"),
    [
        ("1.8.0", "1.8.0", False),
        ("1.8.0.dev1", "1.8.0-dev.1", True),
        ("1.8.0a2", "1.8.0-alpha.2", True),
        ("1.8.0b3", "1.8.0-beta.3", True),
        ("1.8.0rc4", "1.8.0-rc.4", True),
    ],
)
def test_parse_version(python_version, npm_version, prerelease):
    version = release.parse_version(python_version)
    assert version.python == python_version
    assert version.npm == npm_version
    assert version.prerelease is prerelease


@pytest.mark.parametrize(
    "version",
    ["1.8", "v1.8.0", "1.8.0-dev.1", "1.8.0.post1", "1.8.0rc1.dev1", "01.8.0"],
)
def test_parse_version_rejects_unsupported_versions(version):
    with pytest.raises(release.ReleaseError):
        release.parse_version(version)


def test_repository_versions_are_consistent():
    release.check_versions(ROOT)


def test_prepare_version_updates_all_metadata(tmp_path):
    paths = [*release.VERSION_PATTERNS, "ipywidgets_bokeh/package.json", "ipywidgets_bokeh/package-lock.json"]
    for relative_path in paths:
        destination = tmp_path / relative_path
        destination.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(ROOT / relative_path, destination)

    version = release.prepare_version("2.0.0rc1", tmp_path)

    assert version.python == "2.0.0rc1"
    assert version.npm == "2.0.0-rc.1"
    assert set(release.read_versions(tmp_path).values()) == {version.python, version.npm}
