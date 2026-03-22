import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    let currentPayload = "";

    // ---------------------------------------------------------
    // THE UI: One powerful, persistent button
    // ---------------------------------------------------------
    const modelButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    modelButton.command = 'contextly.selectModel';
    modelButton.text = `🎯 Select Semantic Model`;
    modelButton.tooltip = "Click to select a model and copy its AI context";
    modelButton.show(); // Always show it!
    context.subscriptions.push(modelButton);

    // ---------------------------------------------------------
    // HELPER: Get the local workspace file path
    // ---------------------------------------------------------
    const getWorkspaceRulesPath = (): string | null => {
        if (vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders.length > 0) {
            const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
            return path.join(workspaceRoot, '.contextly.json');
        }
        return null;
    };

    // ---------------------------------------------------------
    // ACTION: The One-Stop Dropdown Menu
    // ---------------------------------------------------------
    let selectModelCommand = vscode.commands.registerCommand('contextly.selectModel', async () => {
        const rulesPath = getWorkspaceRulesPath();
        
        if (!rulesPath) {
            vscode.window.showErrorMessage('Contextly: Please open a workspace/folder to manage semantic models.');
            return;
        }

        let models: string[] = [];
        let rules: any = { models: {} };

        // Read the local file if it exists
        if (fs.existsSync(rulesPath)) {
            try {
                rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
                models = Object.keys(rules.models || {});
            } catch (error) {
                vscode.window.showErrorMessage('Contextly: Your local .contextly.json file is corrupted.');
            }
        }

        // The Menu Options
        const selection = await vscode.window.showQuickPick(
            ['[➕ Manage Semantic Models]', ...models], {
            placeHolder: 'Select a Semantic Model to instantly copy its AI Context'
        });

        if (selection) {
            if (selection === '[➕ Manage Semantic Models]') {
                vscode.commands.executeCommand('contextly.openDashboard');
            } else {
                // Instantly load and copy!
                currentPayload = rules.models[selection];
                modelButton.text = `🎯 Model: ${selection}`;
                
                vscode.env.clipboard.writeText(`[SYSTEM CONTEXT: \n${currentPayload}\n]`);
                vscode.window.showInformationMessage(`🧠 Contextly: '${selection}' context copied to clipboard!`);
            }
        }
    });

    // ---------------------------------------------------------
    // ACTION: The Visual Dashboard (Webview)
    // ---------------------------------------------------------
    let dashboardCommand = vscode.commands.registerCommand('contextly.openDashboard', () => {
        const panel = vscode.window.createWebviewPanel(
            'contextlyDashboard',
            'Contextly Settings',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        panel.webview.html = getDashboardUI();

        panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'saveModel') {
                const rulesPath = getWorkspaceRulesPath();
                if (!rulesPath) return;
                
                let rulesData: any = { models: {} };

                if (fs.existsSync(rulesPath)) {
                    try { rulesData = JSON.parse(fs.readFileSync(rulesPath, 'utf8')); } 
                    catch (e) { /* ignore and overwrite if corrupted */ }
                }
                if (!rulesData.models) rulesData.models = {};

                // Save the new data
                rulesData.models[message.modelName] = message.modelContext;
                fs.writeFileSync(rulesPath, JSON.stringify(rulesData, null, 4));
                
                // Automatically make the newly saved model the active one!
                currentPayload = message.modelContext;
                modelButton.text = `🎯 Model: ${message.modelName}`;
                vscode.env.clipboard.writeText(`[SYSTEM CONTEXT: \n${currentPayload}\n]`);

                vscode.window.showInformationMessage(`✅ '${message.modelName}' saved and copied to clipboard!`);
                panel.dispose(); // Close dashboard
            }
        });
    });

    context.subscriptions.push(selectModelCommand, dashboardCommand);
}

// ---------------------------------------------------------
// HTML/CSS: The Calm UI Dashboard
// ---------------------------------------------------------
function getDashboardUI() {
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contextly Manager</title>
        <style>
            body { font-family: var(--vscode-font-family); background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); padding: 40px; max-width: 650px; margin: 0 auto; }
            h1 { font-weight: 300; margin-bottom: 5px; }
            p { opacity: 0.8; font-size: 14px; margin-bottom: 30px; line-height: 1.5; }
            .form-group { margin-bottom: 24px; }
            label { display: block; margin-bottom: 8px; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; }
            input, textarea { width: 100%; box-sizing: border-box; padding: 12px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-family: var(--vscode-font-family); font-size: 14px; }
            input:focus, textarea:focus { outline: 1px solid var(--vscode-focusBorder); border-color: var(--vscode-focusBorder); }
            textarea { resize: vertical; min-height: 250px; line-height: 1.6; }
            button { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 14px 24px; font-size: 14px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%; margin-top: 10px; }
            button:hover { background-color: var(--vscode-button-hoverBackground); }
        </style>
    </head>
    <body>
        <h1>Semantic Model Manager</h1>
        <p>Define the business logic, table relationships, and formatting rules for your semantic models here. This data is saved securely to your local repository so it can be shared with your team via Git.</p>

        <div class="form-group">
            <label for="modelName">Semantic Model Name</label>
            <input type="text" id="modelName" placeholder="e.g., Fleet_Operations_Core">
        </div>

        <div class="form-group">
            <label for="modelContext">AI Context & Business Rules</label>
            <textarea id="modelContext" placeholder="Enter your fact tables, standard DAX formatting, and specific business logic here..."></textarea>
        </div>

        <button id="saveBtn">Save & Activate Model</button>

        <script>
            const vscode = acquireVsCodeApi();
            document.getElementById('saveBtn').addEventListener('click', () => {
                const name = document.getElementById('modelName').value.trim();
                const context = document.getElementById('modelContext').value.trim();
                if (name && context) {
                    vscode.postMessage({ command: 'saveModel', modelName: name, modelContext: context });
                }
            });
        </script>
    </body>
    </html>`;
}

export function deactivate() {}