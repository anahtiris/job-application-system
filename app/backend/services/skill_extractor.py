"""Extract a tiered skills inventory from the master résumé and merge it
into the existing inventory without overwriting manual edits."""


def merge_skills(existing: dict, incoming: dict) -> dict:
    """Keep-my-edits merge: add skills from `incoming` that are not already in
    `existing`; on a name collision the existing entry is kept unchanged."""
    merged = dict(existing)
    for name, entry in incoming.items():
        if name not in merged:
            merged[name] = entry
    return merged
