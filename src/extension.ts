import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    const rulesPath = path.join(context.extensionPath, 'src', 'rules.json');
    let currentPayload = "";
    let selectedModel = ""; // Empty string means "Auto-Detect"

    // ---------------------------------------------------------
    // UI: Create the Two Buttons
    // ---------------------------------------------------------
    // Button 1: The Model Selector (Priority 101 puts it on the left)
    const modelButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 2);
    modelButton.command = 'contextly.selectModel';
    modelButton.tooltip = "Click to change business context";
    context.subscriptions.push(modelButton);

    // Button 2: The Copy Action (Priority 100 puts it on the right)
    const copyButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 1);
    copyButton.command = 'contextly.copyContext';
    copyButton.text = "$(clippy) Copy Context"; // $(clippy) uses VS Code's native clipboard icon
    copyButton.tooltip = "Copy context to clipboard for AI";
    context.subscriptions.push(copyButton);

    // ---------------------------------------------------------
    // ACTIONS: What happens when you click the buttons
    // ---------------------------------------------------------
    // Action 1: Copy to Clipboard
    let copyCommand = vscode.commands.registerCommand('contextly.copyContext', () => {
        if (currentPayload) {
            vscode.env.clipboard.writeText(`[SYSTEM CONTEXT: ${currentPayload}]`);
            vscode.window.showInformationMessage('🧠 Contextly payload copied! Ready to paste.');
        }
    });

    // Action 2: Open the Dropdown Menu
    let selectModelCommand = vscode.commands.registerCommand('contextly.selectModel', async () => {
        if (!fs.existsSync(rulesPath)) return;
        
        const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));
        const models = Object.keys(rules.models || {});

        const selection = await vscode.window.showQuickPick(['[Auto-Detect Language]', ...models], {
            placeHolder: 'Select a Semantic Model to override default language rules'
        });

        if (selection) {
            if (selection === '[Auto-Detect Language]') {
                selectedModel = ""; // Reset to auto
                if (vscode.window.activeTextEditor) {
                    checkLanguage(vscode.window.activeTextEditor.document);
                }
            } else {
                // Apply manual override
                selectedModel = selection;
                currentPayload = rules.models[selection];
                modelButton.text = `🎯 Model: ${selection}`;
            }
        }
    });

    // ---------------------------------------------------------
    // LISTENER: The Smart Auto-Detector
    // ---------------------------------------------------------
    const checkLanguage = (document: vscode.TextDocument) => {
        if (!fs.existsSync(rulesPath)) return;
        const rules = JSON.parse(fs.readFileSync(rulesPath, 'utf8'));

        let documentLanguage = document.languageId;
        // Hard-catch for modern Analytics Engineering file types
        if (document.fileName.endsWith('.tmdl')) documentLanguage = 'tmdl';
        if (document.fileName.endsWith('.pbip')) documentLanguage = 'pbip';

        // If a manual model is locked in, keep it active and do nothing else.
        if (selectedModel) {
            modelButton.show();
            copyButton.show();
            return; 
        }

        // AUTO-DETECT LOGIC (The fallback you requested)
        if (rules.languages && rules.languages[documentLanguage]) {
            currentPayload = rules.languages[documentLanguage];
            modelButton.text = `🎯 Model: Auto (${documentLanguage.toUpperCase()})`;
            modelButton.show();
            copyButton.show();
        } else {
            // Unrecognized file type: hide everything to keep the UI clean
            currentPayload = "";
            modelButton.hide();
            copyButton.hide();
        }
    };

    // Keep it running in the background
    let tabListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) checkLanguage(editor.document);
    });
    let docListener = vscode.workspace.onDidOpenTextDocument(document => {
        checkLanguage(document);
    });

    context.subscriptions.push(copyCommand, selectModelCommand, tabListener, docListener);

    if (vscode.window.activeTextEditor) {
        checkLanguage(vscode.window.activeTextEditor.document);
    }
}

export function deactivate() {}