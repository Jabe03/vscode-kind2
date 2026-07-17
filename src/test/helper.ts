/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export let doc: vscode.TextDocument;
export let editor: vscode.TextEditor;
export let documentEol: string;
export let platformEol: string;

/**
 * Activates the vscode.lsp-sample extension
 */
export async function activate(docUri: vscode.Uri) {
	// The extensionId is `publisher.name` from package.json
	const ext = vscode.extensions.getExtension('kind2-mc.vscode-kind2')!;
	await ext.activate();
	try {
		doc = await vscode.workspace.openTextDocument(docUri);
		editor = await vscode.window.showTextDocument(doc, { preview: false });
		await sleep(1000); // Wait for server activation
	} catch (e) {
		console.error(e);
	}
}

async function sleep(ms: number) {
	return new Promise(resolve => setTimeout(resolve, ms));
}

export const getDocPath = (p: string) => {
	return path.resolve(__dirname, '../../src/test/lustre-examples', p);
};
export const getDocUri = (p: string) => {
	return vscode.Uri.file(getDocPath(p));
};

export async function openTestDocument(relPath: string): Promise<vscode.TextDocument> {
	const docUri = getDocUri(relPath);
	doc = await vscode.workspace.openTextDocument(docUri);
	editor = await vscode.window.showTextDocument(doc);
	return doc;
}

export async function openTestDocuments(relPaths: string[]): Promise<vscode.TextDocument[]> {
	const documents: vscode.TextDocument[] = [];
	for (const relPath of relPaths) {
		documents.push(await openTestDocument(relPath));
	}
	return documents;
}

export async function executeExtensionCommand(command: string, ...args: any[]): Promise<unknown> {
	return await vscode.commands.executeCommand(command, ...args);
}

export async function commandSucceeds(command: string, ...args: any[]): Promise<boolean> {
	try {
		await executeExtensionCommand(command, ...args);
		return true;
	} catch {
		return false;
	}
}

export async function commandFails(command: string, ...args: any[]): Promise<boolean> {
	return !(await commandSucceeds(command, ...args));
}

export interface TestManifestNode {
	name: string;
	candidates?: string[];
}

export interface TestManifest {
	files: string[];
	checks: Array<{
		file: string;
		nodes: TestManifestNode[];
	}>;
}

export function loadTestManifest(relativePath: string = 'test-manifest.json'): TestManifest {
	const manifestPath = path.resolve(__dirname, '../../src/test', relativePath);
	const content = fs.readFileSync(manifestPath, 'utf8');
	return JSON.parse(content) as TestManifest;
}

export async function setTestContent(content: string): Promise<boolean> {
	const all = new vscode.Range(
		doc.positionAt(0),
		doc.positionAt(doc.getText().length)
	);
	return editor.edit(eb => eb.replace(all, content));
}
