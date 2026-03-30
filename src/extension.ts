import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

type LegacyModel = string;

interface StoredModel {
    context: string;
    description?: string;
    tags?: string[];
    intent?: string;
    role?: string;
    task?: string;
    constraints?: string[];
    outputFormat?: string;
    examples?: string;
    successCriteria?: string[];
    updatedAt?: string;
    lastUsedAt?: string;
}

interface RulesFile {
    models: Record<string, LegacyModel | StoredModel>;
}

interface NormalizedModel {
    name: string;
    context: string;
    description: string;
    tags: string[];
    intent: string;
    role: string;
    task: string;
    constraints: string[];
    outputFormat: string;
    examples: string;
    successCriteria: string[];
    updatedAt?: string;
    lastUsedAt?: string;
}

interface QuickPickModelItem extends vscode.QuickPickItem {
    modelName?: string;
    action: 'manage' | 'copy' | 'chat';
}

export function activate(context: vscode.ExtensionContext) {
    let activeModelName = '';

    const modelButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    modelButton.command = 'contextly.selectModel';
    modelButton.text = '$(symbol-key) Contextly';
    modelButton.tooltip = 'Select a context and copy it or send it to chat';
    modelButton.show();
    context.subscriptions.push(modelButton);

    const getWorkspaceRulesPath = (): string | null => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        return workspaceFolder ? path.join(workspaceFolder.uri.fsPath, '.contextly.json') : null;
    };

    const readRules = (rulesPath: string): RulesFile => {
        if (!fs.existsSync(rulesPath)) {
            return { models: {} };
        }

        const raw = JSON.parse(fs.readFileSync(rulesPath, 'utf8')) as Partial<RulesFile>;
        return { models: raw.models ?? {} };
    };

    const writeRules = (rulesPath: string, rules: RulesFile) => {
        fs.writeFileSync(rulesPath, JSON.stringify(rules, null, 4));
    };

    const normalizeModel = (name: string, value: LegacyModel | StoredModel): NormalizedModel => {
        if (typeof value === 'string') {
            return {
                name,
                context: value,
                description: '',
                tags: [],
                intent: '',
                role: '',
                task: '',
                constraints: [],
                outputFormat: '',
                examples: '',
                successCriteria: []
            };
        }

        return {
            name,
            context: value.context ?? '',
            description: value.description ?? '',
            tags: Array.isArray(value.tags) ? value.tags : [],
            intent: value.intent ?? '',
            role: value.role ?? '',
            task: value.task ?? '',
            constraints: Array.isArray(value.constraints) ? value.constraints : [],
            outputFormat: value.outputFormat ?? '',
            examples: value.examples ?? '',
            successCriteria: Array.isArray(value.successCriteria) ? value.successCriteria : [],
            updatedAt: value.updatedAt,
            lastUsedAt: value.lastUsedAt
        };
    };

    const getModels = (rules: RulesFile): NormalizedModel[] =>
        Object.entries(rules.models)
            .map(([name, value]) => normalizeModel(name, value))
            .sort((left, right) => left.name.localeCompare(right.name));

    const buildPrompt = (model: NormalizedModel) => {
        const sections: string[] = ['<prompt>', `  <name>${model.name}</name>`];

        if (model.description) {
            sections.push(`  <description>${model.description}</description>`);
        }

        if (model.tags.length > 0) {
            sections.push(`  <tags>${model.tags.join(', ')}</tags>`);
        }

        if (model.intent) {
            sections.push('  <intent>');
            sections.push(indentBlock(model.intent, 4));
            sections.push('  </intent>');
        }

        if (model.role) {
            sections.push('  <role>');
            sections.push(indentBlock(model.role, 4));
            sections.push('  </role>');
        }

        if (model.task) {
            sections.push('  <task>');
            sections.push(indentBlock(model.task, 4));
            sections.push('  </task>');
        }

        if (model.context) {
            sections.push('  <context>');
            sections.push(indentBlock(model.context, 4));
            sections.push('  </context>');
        }

        if (model.constraints.length > 0) {
            sections.push('  <constraints>');
            sections.push(...model.constraints.map(item => `    - ${item}`));
            sections.push('  </constraints>');
        }

        if (model.outputFormat) {
            sections.push('  <output_format>');
            sections.push(indentBlock(model.outputFormat, 4));
            sections.push('  </output_format>');
        }

        if (model.successCriteria.length > 0) {
            sections.push('  <success_criteria>');
            sections.push(...model.successCriteria.map(item => `    - ${item}`));
            sections.push('  </success_criteria>');
        }

        if (model.examples) {
            sections.push('  <examples>');
            sections.push(indentBlock(model.examples, 4));
            sections.push('  </examples>');
        }

        sections.push('</prompt>');
        return sections.join('\n');
    };

    const updateModelButton = (modelName?: string) => {
        activeModelName = modelName ?? '';
        modelButton.text = activeModelName
            ? `$(symbol-key) Contextly: ${activeModelName}`
            : '$(symbol-key) Contextly';
        modelButton.tooltip = activeModelName
            ? `Active context: ${activeModelName}`
            : 'Select a context and copy it or send it to chat';
    };

    const touchModelUsage = (rulesPath: string, modelName: string) => {
        const rules = readRules(rulesPath);
        const existing = rules.models[modelName];
        if (!existing) {
            return;
        }

        const normalized = normalizeModel(modelName, existing);
        rules.models[modelName] = {
            context: normalized.context,
            description: normalized.description || undefined,
            tags: normalized.tags,
            intent: normalized.intent || undefined,
            role: normalized.role || undefined,
            task: normalized.task || undefined,
            constraints: normalized.constraints,
            outputFormat: normalized.outputFormat || undefined,
            examples: normalized.examples || undefined,
            successCriteria: normalized.successCriteria,
            updatedAt: normalized.updatedAt,
            lastUsedAt: new Date().toISOString()
        };
        writeRules(rulesPath, rules);
    };

    const useModel = async (model: NormalizedModel, action: 'copy' | 'chat') => {
        const rulesPath = getWorkspaceRulesPath();
        if (!rulesPath) {
            vscode.window.showErrorMessage('Contextly: Please open a workspace/folder to use contexts.');
            return;
        }

        const prompt = buildPrompt(model);
        updateModelButton(model.name);
        touchModelUsage(rulesPath, model.name);

        if (action === 'chat') {
            try {
                await vscode.commands.executeCommand('workbench.action.chat.open', {
                    query: prompt,
                    isPartialQuery: true
                });
                vscode.window.showInformationMessage(`Contextly: Opened chat with '${model.name}' prefilled.`);
                return;
            } catch {
                await vscode.env.clipboard.writeText(prompt);
                vscode.window.showWarningMessage(`Contextly: Chat could not be opened, so '${model.name}' was copied instead.`);
                return;
            }
        }

        await vscode.env.clipboard.writeText(prompt);
        vscode.window.showInformationMessage(`Contextly: '${model.name}' copied to clipboard.`);
    };

    const selectModelCommand = vscode.commands.registerCommand('contextly.selectModel', async () => {
        const rulesPath = getWorkspaceRulesPath();

        if (!rulesPath) {
            vscode.window.showErrorMessage('Contextly: Please open a workspace/folder to manage contexts.');
            return;
        }

        let rules: RulesFile;
        try {
            rules = readRules(rulesPath);
        } catch {
            vscode.window.showErrorMessage('Contextly Error: Your local .contextly.json file is corrupted.');
            return;
        }

        const models = getModels(rules);
        const items: QuickPickModelItem[] = [
            {
                label: '$(settings-gear) Manage Contexts',
                detail: 'Create, edit, rename, tag, or delete saved contexts',
                action: 'manage'
            },
            ...models.map(model => ({
                label: model.name,
                description: model.tags.length > 0 ? model.tags.join(' • ') : undefined,
                detail: model.description || summarizeContext(model.context),
                modelName: model.name,
                action: 'copy' as const
            }))
        ];

        const selection = await vscode.window.showQuickPick(items, {
            placeHolder: models.length > 0
                ? 'Choose a context to copy or send to chat'
                : 'No contexts yet. Open Manage Contexts to create one.',
            matchOnDescription: true,
            matchOnDetail: true
        });

        if (!selection) {
            return;
        }

        if (selection.action === 'manage') {
            await vscode.commands.executeCommand('contextly.openDashboard');
            return;
        }

        const model = models.find(entry => entry.name === selection.modelName);
        if (!model) {
            vscode.window.showErrorMessage(`Contextly Error: Could not find '${selection.modelName}'.`);
            return;
        }

        const target = await vscode.window.showQuickPick<QuickPickModelItem>([
            {
                label: 'Copy to Clipboard',
                detail: 'Use this in ChatGPT, Copilot, Claude, or anywhere else',
                modelName: model.name,
                action: 'copy'
            },
            {
                label: 'Open in Copilot Chat',
                detail: 'Open chat and prefill the prompt so you can review or send it',
                modelName: model.name,
                action: 'chat'
            }
        ], {
            placeHolder: `How should Contextly use '${model.name}'?`
        });

        if (!target) {
            return;
        }

        if (target.action === 'manage') {
            return;
        }

        await useModel(model, target.action);
    });

    const insertActiveModelCommand = vscode.commands.registerCommand('contextly.insertActiveModel', async () => {
        const rulesPath = getWorkspaceRulesPath();

        if (!rulesPath) {
            vscode.window.showErrorMessage('Contextly: Please open a workspace/folder to use contexts.');
            return;
        }

        let rules: RulesFile;
        try {
            rules = readRules(rulesPath);
        } catch {
            vscode.window.showErrorMessage('Contextly Error: Your local .contextly.json file is corrupted.');
            return;
        }

        if (!activeModelName) {
            await vscode.commands.executeCommand('contextly.selectModel');
            return;
        }

        const existing = rules.models[activeModelName];
        if (!existing) {
            updateModelButton();
            vscode.window.showWarningMessage('Contextly: The active context no longer exists. Please select another one.');
            return;
        }

        await useModel(normalizeModel(activeModelName, existing), 'chat');
    });

    const dashboardCommand = vscode.commands.registerCommand('contextly.openDashboard', () => {
        const panel = vscode.window.createWebviewPanel(
            'contextlyDashboard',
            'Contextly Settings',
            vscode.ViewColumn.One,
            { enableScripts: true }
        );

        const rulesPath = getWorkspaceRulesPath();
        let existingModels: NormalizedModel[] = [];

        if (rulesPath) {
            try {
                existingModels = getModels(readRules(rulesPath));
            } catch {
                existingModels = [];
            }
        }

        panel.webview.html = getDashboardUI(existingModels);

        panel.webview.onDidReceiveMessage(message => {
            const currentRulesPath = getWorkspaceRulesPath();
            if (!currentRulesPath) {
                return;
            }

            let rulesData: RulesFile;
            try {
                rulesData = readRules(currentRulesPath);
            } catch {
                vscode.window.showErrorMessage('Contextly Error: Could not read .contextly.json.');
                return;
            }

            if (message.command === 'saveModel') {
                const modelName = String(message.modelName ?? '').trim();
                const originalName = String(message.originalModelName ?? '').trim();
                const modelContext = String(message.modelContext ?? '').trim();
                const description = String(message.modelDescription ?? '').trim();
                const tags = parseTags(String(message.modelTags ?? ''));
                const intent = String(message.modelIntent ?? '').trim();
                const role = String(message.modelRole ?? '').trim();
                const task = String(message.modelTask ?? '').trim();
                const constraints = parseMultilineList(String(message.modelConstraints ?? ''));
                const outputFormat = String(message.modelOutputFormat ?? '').trim();
                const successCriteria = parseMultilineList(String(message.modelSuccessCriteria ?? ''));
                const examples = String(message.modelExamples ?? '').trim();

                if (!modelName || !modelContext) {
                    vscode.window.showErrorMessage('Contextly: Name and context are required.');
                    return;
                }

                if (originalName && originalName !== modelName) {
                    delete rulesData.models[originalName];
                    if (activeModelName === originalName) {
                        activeModelName = '';
                    }
                }

                rulesData.models[modelName] = {
                    context: modelContext,
                    description: description || undefined,
                    tags,
                    intent: intent || undefined,
                    role: role || undefined,
                    task: task || undefined,
                    constraints,
                    outputFormat: outputFormat || undefined,
                    examples: examples || undefined,
                    successCriteria,
                    updatedAt: new Date().toISOString(),
                    lastUsedAt: modelName === activeModelName
                        ? new Date().toISOString()
                        : normalizeModel(modelName, rulesData.models[modelName] ?? modelContext).lastUsedAt
                };

                writeRules(currentRulesPath, rulesData);
                updateModelButton(modelName);
                void vscode.env.clipboard.writeText(buildPrompt(normalizeModel(modelName, rulesData.models[modelName])));

                vscode.window.showInformationMessage(`Contextly: '${modelName}' saved and copied to clipboard.`);
                panel.dispose();
            }

            if (message.command === 'deleteModel') {
                const targetModel = String(message.modelName ?? '').trim();

                if (!rulesData.models[targetModel]) {
                    vscode.window.showErrorMessage(`Contextly Error: Could not find '${targetModel}' to delete.`);
                    return;
                }

                delete rulesData.models[targetModel];
                writeRules(currentRulesPath, rulesData);

                if (activeModelName === targetModel) {
                    updateModelButton();
                }

                vscode.window.showInformationMessage(`Contextly: '${targetModel}' has been deleted.`);
            }
        });
    });

    context.subscriptions.push(selectModelCommand, insertActiveModelCommand, dashboardCommand);
}

