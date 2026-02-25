# AI Contract for `features.yaml`

This file defines the minimum structure that must stay valid so the viewer can parse and render correctly.

## Required top-level keys
- `domains` (list)
- `relationships` (list)

## Domain contract
Each item in `domains` must contain:
- `id` (string, unique)
- `label` (string)
- `features` (list)

## Feature contract
Each item in `domains[*].features` must contain:
- `id` (string, unique globally)
- `label` (string)

Optional but recommended:
- `status` (`implemented` | `partial` | `placeholder`)
- `routes` (list of strings)
- `actors` (list of actor ids)
- `data_entities` (list of strings)

## Relationship contract
Each item in `relationships` must contain:
- `from` (string)
- `to` (string)
- `type` (string, recommended)

Notes:
- In non-strict mode, unknown `from`/`to` are rendered as external nodes by the viewer.
- In strict mode, unknown `from`/`to` fail validation.

## Validation / extraction command
Run from project root:

```bash
python extract_features_ai.py
```

Strict check:

```bash
python extract_features_ai.py --strict
```

Generated AI file:
- `YAML/features.ai.json`
