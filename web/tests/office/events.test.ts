import {test} from 'node:test';import assert from 'node:assert/strict';import {collectOfficeEvents} from '../../src/office/events';import {deriveOfficeModel} from '../../src/office/model';import {populated} from './fixtures';
test('observed transitions only: hydrate quiet; result_fed blocked is a report, never done',()=>{
 const a=populated(1),before=deriveOfficeModel(a);assert.deepEqual(collectOfficeEvents(null,before,'main',0),[]);assert.deepEqual(collectOfficeEvents(before,before,'main',1),[]);
 const b=structuredClone(a);b.sessions[1].state='blocked';b.delegations[0].status='result_fed';const events=collectOfficeEvents(before,deriveOfficeModel(b),'main',2);assert.equal(events.length,1);assert.equal(events[0].kind,'report');assert.equal(events[0].originId,'main');
});
