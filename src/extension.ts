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
    modelButton.show();
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

        if (fs.existsSync(rulesPath)) {
            try {
                rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
                models = Object.keys(rules.models || {});
            } catch (error) {
                vscode.window.showErrorMessage('Contextly: Your local .contextly.json file is corrupted.');
            }
        }

        const selection = await vscode.window.showQuickPick(
            ['[⚙️ Manage Semantic Models]', ...models], {
            placeHolder: 'Select a Semantic Model to instantly copy its AI Context'
        });

        if (selection) {
            if (selection === '[⚙️ Manage Semantic Models]') {
                vscode.commands.executeCommand('contextly.openDashboard');
            } else {
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

        // Fetch existing models to populate the dashboard
        const rulesPath = getWorkspaceRulesPath();
        let existingModels = {};
        if (rulesPath && fs.existsSync(rulesPath)) {
            try { existingModels = JSON.parse(fs.readFileSync(rulesPath, 'utf8')).models || {}; } 
            catch (e) { /* ignore */ }
        }

        panel.webview.html = getDashboardUI(existingModels);

        panel.webview.onDidReceiveMessage(message => {
            const currentRulesPath = getWorkspaceRulesPath();
            if (!currentRulesPath) return;

            let rulesData: any = { models: {} };
            if (fs.existsSync(currentRulesPath)) {
                try { rulesData = JSON.parse(fs.readFileSync(currentRulesPath, 'utf8')); } 
                catch (e) { /* ignore */ }
            }
            if (!rulesData.models) {
                rulesData.models = {};
            }

            // HANDLE SAVE (Create / Update)
            if (message.command === 'saveModel') {
                rulesData.models[message.modelName] = message.modelContext;
                fs.writeFileSync(currentRulesPath, JSON.stringify(rulesData, null, 4));
                
                currentPayload = message.modelContext;
                modelButton.text = `🎯 Model: ${message.modelName}`;
                vscode.env.clipboard.writeText(`[SYSTEM CONTEXT: \n${currentPayload}\n]`);

                vscode.window.showInformationMessage(`✅ '${message.modelName}' saved and copied to clipboard!`);
                panel.dispose();
            }

            // HANDLE DELETE
            if (message.command === 'deleteModel') {
                if (rulesData.models[message.modelName]) {
                    delete rulesData.models[message.modelName];
                    fs.writeFileSync(currentRulesPath, JSON.stringify(rulesData, null, 4));
                    vscode.window.showInformationMessage(`🗑️ Contextly: '${message.modelName}' has been deleted.`);
                    // We do NOT dispose the panel here so the user can keep managing other models
                }
            }
        });
    });

    context.subscriptions.push(selectModelCommand, dashboardCommand);
}

