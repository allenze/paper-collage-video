#!/usr/bin/env python3
from __future__ import annotations

import json
from pathlib import Path
import sys

from jsonschema import Draft202012Validator
from referencing import Registry, Resource


ROOT = Path(__file__).resolve().parent.parent
SCHEMA_DIRECTORY = ROOT / "schemas"
PROOF_INPUT_DIRECTORY = ROOT / "dist" / "vox-phase2-proof" / "inputs"
LOOPING_WORLD_INPUT_DIRECTORY = (
    ROOT / "dist" / "vox-looping-world-proof" / "inputs"
)
ASSET_HARDENING_INPUT_DIRECTORY = (
    ROOT
    / "dist"
    / "vox-phase2-proof"
    / "asset-hardening"
    / "registered-family"
    / "inputs"
)


def load_json(file: Path) -> dict:
    return json.loads(file.read_text(encoding="utf-8"))


schemas = {
    file.name: load_json(file)
    for file in sorted(SCHEMA_DIRECTORY.glob("*.schema.json"))
}
registry = Registry()
for name, schema in schemas.items():
    Draft202012Validator.check_schema(schema)
    if "$id" in schema:
        registry = registry.with_resource(
            schema["$id"],
            Resource.from_contents(schema),
        )
    registry = registry.with_resource(
        f"https://local.paper-collage.dev/{name}",
        Resource.from_contents(schema),
    )


def validate(instance_file: Path, schema_name: str) -> None:
    schema = schemas[schema_name]
    validator = Draft202012Validator(schema, registry=registry)
    errors = sorted(
        validator.iter_errors(load_json(instance_file)),
        key=lambda error: list(error.absolute_path),
    )
    if errors:
        rendered = "\n".join(
            f"{instance_file.relative_to(ROOT)}:{'/'.join(map(str, error.absolute_path))}: {error.message}"
            for error in errors
        )
        raise ValueError(rendered)


try:
    validate(
        PROOF_INPUT_DIRECTORY / "storyboard-authoring.json",
        "storyboard-authoring.schema.json",
    )
    validate(PROOF_INPUT_DIRECTORY / "storyboard.json", "storyboard.schema.json")
    for project in sorted(PROOF_INPUT_DIRECTORY.glob("project-*.json")):
        validate(project, "project.schema.json")
    validate(
        PROOF_INPUT_DIRECTORY / "assets-manifest.json",
        "assets-manifest.schema.json",
    )
    validate(
        LOOPING_WORLD_INPUT_DIRECTORY / "storyboard-authoring.json",
        "storyboard-authoring.schema.json",
    )
    validate(
        LOOPING_WORLD_INPUT_DIRECTORY / "storyboard.json",
        "storyboard.schema.json",
    )
    for project in sorted(LOOPING_WORLD_INPUT_DIRECTORY.glob("project-*.json")):
        validate(project, "project.schema.json")
    validate(
        LOOPING_WORLD_INPUT_DIRECTORY / "assets-manifest.json",
        "assets-manifest.schema.json",
    )
    for derivation in sorted(
        LOOPING_WORLD_INPUT_DIRECTORY.glob("*-derivation.json")
    ):
        validate(derivation, "looping-strip.schema.json")
    validate(
        ASSET_HARDENING_INPUT_DIRECTORY / "registered-family.json",
        "registered-family.schema.json",
    )
    validate(
        ASSET_HARDENING_INPUT_DIRECTORY / "rejected-output-recovery.json",
        "rejected-output-recovery.schema.json",
    )
except (FileNotFoundError, KeyError, ValueError) as error:
    print(f"v11 schema validation failed:\n{error}", file=sys.stderr)
    raise SystemExit(1)

print(
    "✓ v11 authoring, compiled storyboard, three project contracts, "
    "asset manifests, looping-strip derivations, registered-family derivation, "
    "and rejected-output recovery are schema-valid"
)
