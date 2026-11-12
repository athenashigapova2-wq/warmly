import {test} from 'node:test';
import assert from 'node:assert/strict';
import {effectiveRole,canSell,roleLabel} from '../Client/src/roles.ts';
test('missing or unapproved university roles have visitor capabilities',()=>{
 for(const r of [null,undefined,{requested_role:'visitor'},{requested_role:'university',approved:false}]){assert.equal(effectiveRole(r),'visitor');assert.equal(canSell(r),false);}
 assert.equal(canSell({requested_role:'student'}),true);assert.equal(effectiveRole({requested_role:'university',approved:true}),'university');assert.match(roleLabel({requested_role:'university',approved:false}),/awaiting approval/);
});