function summarizeContext(context: string) {
    const singleLine = context.replace(/\s+/g, ' ').trim();
    if (singleLine.length <= 90) {
        return singleLine;
    }

    return `${singleLine.slice(0, 87)}...`;
}

function indentBlock(value: string, spaces: number) {
    const padding = ' '.repeat(spaces);
    return value
        .split('\n')
        .map(line => `${padding}${line}`)
        .join('\n');
}

function parseTags(rawTags: string) {
    return rawTags
        .split(',')
        .map(tag => tag.trim())
        .filter(tag => tag.length > 0);
}

function parseMultilineList(rawValue: string) {
    return rawValue
        .split('\n')
        .map(item => item.replace(/^\s*[-*]\s?/, '').trim())
        .filter(item => item.length > 0);
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getDashboardUI(models: NormalizedModel[]) {
    const modelsJson = JSON.stringify(models);

    return `<!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Contextly Manager</title>
        <style>
            :root {
                color-scheme: light dark;
            }

            body {
                font-family: var(--vscode-font-family);
                background:
                    radial-gradient(circle at top right, color-mix(in srgb, var(--vscode-button-background) 16%, transparent), transparent 30%),
                    var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
                padding: 32px;
                max-width: 900px;
                margin: 0 auto;
            }

            h1 {
                font-weight: 600;
                margin-bottom: 8px;
            }

            p {
                opacity: 0.8;
                font-size: 14px;
                margin-bottom: 24px;
                line-height: 1.6;
            }

            .panel {
                background: color-mix(in srgb, var(--vscode-editorWidget-background) 90%, transparent);
                border: 1px solid var(--vscode-panel-border);
                border-radius: 12px;
                padding: 20px;
                margin-bottom: 24px;
            }

            .toolbar {
                display: flex;
                gap: 12px;
                align-items: center;
                margin-bottom: 16px;
                flex-wrap: wrap;
            }

            .search {
                flex: 1;
                min-width: 240px;
            }

            .model-list {
                display: grid;
                gap: 12px;
            }

            .model-item {
                display: grid;
                grid-template-columns: 1fr auto;
                gap: 16px;
                align-items: start;
                background-color: var(--vscode-editorWidget-background);
                padding: 16px;
                border-radius: 10px;
                border: 1px solid var(--vscode-input-border);
            }

            .model-main {
                display: grid;
                gap: 6px;
            }

            .model-title-row {
                display: flex;
                align-items: center;
                gap: 8px;
                flex-wrap: wrap;
            }

            .model-name {
                font-weight: 700;
                font-size: 14px;
            }

            .pill {
                font-size: 11px;
                padding: 3px 8px;
                border-radius: 999px;
                background: color-mix(in srgb, var(--vscode-button-background) 18%, transparent);
                border: 1px solid color-mix(in srgb, var(--vscode-button-background) 45%, transparent);
            }

            .model-description,
            .model-meta,
            .model-preview {
                font-size: 13px;
                line-height: 1.5;
                opacity: 0.82;
            }

            .model-preview {
                font-family: var(--vscode-editor-font-family);
                background: color-mix(in srgb, var(--vscode-textBlockQuote-background) 50%, transparent);
                border-left: 3px solid var(--vscode-button-background);
                padding: 10px 12px;
                border-radius: 6px;
                white-space: pre-wrap;
            }

            .model-actions,
            .confirm-actions {
                display: flex;
                gap: 8px;
                align-items: center;
                flex-wrap: wrap;
                justify-content: flex-end;
            }

            .confirm-actions {
                display: none;
                color: var(--vscode-errorForeground);
                font-size: 13px;
                font-weight: 600;
            }

            .empty-state {
                font-style: italic;
                opacity: 0.65;
                font-size: 13px;
                padding: 12px 0 4px;
            }

            .form-section-title {
                font-size: 18px;
                font-weight: 600;
                margin-bottom: 16px;
            }

            .form-group {
                margin-bottom: 18px;
            }

            label {
                display: block;
                margin-bottom: 8px;
                font-weight: 700;
                font-size: 12px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
                opacity: 0.85;
            }

            input,
            textarea {
                width: 100%;
                box-sizing: border-box;
                padding: 12px;
                background-color: var(--vscode-input-background);
                color: var(--vscode-input-foreground);
                border: 1px solid var(--vscode-input-border);
                border-radius: 6px;
                font-family: var(--vscode-font-family);
                font-size: 14px;
            }

            input:focus,
            textarea:focus {
                outline: 1px solid var(--vscode-focusBorder);
                border-color: var(--vscode-focusBorder);
            }

            textarea {
                resize: vertical;
                min-height: 220px;
                line-height: 1.6;
                font-family: var(--vscode-editor-font-family);
            }

            button {
                padding: 8px 12px;
                font-size: 12px;
                border-radius: 6px;
                cursor: pointer;
                border: none;
                font-weight: 700;
                transition: opacity 0.2s ease, transform 0.2s ease;
            }

            button:hover {
                transform: translateY(-1px);
            }

            .btn-primary {
                background-color: var(--vscode-button-background);
                color: var(--vscode-button-foreground);
            }

            .btn-primary:hover {
                background-color: var(--vscode-button-hoverBackground);
            }

            .btn-secondary {
                background-color: var(--vscode-button-secondaryBackground);
                color: var(--vscode-button-secondaryForeground);
            }

            .btn-secondary:hover {
                background-color: var(--vscode-button-secondaryHoverBackground);
            }

            .btn-delete {
                background-color: transparent;
                color: var(--vscode-errorForeground);
                border: 1px solid var(--vscode-errorForeground);
            }

            .btn-delete:hover,
            .btn-danger:hover {
                background-color: color-mix(in srgb, var(--vscode-errorForeground) 18%, transparent);
            }

            .btn-danger {
                background-color: transparent;
                color: var(--vscode-errorForeground);
                border: 1px solid var(--vscode-errorForeground);
            }

            .save-row {
                display: flex;
                gap: 12px;
                flex-wrap: wrap;
            }

            .section-grid {
                display: grid;
                gap: 18px;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            }

            .section-block {
                margin-bottom: 18px;
            }

            .helper-text {
                font-size: 12px;
                line-height: 1.5;
                opacity: 0.72;
                margin-top: 6px;
            }

            details {
                border: 1px solid var(--vscode-input-border);
                border-radius: 8px;
                padding: 12px 14px;
                margin-top: 8px;
                background: color-mix(in srgb, var(--vscode-editorWidget-background) 75%, transparent);
            }

            summary {
                cursor: pointer;
                font-weight: 700;
                font-size: 13px;
            }

            .save-row button {
                flex: 1;
                min-width: 220px;
                padding: 14px 18px;
                font-size: 14px;
            }

            @media (max-width: 700px) {
                body {
                    padding: 20px;
                }

                .model-item {
                    grid-template-columns: 1fr;
                }

                .model-actions,
                .confirm-actions {
                    justify-content: flex-start;
                }
            }
        </style>
    </head>
    <body>
        <h1>Contextly Workspace Contexts</h1>
        <p>Store reusable AI prompts locally in <code>.contextly.json</code>. Contextly now builds a structured prompt from intent, task, context, constraints, and output format so models get clearer instructions.</p>

        <section class="panel">
            <div class="toolbar">
                <input class="search" type="text" id="searchInput" placeholder="Search by name, description, or tags">
                <button class="btn-secondary" id="resetBtn">Clear Form</button>
            </div>
            <div class="model-list" id="modelListContainer"></div>
        </section>

        <section class="panel">
            <h2 class="form-section-title" id="formTitle">Create New Context</h2>

            <input type="hidden" id="originalModelName">

            <div class="section-grid">
                <div class="form-group">
                    <label for="modelName">Prompt Name</label>
                    <input type="text" id="modelName" placeholder="e.g., Fleet Operations Core">
                </div>

                <div class="form-group">
                    <label for="modelDescription">Description</label>
                    <input type="text" id="modelDescription" placeholder="What this prompt is for and when to use it">
                </div>
            </div>

            <div class="form-group">
                <label for="modelTags">Tags</label>
                <input type="text" id="modelTags" placeholder="e.g., dax, finance, reporting">
            </div>

            <div class="section-block">
                <div class="section-grid">
                    <div class="form-group">
                        <label for="modelIntent">Intent</label>
                        <textarea id="modelIntent" placeholder="Describe the overall purpose of this prompt, such as helping with BI analysis or generating code under workspace conventions."></textarea>
                        <div class="helper-text">Use this for the high-level objective.</div>
                    </div>

                    <div class="form-group">
                        <label for="modelTask">Task</label>
                        <textarea id="modelTask" placeholder="Describe the concrete job the model should perform when this prompt is used."></textarea>
                        <div class="helper-text">Use this for the exact ask, not the background knowledge.</div>
                    </div>
                </div>
            </div>

            <div class="form-group">
                <label for="modelContext">Context</label>
                <textarea id="modelContext" placeholder="Enter schema notes, business rules, repo facts, formatting standards, and domain knowledge the model should rely on..."></textarea>
                <div class="helper-text">Keep the facts here. Keep the ask in Task.</div>
            </div>

            <div class="section-grid">
                <div class="form-group">
                    <label for="modelConstraints">Constraints</label>
                    <textarea id="modelConstraints" placeholder="- Do not invent table names&#10;- Ask clarifying questions if a KPI definition is missing&#10;- Prefer concise answers"></textarea>
                    <div class="helper-text">One rule per line.</div>
                </div>

                <div class="form-group">
                    <label for="modelOutputFormat">Output Format</label>
                    <textarea id="modelOutputFormat" placeholder="Respond with markdown bullets, then provide code in a fenced block, then list assumptions."></textarea>
                    <div class="helper-text">Tell the model how to structure the answer.</div>
                </div>
            </div>

            <details>
                <summary>Advanced Prompt Fields</summary>

                <div class="section-grid" style="margin-top: 16px;">
                    <div class="form-group">
                        <label for="modelRole">Role</label>
                        <input type="text" id="modelRole" placeholder="e.g., Senior analytics engineer">
                    </div>

                    <div class="form-group">
                        <label for="modelSuccessCriteria">Success Criteria</label>
                        <textarea id="modelSuccessCriteria" placeholder="- Answer should be actionable&#10;- Mention assumptions separately&#10;- Preserve naming conventions"></textarea>
                        <div class="helper-text">One success criterion per line.</div>
                    </div>
                </div>

                <div class="form-group">
                    <label for="modelExamples">Examples</label>
                    <textarea id="modelExamples" placeholder="Input: Build a measure for on-time delivery rate&#10;Output: ..."></textarea>
                    <div class="helper-text">Optional few-shot examples for especially tricky tasks.</div>
                </div>
            </details>

            <div class="save-row">
                <button class="btn-primary" id="saveBtn">Save and Copy</button>
            </div>
        </section>

        <script>
            const vscode = acquireVsCodeApi();
            let savedModels = ${modelsJson};

            const listContainer = document.getElementById('modelListContainer');
            const nameInput = document.getElementById('modelName');
            const originalNameInput = document.getElementById('originalModelName');
            const descriptionInput = document.getElementById('modelDescription');
            const tagsInput = document.getElementById('modelTags');
            const intentInput = document.getElementById('modelIntent');
            const roleInput = document.getElementById('modelRole');
            const taskInput = document.getElementById('modelTask');
            const constraintsInput = document.getElementById('modelConstraints');
            const outputFormatInput = document.getElementById('modelOutputFormat');
            const contextInput = document.getElementById('modelContext');
            const successCriteriaInput = document.getElementById('modelSuccessCriteria');
            const examplesInput = document.getElementById('modelExamples');
            const formTitle = document.getElementById('formTitle');
            const searchInput = document.getElementById('searchInput');

            function escapeHtml(value) {
                return value
                    .replace(/&/g, '&amp;')
                    .replace(/</g, '&lt;')
                    .replace(/>/g, '&gt;')
                    .replace(/"/g, '&quot;')
                    .replace(/'/g, '&#39;');
            }

            function summarizeContext(context) {
                const singleLine = context.replace(/\\s+/g, ' ').trim();
                return singleLine.length <= 140 ? singleLine : singleLine.slice(0, 137) + '...';
            }

            function formatTimestamp(timestamp) {
                if (!timestamp) {
                    return '';
                }

                const date = new Date(timestamp);
                return Number.isNaN(date.getTime()) ? '' : date.toLocaleString();
            }

            function clearForm() {
                originalNameInput.value = '';
                nameInput.value = '';
                descriptionInput.value = '';
                tagsInput.value = '';
                intentInput.value = '';
                roleInput.value = '';
                taskInput.value = '';
                constraintsInput.value = '';
                outputFormatInput.value = '';
                contextInput.value = '';
                successCriteriaInput.value = '';
                examplesInput.value = '';
                formTitle.innerText = 'Create New Context';
            }

            function loadForEdit(name) {
                const model = savedModels.find(entry => entry.name === name);
                if (!model) {
                    return;
                }

                originalNameInput.value = model.name;
                nameInput.value = model.name;
                descriptionInput.value = model.description || '';
                tagsInput.value = (model.tags || []).join(', ');
                intentInput.value = model.intent || '';
                roleInput.value = model.role || '';
                taskInput.value = model.task || '';
                constraintsInput.value = (model.constraints || []).join('\\n');
                outputFormatInput.value = model.outputFormat || '';
                contextInput.value = model.context;
                successCriteriaInput.value = (model.successCriteria || []).join('\\n');
                examplesInput.value = model.examples || '';
                formTitle.innerText = 'Edit Context: ' + model.name;
                window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
            }

            function renderModels() {
                const query = searchInput.value.trim().toLowerCase();
                const filteredModels = savedModels.filter(model => {
                    const haystack = [
                        model.name,
                        model.description || '',
                        (model.tags || []).join(' '),
                        model.intent || '',
                        model.task || '',
                        (model.constraints || []).join(' '),
                        model.outputFormat || '',
                        (model.successCriteria || []).join(' '),
                        model.context,
                        model.examples || ''
                    ].join(' ').toLowerCase();
                    return haystack.includes(query);
                });

                if (filteredModels.length === 0) {
                    listContainer.innerHTML = '<div class="empty-state">' +
                        (savedModels.length === 0
                            ? 'No contexts saved in this workspace yet. Create one below.'
                            : 'No contexts match your search.') +
                        '</div>';
                    return;
                }

                listContainer.innerHTML = filteredModels.map(model => {
                    const tags = (model.tags || []).map(tag => '<span class="pill">' + escapeHtml(tag) + '</span>').join('');
                    const meta = [
                        model.updatedAt ? 'Updated: ' + escapeHtml(formatTimestamp(model.updatedAt)) : '',
                        model.lastUsedAt ? 'Last used: ' + escapeHtml(formatTimestamp(model.lastUsedAt)) : ''
                    ].filter(Boolean).join(' | ');

                    return '<div class="model-item">' +
                        '<div class="model-main">' +
                            '<div class="model-title-row">' +
                                '<span class="model-name">' + escapeHtml(model.name) + '</span>' +
                                tags +
                            '</div>' +
                            (model.description ? '<div class="model-description">' + escapeHtml(model.description) + '</div>' : '') +
                            (meta ? '<div class="model-meta">' + meta + '</div>' : '') +
                            (model.intent ? '<div class="model-meta"><strong>Intent:</strong> ' + escapeHtml(model.intent) + '</div>' : '') +
                            (model.task ? '<div class="model-meta"><strong>Task:</strong> ' + escapeHtml(model.task) + '</div>' : '') +
                            '<div class="model-preview">' + escapeHtml(summarizeContext(model.context)) + '</div>' +
                        '</div>' +
                        '<div>' +
                            '<div class="model-actions" data-actions="' + escapeHtml(model.name) + '">' +
                                '<button class="btn-secondary" data-edit="' + escapeHtml(model.name) + '">Edit</button>' +
                                '<button class="btn-delete" data-delete="' + escapeHtml(model.name) + '">Delete</button>' +
                            '</div>' +
                            '<div class="confirm-actions" data-confirm="' + escapeHtml(model.name) + '">' +
                                '<span>Delete this context?</span>' +
                                '<button class="btn-danger" data-confirm-yes="' + escapeHtml(model.name) + '">Yes</button>' +
                                '<button class="btn-secondary" data-confirm-no="' + escapeHtml(model.name) + '">No</button>' +
                            '</div>' +
                        '</div>' +
                    '</div>';
                }).join('');
            }

            listContainer.addEventListener('click', event => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) {
                    return;
                }

                const editName = target.dataset.edit;
                if (editName) {
                    loadForEdit(editName);
                    return;
                }

                const deleteName = target.dataset.delete;
                if (deleteName) {
                    const actions = document.querySelector('[data-actions="' + CSS.escape(deleteName) + '"]');
                    const confirm = document.querySelector('[data-confirm="' + CSS.escape(deleteName) + '"]');
                    if (actions && confirm) {
                        actions.style.display = 'none';
                        confirm.style.display = 'flex';
                    }
                    return;
                }

                const cancelDeleteName = target.dataset.confirmNo;
                if (cancelDeleteName) {
                    const actions = document.querySelector('[data-actions="' + CSS.escape(cancelDeleteName) + '"]');
                    const confirm = document.querySelector('[data-confirm="' + CSS.escape(cancelDeleteName) + '"]');
                    if (actions && confirm) {
                        confirm.style.display = 'none';
                        actions.style.display = 'flex';
                    }
                    return;
                }

                const confirmDeleteName = target.dataset.confirmYes;
                if (confirmDeleteName) {
                    savedModels = savedModels.filter(model => model.name !== confirmDeleteName);
                    renderModels();

                    if (nameInput.value === confirmDeleteName || originalNameInput.value === confirmDeleteName) {
                        clearForm();
                    }

                    vscode.postMessage({ command: 'deleteModel', modelName: confirmDeleteName });
                }
            });

            searchInput.addEventListener('input', renderModels);
            document.getElementById('resetBtn').addEventListener('click', clearForm);

            document.getElementById('saveBtn').addEventListener('click', () => {
                const name = nameInput.value.trim();
                const description = descriptionInput.value.trim();
                const tags = tagsInput.value.trim();
                const intent = intentInput.value.trim();
                const role = roleInput.value.trim();
                const task = taskInput.value.trim();
                const constraints = constraintsInput.value.trim();
                const outputFormat = outputFormatInput.value.trim();
                const context = contextInput.value.trim();
                const successCriteria = successCriteriaInput.value.trim();
                const examples = examplesInput.value.trim();

                if (!name || !context) {
                    return;
                }

                vscode.postMessage({
                    command: 'saveModel',
                    originalModelName: originalNameInput.value.trim(),
                    modelName: name,
                    modelDescription: description,
                    modelTags: tags,
                    modelIntent: intent,
                    modelRole: role,
                    modelTask: task,
                    modelConstraints: constraints,
                    modelOutputFormat: outputFormat,
                    modelContext: context
                    ,
                    modelSuccessCriteria: successCriteria,
                    modelExamples: examples
                });
            });

            renderModels();
        </script>
    </body>
    </html>`;
}
