import {test} from 'node:test';
import assert from 'node:assert/strict';
import {planAmbientVisit,retainAmbientVisit} from '../../src/office/scene/ambient';
import {getOfficeStyle} from '../../src/office/styles/registry';
import {samplePath} from '../../src/office/scene/motion';
const l=getOfficeStyle('precinct').layout;
const actor={id:'lead-coder',position:l.leads.coder,kind:'lead' as const,status:'idle',health:false,selected:false};
const policy={online:true,reducedMotion:false,busy:false};
test('ambient visits have safe outward approach, bounded dwell and exact home return',()=>{
  const v=planAmbientVisit(l,actor,1000,17,policy)!;
  assert.equal(v.actorId,actor.id);assert.equal(v.startedAt,1000);
  assert.deepEqual(v.outward[0],actor.position);assert.deepEqual(v.returning.at(-1),actor.position);
  assert.ok(v.returnAt-v.dwellAt>=3000&&v.returnAt-v.dwellAt<=5000);
  const rest=l.restSeats.find(s=>s.id===v.restSeatId)!;assert.deepEqual(v.outward.at(-2),rest.approach);assert.deepEqual(v.returning[1],rest.approach);
  assert.deepEqual(samplePath(v.returning,v.endsAt-v.returnAt,2.2).position,actor.position);
  assert.deepEqual(planAmbientVisit(l,actor,1000,17,policy),v);
});
test('coffee visits approach the kitchenette cafe from its open aisle',()=>{
  const visit=planAmbientVisit(l,actor,0,2,policy)!;
  assert.deepEqual(visit.outward.at(-1),[2.8,0,4.25]);
  assert.deepEqual(visit.outward.at(-2),[2,0,4.25]);
  assert.deepEqual(visit.returning.at(-1),actor.position);
});
test('real activity, selection, health, disconnect and reduced motion veto and cancel optional visits',()=>{
  const v=planAmbientVisit(l,actor,0,3,policy)!;
  for(const status of ['working','needs-human','blocked','pending'])assert.equal(planAmbientVisit(l,{...actor,status},0,3,policy),null);
  for(const changed of [{...actor,selected:true},{...actor,health:true},{...actor,kind:'human' as const}])assert.equal(planAmbientVisit(l,changed,0,3,policy),null);
  for(const p of [{...policy,online:false},{...policy,reducedMotion:true},{...policy,busy:true}]) {
    assert.equal(planAmbientVisit(l,actor,0,3,p),null);assert.equal(retainAmbientVisit(l,v,[actor],1,p),null);
  }
  assert.equal(retainAmbientVisit(l,v,[],1,policy),null);
  assert.equal(retainAmbientVisit(l,v,[{...actor,selected:true}],1,policy),null);
  assert.equal(retainAmbientVisit(getOfficeStyle('botanical').layout,v,[actor],1,policy),null);
  assert.equal(retainAmbientVisit(l,v,[actor],v.endsAt,policy),null);
  assert.equal(retainAmbientVisit(l,v,[actor],1,policy),v);
  assert.equal(planAmbientVisit(l,actor,0,3,{...policy,busy:true}),null,'an active excursion owns the optional motion budget');
});
