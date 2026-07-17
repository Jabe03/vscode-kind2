/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert';
import { openTestDocuments, commandSucceeds, commandFails, executeExtensionCommand, loadTestManifest } from './helper';

suite('Extension command tests', () => {
	test('loads sample files and runs commands without throwing', async () => {
		const docs = await openTestDocuments(['abs.lus', 'fibonacci.lus']);
		assert.strictEqual(docs.length, 2);

		const enableCompositional = await commandSucceeds('kind2/enableCompositional');
		assert.strictEqual(enableCompositional, true, 'kind2/enableCompositional should not throw');

		const disableCompositional = await commandSucceeds('kind2/disableCompositional');
		assert.strictEqual(disableCompositional, true, 'kind2/disableCompositional should not throw');

		const enableModular = await commandFails('kind2/enableModular');
		assert.strictEqual(enableModular, false, 'kind2/enableModular should not throw');
	});

	test('resolves components from a manifest and runs kind2/check', async () => {
		const manifest = loadTestManifest();
		const docs = await openTestDocuments(manifest.files);
		assert.strictEqual(docs.length, manifest.files.length);

		for (const check of manifest.checks) {
			const doc = docs.find(document => document.fileName.endsWith(check.file));
			assert.ok(doc, `Expected to open ${check.file}`);

			for (const node of check.nodes) {
				const result = await executeExtensionCommand('kind2/checkForTest', doc.uri, node.name, node.candidates) as { ok: boolean; error?: string; state?: string[] };
				assert.strictEqual(typeof result.ok, 'boolean', `kind2/checkForTest should return an outcome for ${node.name}`);
				if (!result.ok) {
					assert.ok(result.error, `kind2/checkForTest should include an error message for ${node.name}`);
				}
			}
		}
	});
});
