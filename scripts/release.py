#!/usr/bin/env python

from __future__ import annotations

import argparse
import hashlib
import json
import re
import sys
import tarfile
import tempfile
import zipfile
from dataclasses import dataclass
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]

PYTHON_VERSION_RE = re.compile(
    r"^(?P<release>(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*))"
    r"(?:(?P<pre>a|b|rc)(?P<pre_number>0|[1-9]\d*))?"
    r"(?:\.dev(?P<dev_number>0|[1-9]\d*))?$"
)

VERSION_PATTERNS = {
    "setup.py": re.compile(r'^    version="([^"]+)",$', re.MULTILINE),
    "ipywidgets_bokeh/__init__.py": re.compile(r'^__version__ = "([^"]+)"$', re.MULTILINE),
    "ipywidgets_bokeh/kernel.py": re.compile(r"^    implementation_version = '([^']+)'$", re.MULTILINE),
}


class ReleaseError(RuntimeError):
    pass


@dataclass(frozen=True)
class Version:
    python: str
    npm: str
    prerelease: bool


def parse_version(value: str) -> Version:
    match = PYTHON_VERSION_RE.fullmatch(value)
    if match is None:
        raise ReleaseError(
            f"invalid release version {value!r}; expected X.Y.Z with an optional "
            "aN, bN, rcN, and/or .devN suffix"
        )

    suffix = []
    pre = match.group("pre")
    if pre is not None:
        suffix.append({"a": "alpha", "b": "beta", "rc": "rc"}[pre])
        suffix.append(match.group("pre_number"))

    dev_number = match.group("dev_number")
    if pre is not None and dev_number is not None:
        raise ReleaseError("combined prerelease and development suffixes are not supported")
    if dev_number is not None:
        suffix.extend(("dev", dev_number))

    npm = match.group("release")
    if suffix:
        npm += "-" + ".".join(suffix)

    return Version(python=value, npm=npm, prerelease=bool(suffix))


def _read_pattern(root: Path, relative_path: str, pattern: re.Pattern[str]) -> str:
    path = root / relative_path
    matches = pattern.findall(path.read_text(encoding="utf-8"))
    if len(matches) != 1:
        raise ReleaseError(f"expected exactly one version field in {relative_path}, found {len(matches)}")
    return matches[0]


def read_versions(root: Path = ROOT) -> dict[str, str]:
    versions = {
        relative_path: _read_pattern(root, relative_path, pattern)
        for relative_path, pattern in VERSION_PATTERNS.items()
    }

    package_json = json.loads((root / "ipywidgets_bokeh/package.json").read_text(encoding="utf-8"))
    package_lock = json.loads((root / "ipywidgets_bokeh/package-lock.json").read_text(encoding="utf-8"))
    try:
        versions["ipywidgets_bokeh/package.json"] = package_json["version"]
        versions["ipywidgets_bokeh/package-lock.json"] = package_lock["version"]
        versions['ipywidgets_bokeh/package-lock.json packages[""]'] = package_lock["packages"][""]["version"]
    except (KeyError, TypeError) as error:
        raise ReleaseError(f"missing npm version metadata: {error}") from error

    return versions


def check_versions(root: Path = ROOT, tag: str | None = None) -> Version:
    versions = read_versions(root)
    version = parse_version(versions["setup.py"])
    expected = {
        "setup.py": version.python,
        "ipywidgets_bokeh/__init__.py": version.python,
        "ipywidgets_bokeh/kernel.py": version.python,
        "ipywidgets_bokeh/package.json": version.npm,
        "ipywidgets_bokeh/package-lock.json": version.npm,
        'ipywidgets_bokeh/package-lock.json packages[""]': version.npm,
    }
    mismatches = [
        f"{location}: expected {expected_value!r}, found {versions[location]!r}"
        for location, expected_value in expected.items()
        if versions[location] != expected_value
    ]
    if tag is not None and tag != version.python:
        mismatches.append(f"release tag: expected {version.python!r}, found {tag!r}")
    if mismatches:
        raise ReleaseError("inconsistent release versions:\n  - " + "\n  - ".join(mismatches))
    return version


