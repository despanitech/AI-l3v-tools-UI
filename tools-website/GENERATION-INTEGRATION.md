# Magic Identity generation integration

The results preview uses the existing Evan Hart assets. It explicitly labels them as samples regardless of typed names. No model calls, public generation, or server changes are enabled by this UI.

## Verified gap

The private lettering gateway has prepare/generate/status routes and requires a server token and visitor hash. Its generate operation submits all three default categories. Status returns output IDs and dimensions, not authorized downloadable URLs. The older logo endpoint returns a plan only. Neither is a complete public name-logo generation endpoint.

## Next implementation

1. Add category/style selection to the private project contract, pinning the installed knowledge catalog, with name-logo-only admission for the first public flow.
2. Wire the trusted website backend to that private gateway. Derive visitor identity on the server; keep gateway credentials private. Retain request-key deduplication and queue/memory limits.
3. Add owner-checked image delivery by output ID, serving only completed outputs. Never expose server filesystem paths.
4. Connect the React view to catalog, submission and status responses. Preserve the submitted identity independently from later form edits. Handle queued, working, partial success, failure and uncertain outcomes without automatically resubmitting generation.
5. Verify one real name-logo request end to end before enabling generation publicly. Downloads must preserve original output dimensions. Add initials/signatures through the same path afterward.

The result UI currently has category selection and sample download only. Full style browsing and editing remain to be implemented. Existing private gateway worktree: `private-lettering-api`; server installation requires interactive sudo.
