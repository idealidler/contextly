import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    console.log('Contextly is ready for injection!');

    const rulesPath = path.join(context.extensionPath, 'src', 'rules.json');
    
    // This variable will hold the correct rule so it's ready to copy at a moment's notice
    let currentPayload = "";

    // 1. Create the UI: A sleek button in the bottom right of VS Code
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.command = 'contextly.copyContext'; // Links the button to our command below
    context.subscriptions.push(statusBarItem);

    // 2. Create the Action: What happens when you click the button
    let copyCommand = vscode.commands.registerCommand('contextly.copyContext', () => {
        if (currentPayload) {
            // Secretly write the context to the Mac clipboard
            vscode.env.clipboard.writeText(`[SYSTEM CONTEXT: ${currentPayload}]`);
            // Show a quick success message
            vscode.window.showInformationMessage('🧠 Contextly payload copied! Ready to paste to AI.');
        }
    });
    context.subscriptions.push(copyCommand);

    // 3. Update the Listener: Instead of an annoying pop-up, it updates the UI button silently
    const checkLanguage = (document: vscode.TextDocument) => {
        let documentLanguage = document.languageId;

        if (fs.existsSync(rulesPath)) {
            const rulesData = fs.readFileSync(rulesPath, 'utf8');
            const rules = JSON.parse(rulesData);

            if (rules[documentLanguage]) {
                currentPayload = rules[documentLanguage];
                // Update the button text with a cool icon and show it
                statusBarItem.text = `$(zap) Contextly: ${documentLanguage.toUpperCase()}`;
                statusBarItem.show();
            } else {
                // If it's plain text or has no rules, hide the button so it stays out of your way
                currentPayload = "";
                statusBarItem.hide();
            }
        }
    };

    // Listeners
    let tabListener = vscode.window.onDidChangeActiveTextEditor(editor => {
        if (editor) { checkLanguage(editor.document); }
    });
    let docListener = vscode.workspace.onDidOpenTextDocument(document => {
        checkLanguage(document);
    });
    context.subscriptions.push(tabListener, docListener);

    // Run the check immediately when the extension wakes up, just in case a file is already open
    if (vscode.window.activeTextEditor) {
        checkLanguage(vscode.window.activeTextEditor.document);
    }
}

export function deactivate() {}