def _replace_pattern(root: Path, relative_path: str, pattern: re.Pattern[str], version: str) -> str:
    path = root / relative_path
    text = path.read_text(encoding="utf-8")
    updated, count = pattern.subn(lambda match: match.group(0).replace(match.group(1), version), text)
    if count != 1:
        raise ReleaseError(f"expected exactly one version field in {relative_path}, found {count}")
    return updated


def prepare_version(version_value: str, root: Path = ROOT) -> Version:
    version = parse_version(version_value)
    updates = {}
    for relative_path, pattern in VERSION_PATTERNS.items():
        updates[root / relative_path] = _replace_pattern(root, relative_path, pattern, version.python)

    package_path = root / "ipywidgets_bokeh/package.json"
    package_json = json.loads(package_path.read_text(encoding="utf-8"))
    package_json["version"] = version.npm
    updates[package_path] = json.dumps(package_json, indent=2) + "\n"

    lock_path = root / "ipywidgets_bokeh/package-lock.json"
    package_lock = json.loads(lock_path.read_text(encoding="utf-8"))
    try:
        package_lock["version"] = version.npm
        package_lock["packages"][""]["version"] = version.npm
    except (KeyError, TypeError) as error:
        raise ReleaseError(f"missing npm version metadata: {error}") from error
    updates[lock_path] = json.dumps(package_lock, indent=2) + "\n"

    for path, content in updates.items():
        path.write_text(content, encoding="utf-8")

    return check_versions(root)


def _expect_one(paths: list[Path], description: str) -> Path:
    if len(paths) != 1:
        found = ", ".join(str(path) for path in paths) or "none"
        raise ReleaseError(f"expected exactly one {description}, found: {found}")
    return paths[0]


def _metadata_version(metadata: str) -> str:
    match = re.search(r"^Version: (.+)$", metadata, re.MULTILINE)
    if match is None:
        raise ReleaseError("package metadata does not contain a Version field")
    return match.group(1).strip()


def _check_python_sources(names: set[str], read_text, version: str, source: str) -> None:
    init_path = _expect_one(
        [Path(name) for name in names if name.endswith("ipywidgets_bokeh/__init__.py")],
        f"{source} __init__.py",
    )
    kernel_path = _expect_one(
        [Path(name) for name in names if name.endswith("ipywidgets_bokeh/kernel.py")],
        f"{source} kernel.py",
    )
    if f'__version__ = "{version}"' not in read_text(str(init_path)):
        raise ReleaseError(f"{source} contains an incorrect runtime __version__")
    if f"implementation_version = '{version}'" not in read_text(str(kernel_path)):
        raise ReleaseError(f"{source} contains an incorrect kernel implementation_version")
    if not any(name.endswith("ipywidgets_bokeh/dist/ipywidgets_bokeh.js") for name in names):
        raise ReleaseError(f"{source} does not contain the built JavaScript bundle")


def _verify_wheel(path: Path, version: Version) -> None:
    with zipfile.ZipFile(path) as archive:
        names = set(archive.namelist())
        metadata_path = _expect_one(
            [Path(name) for name in names if name.endswith(".dist-info/METADATA")],
            "wheel METADATA",
        )
        metadata = archive.read(str(metadata_path)).decode()
        if _metadata_version(metadata) != version.python:
            raise ReleaseError(f"{path.name} metadata version does not match {version.python}")
        _check_python_sources(names, lambda name: archive.read(name).decode(), version.python, path.name)


def _verify_sdist(path: Path, version: Version) -> None:
    with tarfile.open(path) as archive:
        names = set(archive.getnames())
        metadata_path = _expect_one(
            [Path(name) for name in names if name.count("/") == 1 and name.endswith("/PKG-INFO")],
            "sdist PKG-INFO",
        )
        metadata_file = archive.extractfile(str(metadata_path))
        if metadata_file is None:
            raise ReleaseError(f"cannot read metadata from {path.name}")
        if _metadata_version(metadata_file.read().decode()) != version.python:
            raise ReleaseError(f"{path.name} metadata version does not match {version.python}")

        def read_text(name: str) -> str:
            member = archive.extractfile(name)
            if member is None:
                raise ReleaseError(f"cannot read {name} from {path.name}")
            return member.read().decode()

        _check_python_sources(names, read_text, version.python, path.name)


