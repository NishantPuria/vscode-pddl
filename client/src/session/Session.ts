/* --------------------------------------------------------------------------------------------
 * Copyright (c) Jan Dolejsi. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import { ExtensionContext, UriHandler, window, Uri, TreeDataProvider, TreeItem, Event, EventEmitter, TreeView, commands, workspace, Disposable, FileChangeEvent, FileChangeType } from 'vscode';
import { PlanningDomains } from '../catalog/PlanningDomains';
import { join, posix } from 'path';
import { MemFS } from './fileSystemProvider';

export class PlanningDomainsSession {
    treeView: TreeView<FileEntry>;

    constructor(private context: ExtensionContext) {
        let memFS = new MemFS();
        this.subscribe(workspace.registerFileSystemProvider(PLANNING_DOMAINS_SESSION_SCHEMA, memFS, { isCaseSensitive: true }));
        let sessionFileListProvider = new SessionFileListProvider(context);
        let uriHandler = new PlanningDomainsSessionHandler(sessionFileListProvider, memFS);
        this.subscribe(window.registerUriHandler(uriHandler));
        this.treeView = window.createTreeView("pddl.planning.domains.session", { treeDataProvider: sessionFileListProvider });
        this.subscribe(commands.registerCommand("pddl.planning.domains.session.load", sessionId => uriHandler.loadSession(sessionId)));
        // uriHandler.ensureWorkspaceRoot()
        this.subscribe(memFS.onDidChangeFile(events => this.uploadSession(events), context.subscriptions));
    }

    uploadSession(events: FileChangeEvent[]): void {
        // todo: check if the session is shared in the read/write mode
        try {
            events.forEach(async (e) => await this.uploadFile(e));
        }
        catch (ex) {
            console.log(ex);
        }
    }

    async uploadFile(event: FileChangeEvent): Promise<void> {
        let fileName = posix.basename(event.uri.path);
        let document = await workspace.openTextDocument(event.uri);
        let documentText = document.getText();
        let planningDomains = new PlanningDomains();

        if (event.type == FileChangeType.Changed) {
            await planningDomains.putSessionFile("session123", fileName, documentText);
        } else if (event.type == FileChangeType.Created) {
            await planningDomains.postSessionFile("session123", fileName, documentText);
        } else if (event.type == FileChangeType.Deleted) {
            await planningDomains.deleteSessionFile("session123", fileName);
        }
    }

    subscribe(disposable: Disposable): void {
        this.context.subscriptions.push(disposable);
    }
}

const PLANNING_DOMAINS_SESSION_SCHEMA = "pddlsession";

class PlanningDomainsSessionHandler implements UriHandler {

    loadSessionPattern = /\/planning.domains\/load_session\/(\w+)/i;
    workspaceFolderAdded = false;
    planningDomains = new PlanningDomains();
    sessionId: string;
    rootUri: Uri;
    constructor(private fileListProvider: SessionFileListProvider, private memFS: MemFS) {
        this.rootUri = this.toFileUri("");
    }

    handleUri(uri: Uri): void {
        this.loadSessionPattern.lastIndex = 0
        let matchGroups = this.loadSessionPattern.exec(uri.path);
        if (matchGroups) {
            let sessionId = matchGroups[1];
            this.loadSession(sessionId);
            commands.executeCommand("pddl.planning.domains.session.focus");
        }
    }

    async loadSession(sessionId?: string): Promise<void> {
        this.sessionId = await this.askSessionId(sessionId);
        if (!this.sessionId) return; // operation was canceled

        let fileNames: string[] = undefined;

        try {
            let sessionJson = await this.planningDomains.getSession(this.sessionId);
            fileNames = sessionJson["files"];
            this.fileListProvider.setSession(sessionJson["sessionId"], fileNames);
        } catch (ex) {
            window.showErrorMessage("Error while loading Planning.domains session: " + ex);
        }

        try {
            this.memFS.deleteRecursive(this.rootUri);
        } catch (ex) {
            console.log(ex);
        }

        if (fileNames) {
            this.ensureWorkspaceRoot();
            fileNames.forEach(async (fileName) => await this.addFile(fileName));
        }
    }

    ensureWorkspaceRoot() {
        if (!this.workspaceFolderAdded) {
            this.workspaceFolderAdded = true;
            workspace.updateWorkspaceFolders(0, 0, { uri: this.rootUri, name: "Planning.domains Session" });
        }
    }

    async addFile(fileName: string): Promise<void> {
        let fileContent = await this.planningDomains.getSessionFile(this.sessionId, fileName);
        this.memFS.writeFile(this.toFileUri(fileName), Buffer.from(fileContent), { create: true, overwrite: true })
    }

    toFileUri(fileName: string): Uri {
        return Uri.parse(PLANNING_DOMAINS_SESSION_SCHEMA + ':/' + fileName);
    }

    async askSessionId(sessionId?: string): Promise<string> {
        if (sessionId) {
            return sessionId;
        } else {
            return await window.showInputBox({ placeHolder: "Session id code", prompt: "Copy and paste the session code from http://editor.planning.domains/ > Session > Details" });
        }
    }
}

class SessionFileListProvider implements TreeDataProvider<FileEntry> {
    private _onDidChangeTreeData: EventEmitter<FileEntry> = new EventEmitter<FileEntry>();
    readonly onDidChangeTreeData: Event<FileEntry> = this._onDidChangeTreeData.event;

    sessionId: string;
    fileNames: string[] = [];

    constructor(private context: ExtensionContext) { }

    setSession(sessionId: string, fileNames: string[]) {
        this.sessionId = sessionId;
        this.fileNames = fileNames;
        this._onDidChangeTreeData.fire();
    }

    public getTreeItem(element: FileEntry): TreeItem {
        return {
            label: element.name,
            collapsibleState: void 0,
            iconPath: this.context.asAbsolutePath(join('overview', 'file_type_pddl.svg'))
        };
    }

    getChildren(element?: FileEntry): FileEntry[] {
        element;
        return this.fileNames
            .map(fn => new SessionFile(fn));
    }
}

interface FileEntry {
    name: string;
}

class SessionFile implements FileEntry {
    constructor(public name: string) { }
}