// ---------------------------------------------------------
// HTML/CSS: The CRUD UI Dashboard
// ---------------------------------------------------------
function getDashboardUI(models: any) {
    const modelsJson = JSON.stringify(models);
    
    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contextly Manager</title>
        <style>
            body { font-family: var(--vscode-font-family); background-color: var(--vscode-editor-background); color: var(--vscode-editor-foreground); padding: 40px; max-width: 700px; margin: 0 auto; }
            h1 { font-weight: 300; margin-bottom: 5px; }
            p { opacity: 0.8; font-size: 14px; margin-bottom: 30px; line-height: 1.5; }
            
            /* The List of Existing Models */
            .model-list { margin-bottom: 40px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 20px; }
            .model-item { display: flex; justify-content: space-between; align-items: center; background-color: var(--vscode-editorWidget-background); padding: 12px 16px; margin-bottom: 8px; border-radius: 6px; border: 1px solid var(--vscode-input-border); }
            .model-name { font-weight: bold; font-size: 14px; }
            .model-actions button { margin-left: 8px; padding: 6px 12px; font-size: 12px; border-radius: 4px; cursor: pointer; border: none; font-weight: bold; }
            .btn-edit { background-color: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
            .btn-edit:hover { background-color: var(--vscode-button-secondaryHoverBackground); }
            .btn-delete { background-color: #d32f2f; color: white; }
            .btn-delete:hover { background-color: #b71c1c; }
            .empty-state { font-style: italic; opacity: 0.6; font-size: 13px; }

            /* The Form */
            .form-section-title { font-size: 18px; font-weight: 300; margin-bottom: 15px; border-bottom: 1px solid var(--vscode-panel-border); padding-bottom: 5px; }
            .form-group { margin-bottom: 24px; }
            label { display: block; margin-bottom: 8px; font-weight: bold; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; opacity: 0.8; }
            input, textarea { width: 100%; box-sizing: border-box; padding: 12px; background-color: var(--vscode-input-background); color: var(--vscode-input-foreground); border: 1px solid var(--vscode-input-border); border-radius: 4px; font-family: var(--vscode-font-family); font-size: 14px; }
            input:focus, textarea:focus { outline: 1px solid var(--vscode-focusBorder); border-color: var(--vscode-focusBorder); }
            textarea { resize: vertical; min-height: 200px; line-height: 1.6; }
            
            /* Main Save Button */
            .btn-save { background-color: var(--vscode-button-background); color: var(--vscode-button-foreground); border: none; padding: 14px 24px; font-size: 14px; border-radius: 4px; cursor: pointer; font-weight: bold; width: 100%; margin-top: 10px; transition: opacity 0.2s; }
            .btn-save:hover { background-color: var(--vscode-button-hoverBackground); }
        </style>
    </head>
    <body>
        <h1>Semantic Model Manager</h1>
        <p>Manage the business logic and formatting rules for your workspace. This data is securely saved to your local repository.</p>

        <div class="model-list" id="modelListContainer">
            </div>

        <h2 class="form-section-title" id="formTitle">Create New Model</h2>

        <div class="form-group">
            <label for="modelName">Model Name (Acts as unique ID)</label>
            <input type="text" id="modelName" placeholder="e.g., Fleet_Operations_Core">
        </div>

        <div class="form-group">
            <label for="modelContext">AI Context & Business Rules</label>
            <textarea id="modelContext" placeholder="Enter your fact tables, standard DAX formatting, and specific business logic here..."></textarea>
        </div>

        <button class="btn-save" id="saveBtn">Save & Activate Model</button>

        <script>
            const vscode = acquireVsCodeApi();
            let savedModels = ${modelsJson};
            
            const listContainer = document.getElementById('modelListContainer');
            const nameInput = document.getElementById('modelName');
            const contextInput = document.getElementById('modelContext');
            const formTitle = document.getElementById('formTitle');

            // Render the list of models
            function renderModels() {
                listContainer.innerHTML = '';
                const keys = Object.keys(savedModels);
                
                if (keys.length === 0) {
                    listContainer.innerHTML = '<div class="empty-state">No models saved in this workspace yet. Create one below!</div>';
                    return;
                }

                keys.forEach(key => {
                    const item = document.createElement('div');
                    item.className = 'model-item';
                    
                    const nameSpan = document.createElement('span');
                    nameSpan.className = 'model-name';
                    nameSpan.innerText = key;
                    
                    const actionsDiv = document.createElement('div');
                    actionsDiv.className = 'model-actions';
                    
                    const editBtn = document.createElement('button');
                    editBtn.className = 'btn-edit';
                    editBtn.innerText = 'Edit';
                    editBtn.onclick = () => loadForEdit(key);
                    
                    const deleteBtn = document.createElement('button');
                    deleteBtn.className = 'btn-delete';
                    deleteBtn.innerText = 'Delete';
                    deleteBtn.onclick = () => deleteModel(key);
                    
                    actionsDiv.appendChild(editBtn);
                    actionsDiv.appendChild(deleteBtn);
                    item.appendChild(nameSpan);
                    item.appendChild(actionsDiv);
                    
                    listContainer.appendChild(item);
                });
            }

            // Load a model into the form for editing
            function loadForEdit(key) {
                nameInput.value = key;
                contextInput.value = savedModels[key];
                formTitle.innerText = "Edit Model: " + key;
                window.scrollTo(0, document.body.scrollHeight); // scroll down to form
            }

            // Delete a model
            function deleteModel(key) {
                if (confirm('Are you sure you want to delete "' + key + '"?')) {
                    // Remove from local UI state
                    delete savedModels[key];
                    renderModels();
                    
                    // Clear form if they were currently editing it
                    if (nameInput.value === key) {
                        nameInput.value = '';
                        contextInput.value = '';
                        formTitle.innerText = "Create New Model";
                    }

                    // Tell VS Code to delete it from the JSON file
                    vscode.postMessage({ command: 'deleteModel', modelName: key });
                }
            }

            // Initial render
            renderModels();

            // Save button listener
            document.getElementById('saveBtn').addEventListener('click', () => {
                const name = nameInput.value.trim();
                const context = contextInput.value.trim();
                if (name && context) {
                    vscode.postMessage({ command: 'saveModel', modelName: name, modelContext: context });
                }
            });
        </script>
    </body>
    </html>`;
}

export function deactivate() {}