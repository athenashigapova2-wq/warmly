import {test} from 'node:test';
import assert from 'node:assert/strict';
import {firstHello} from '../Client/src/chat-utils.ts';
test('first hello uses sender profile name only for loaded empty direct chats and never overwrites a draft',()=>{
 assert.equal(firstHello(' Amina ','direct',true,0,''),"Hello! I'm Amina");
 for(const args of [['Amina','group',true,0,''],['Amina','direct',false,0,''],['Amina','direct',true,1,''],['Amina','direct',true,0,'Already typing'],['','direct',true,0,'']])assert.equal(firstHello(...args),'');
});
