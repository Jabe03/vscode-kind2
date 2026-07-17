/* --------------------------------------------------------------------------------------------
 * Copyright (c) Microsoft Corporation. All rights reserved.
 * Licensed under the MIT License. See License.txt in the project root for license information.
 * ------------------------------------------------------------------------------------------ */

import * as assert from 'assert';
import { openTestDocuments, commandSucceeds, commandFails } from './helper';

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
});
