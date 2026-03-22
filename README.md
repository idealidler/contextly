# Contextly

A secure, local-first VS Code extension designed specifically for Data and Analytics Engineers to manage and inject business logic, architectural rules, and formatting standards directly into AI coding assistants.

Stop typing the same table relationships, DAX formatting standards, and time-intelligence rules into ChatGPT or GitHub Copilot. Contextly allows you to define your Semantic Models once, manage them visually, and instantly copy their specific context to your clipboard with a single click.

## 🔒 Enterprise-Grade Security & Privacy

Contextly is designed for enterprise environments where data privacy is paramount. 
* **100% Local Storage:** Your semantic model rules are saved locally to a hidden `.contextly.json` file inside your active VS Code workspace. 
* **Zero Telemetry:** The extension makes absolutely zero external API calls. Your business logic, table names, and architectural rules never leave your machine.
* **Git-Friendly:** Because rules are saved at the workspace level, you can securely commit your `.contextly.json` file to your internal Git repository. When your teammates pull the repo, Contextly automatically syncs their AI prompts with your team's exact standards.

## ✨ Features

* **🎯 Single-Click Workflow:** A persistent status bar button gives you instant access to your models. Click a model, and its exact rules are instantly copied to your clipboard, formatted perfectly for your AI.
* **🖥️ Visual CRUD Dashboard:** Never wrestle with formatting JSON files. Contextly includes a built-in, native Webview dashboard to seamlessly Create, Read, Update, and Delete your semantic models. 
* **🛡️ Bulletproof UX:** Includes seamless UI states, auto-scrolling for edits, and explicit "Are you sure? [Yes] [No]" safeguards to prevent accidental deletions.
* **⚡ Frictionless Context Switching:** Jumping between a Fleet Operations model and a Financial model? Switch your active AI context in less than two seconds without ever opening the command palette.

## 🚀 Quick Start Guide

1. Open your data repository or workspace folder in VS Code.
2. Look for the **`🎯 Select Semantic Model`** button in the bottom right corner of your status bar.
3. Click it and select **`[⚙️ Manage Semantic Models]`** to open the visual dashboard.
4. Define your Semantic Model's name (e.g., `Core_Sales_Model`) and paste in your business rules, fact table names, and coding standards. Click Save.
5. Whenever you are ready to prompt your AI, click the status bar button, select your model, and the context is instantly loaded to your clipboard! Hit `Cmd + V` (or `Ctrl + V`) in your AI chat window.