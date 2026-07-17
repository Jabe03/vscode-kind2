/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';

import { runTests } from '@vscode/test-electron';

async function main() {
	try {
		// The folder containing the Extension Manifest package.json
		// Passed to `--extensionDevelopmentPath`
		const extensionDevelopmentPath = path.resolve(__dirname, '../../../');

		// The path to test runner
		// Passed to --extensionTestsPath
		const extensionTestsPath = path.resolve(__dirname, './index');

		const userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vscode-kind2-tests-'));
		const extensionTestsEnv = {
			...process.env,
			VSCODE_CLI: '0',
			VSCODE_SKIP_GETTING_STARTED: '1',
			VSCODE_DISABLE_EXTENSIONS: '1',
			ELECTRON_ENABLE_LOGGING: '0',
			ELECTRON_ENABLE_STACK_DUMPING: '0'
		};

		// Download VS Code, unzip it and run the integration test
		await runTests({
			extensionDevelopmentPath,
			extensionTestsPath,
			launchArgs: [
				'--disable-extensions',
				'--user-data-dir', userDataDir,
				'--extensions-dir', path.join(userDataDir, 'extensions'),
				'--disable-workspace-trust',
				'--disable-gpu',
				'--disable-dev-shm-usage',
				'--no-sandbox'
			],
			extensionTestsEnv
		});
	} catch (err) {
		console.error('Failed to run tests');
		process.exit(1);
	}
}

main();