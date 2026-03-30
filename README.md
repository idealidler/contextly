# Contextly

A secure, local-first VS Code extension for saving reusable AI context inside each workspace.

Contextly helps you keep prompt context close to the codebase it belongs to. Instead of repeatedly retyping schema notes, business rules, formatting preferences, or architectural guardrails, you save them once and reuse them when needed.

## Security and Privacy

- **100% local storage:** Contexts are saved to a hidden `.contextly.json` file in the active workspace.
- **Zero telemetry:** The extension makes no external API calls.
- **Git-friendly:** Teams can choose to commit `.contextly.json` so shared context travels with the repo.

## Current Features

- **Fast context picker:** Use the status bar to search contexts by name, description, tags, or content.
- **Structured prompt entries:** Store prompt metadata plus `intent`, `task`, `context`, `constraints`, and `output format`.
- **Two output modes:** Copy a formatted prompt to the clipboard or open chat with the prompt prefilled.
- **Visual management UI:** Create, edit, rename, tag, search, and delete contexts from the built-in dashboard.
- **Backward-compatible storage:** Older `.contextly.json` files that store plain strings still work.

## Quick Start

1. Open a folder or workspace in VS Code.
2. Click the `Contextly` status bar item, or run `Contextly: Manage Contexts`.
3. Create a prompt with:
   - a clear name
   - a short description
   - optional tags like `dax`, `finance`, or `reporting`
   - the prompt intent
   - the concrete task
   - the supporting context
   - the main constraints and expected output format
4. Use `Contextly: Select Context` to choose how to use it:
   - copy to clipboard
   - open chat with the prompt prefilled

## Example `.contextly.json`

```json
{
  "models": {
    "Fleet Operations Core": {
      "description": "Use for queries and code involving fleet KPIs and logistics reporting.",
      "tags": ["powerbi", "dax", "operations"],
      "intent": "Help with analytics and reporting tasks for fleet operations.",
      "task": "Answer questions and generate DAX or SQL using the domain rules below.",
      "constraints": [
        "Do not invent table or column names",
        "Call out missing business definitions"
      ],
      "outputFormat": "Respond with a short explanation, then code, then assumptions.",
      "updatedAt": "2026-03-29T15:00:00.000Z",
      "lastUsedAt": "2026-03-29T15:10:00.000Z",
      "context": "Primary facts: Trips, Vehicles, Fuel. Use fiscal month naming..."
    }
  }
}
```

## Improvement Roadmap

### Phase 1

Improve the current workflow without changing the product shape:

- add metadata and searchability
- support chat-prefill alongside clipboard copy
- keep old storage files working
- make the dashboard better for browsing and editing
- move to a standard structured prompt shape

### Phase 2

Move from structured single prompts to reusable building blocks:

- split context into sections such as schema, rules, examples, and output format
- allow composing multiple blocks into one prompt
- add templates for common tasks like explain, generate, review, and document

### Phase 3

Make Contextly more workspace-aware:

- support folder-level or file-type defaults
- remember recent contexts per repo
- offer optional prompt generation from the current file, selection, or open tabs

### Phase 4

Make the extension more robust for teams:

- add tests for storage and command flows
- validate `.contextly.json` structure
- add import/export and migration helpers
