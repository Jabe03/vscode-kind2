import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Kind 2 Integration Tests', () => {
  test('kind2/check command is registered', async () => {
    const extension =
      vscode.extensions.getExtension('kind2-mc.vscode-kind2');

    assert.ok(extension, 'Kind 2 extension was not found');

    await extension.activate();

    const commands = await vscode.commands.getCommands(true);

    assert.ok(
      commands.includes('kind2/check'),
      'kind2/check command was not registered'
    );
  });
});