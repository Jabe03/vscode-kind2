/*
 * Browser entry point for the Kind 2 extension.
 * This is intentionally minimal so the extension can load in vscode.dev/github.dev.
 */

import * as vscode from 'vscode';

const WEB_UNSUPPORTED_MESSAGE = 'Kind 2 web prototype: this command is not available yet (language server integration is desktop-only for now).';

function registerPlaceholderCommand(context: vscode.ExtensionContext, command: string): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(command, async () => {
      await vscode.window.showInformationMessage(WEB_UNSUPPORTED_MESSAGE);
    })
  );
}

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  await vscode.window.showInformationMessage('Kind 2 web prototype activated.');

  const unimplemented_commands = [
    'kind2/check',
    'kind2/minimalCutSet',
    'kind2/realizability',
    'kind2/cancel',
    'kind2/raw',
    'kind2/counterExample',
    'kind2/deadlock',
    'kind2/interpret',
    'kind2/showSource',
    'kind2/enableModular',
    'kind2/disableModular',
    'kind2/enableCompositional',
    'kind2/disableCompositional',
    'kind2/modifySetting',
    'kind2/activateIVC',
    'kind2/activateMCS',
    'kind2/reveal',
    'angular-webview.start'
  ];

  for (const command of unimplemented_commands) {
    registerPlaceholderCommand(context, command);
  }
}

export function deactivate(): void {
  // No resources to dispose in the web prototype.
}
