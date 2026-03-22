# Contextly

A persistent developer context layer for Visual Studio Code that bridges the gap between generic AI coding assistants and enterprise-grade data engineering.

Contextly silently listens to your active workspace and seamlessly prepares your specific architectural, styling, and business rules, perfectly formatting them for any AI coding assistant.

## Features

* **Smart Language Detection:** Automatically detects when you switch between different file types (e.g., Python, SQL, DAX).
* **Context Vault:** Reads from a local `rules.json` configuration file to pull the exact architectural rules and business logic for your active stack or semantic model.
* **One-Click AI Injection:** Provides a clean status bar button (`⚡ Contextly`) that instantly copies a pre-formatted `[SYSTEM CONTEXT]` payload to your clipboard, ready to be pasted into GitHub Copilot, ChatGPT, Claude, or any other AI assistant.

## How to Use

1. Open a supported file in your workspace (like a `.py` script or a `.dax` measure).
2. Look for the `⚡ Contextly` button in the bottom right status bar.
3. Click the button to copy the context rules to your clipboard.
4. Paste the context directly into your AI prompt before asking your question to ensure the generated code perfectly matches your team's standards.

## Configuration

Context rules are managed locally in the `src/rules.json` file. Map your file extensions or specific semantic models to the required business logic, naming conventions, and technical constraints.