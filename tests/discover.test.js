import {test} from 'node:test';
import assert from 'node:assert/strict';
import {universityName,universityOptions,literalLike} from '../Client/src/discover-utils.ts';
test('campus names preserve international text, deduplicate casing and escape search wildcards',()=>{
 assert.equal(universityName('  МГУ   имени Ломоносова  '),'МГУ имени Ломоносова');
 assert.deepEqual(universityOptions(['Lund University','lund university','  Lund University ','','Uppsala University']),['Lund University','Uppsala University']);
 assert.equal(literalLike('50%_campus\\name'),'50\\%\\_campus\\\\name');
});