def _verify_npm(path: Path, version: Version) -> None:
    with tarfile.open(path) as archive:
        names = set(archive.getnames())
        if "package/package.json" not in names:
            raise ReleaseError(f"{path.name} does not contain package/package.json")
        package_file = archive.extractfile("package/package.json")
        if package_file is None:
            raise ReleaseError(f"cannot read package.json from {path.name}")
        package = json.loads(package_file.read())
        if package.get("name") != "@bokeh/ipywidgets_bokeh" or package.get("version") != version.npm:
            raise ReleaseError(f"{path.name} has incorrect npm package metadata")
        if "package/dist/ipywidgets_bokeh.js" not in names:
            raise ReleaseError(f"{path.name} does not contain the built JavaScript bundle")


def _verify_conda(path: Path, version: Version) -> None:
    with tempfile.TemporaryDirectory() as temp_dir:
        destination = Path(temp_dir)
        if path.name.endswith(".tar.bz2"):
            with tarfile.open(path) as archive:
                archive.extractall(destination, filter="data")
        else:
            try:
                from conda_package_handling.api import extract
            except ImportError as error:
                raise ReleaseError("conda-package-handling is required to verify .conda artifacts") from error
            extract(str(path), dest_dir=str(destination))

        index_path = destination / "info/index.json"
        if not index_path.exists():
            raise ReleaseError(f"{path.name} does not contain info/index.json")
        index = json.loads(index_path.read_text(encoding="utf-8"))
        if index.get("name") != "ipywidgets_bokeh" or index.get("version") != version.python:
            raise ReleaseError(f"{path.name} has incorrect conda package metadata")
        bundle = list(destination.glob("**/site-packages/ipywidgets_bokeh/dist/ipywidgets_bokeh.js"))
        if len(bundle) != 1:
            raise ReleaseError(f"{path.name} does not contain exactly one built JavaScript bundle")


def verify_artifacts(artifacts: Path, version: Version, checksums: Path | None = None) -> None:
    wheel = _expect_one(list((artifacts / "python").glob("*.whl")), "wheel")
    sdist = _expect_one(list((artifacts / "python").glob("*.tar.gz")), "source distribution")
    npm = _expect_one(list((artifacts / "npm").glob("*.tgz")), "npm package")
    conda_candidates = list((artifacts / "conda").glob("**/*.conda"))
    conda_candidates += list((artifacts / "conda").glob("**/*.tar.bz2"))
    conda = _expect_one(conda_candidates, "conda package")

    _verify_wheel(wheel, version)
    _verify_sdist(sdist, version)
    _verify_npm(npm, version)
    _verify_conda(conda, version)

    distributions = (wheel, sdist, npm, conda)
    if checksums is not None:
        lines = []
        for path in sorted(distributions, key=lambda item: item.name):
            digest = hashlib.sha256(path.read_bytes()).hexdigest()
            lines.append(f"{digest}  {path.name}")
        checksums.write_text("\n".join(lines) + "\n", encoding="utf-8")


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Prepare and validate ipywidgets_bokeh releases")
    commands = parser.add_subparsers(dest="command", required=True)

    check = commands.add_parser("check", help="check version consistency")
    check.add_argument("--tag", help="also require the release tag to match")

    prepare = commands.add_parser("prepare", help="update all release version fields")
    prepare.add_argument("version")

    show = commands.add_parser("show", help="print normalized release metadata")
    show.add_argument("field", choices=("python", "npm", "prerelease"))

    verify = commands.add_parser("verify-artifacts", help="validate built release artifacts")
    verify.add_argument("directory", type=Path)
    verify.add_argument("--checksums", type=Path)
    return parser


def main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    try:
        if args.command == "prepare":
            version = prepare_version(args.version)
            print(f"prepared Python {version.python} / npm {version.npm}")
        elif args.command == "check":
            version = check_versions(tag=args.tag)
            print(f"versions are consistent: Python {version.python} / npm {version.npm}")
        elif args.command == "show":
            version = check_versions()
            value = getattr(version, args.field)
            print(str(value).lower() if isinstance(value, bool) else value)
        elif args.command == "verify-artifacts":
            version = check_versions()
            verify_artifacts(args.directory, version, args.checksums)
            print(f"release artifacts are valid for {version.python}")
    except (OSError, ReleaseError, tarfile.TarError, zipfile.BadZipFile, json.JSONDecodeError) as error:
        print(f"release error: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
