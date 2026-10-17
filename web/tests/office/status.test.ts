import {test} from 'node:test';import assert from 'node:assert/strict';
import {presentSession} from '../../src/office/model';import {session as s} from './fixtures';
test('stale working status retains source activity and distinct health',()=>{const p=presentSession(s('a','coder','working',{stale:true}));assert.equal(p.activity,'working');assert.equal(p.needsHuman,false);assert.ok(p.healthIssues.length)});
test('waiting, human input, completed historical needs, and registration are independent',()=>{
 assert.equal(presentSession(s('a','coder','waiting_input')).activity,'waiting');
 assert.equal(presentSession(s('a','coder','blocked',{needs:[{text:'Choose',resolver:'human'}]})).needsHuman,true);
 const p=presentSession(s('a','coder','done',{needs:[{text:'old',resolver:'human'}],registered:false}));assert.equal(p.activity,'done');assert.equal(p.needsHuman,false);assert.equal(p.verified,false);
});
