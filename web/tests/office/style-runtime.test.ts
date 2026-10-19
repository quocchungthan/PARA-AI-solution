import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSharedOfficeRuntime as create, reduceSharedOffice as reduce } from '../../src/office/runtime';
import { deriveSharedOfficeModel as model } from '../../src/office/model';
import { getOfficeStyle } from '../../src/office/styles/registry';
import { sharedWorkerPath, pathDuration } from '../../src/office/routes';
import { populated, snapshot } from './fixtures';

test('switch preserves source identity, exact handoffs, selection and path progress in both directions', () => {
  let r=create(model(snapshot()),true,0);
  r=reduce(r,{type:'snapshot',model:model(populated(11)),nowMs:10});
  r=reduce(r,{type:'select',selection:{kind:'session',sessionId:'main'}});
  for (const phase of ['entering','leaving','reporting'] as const) {
    const before={...r,workers:r.workers.map((w,i)=>i===0?{...w,phase,phaseStartedAt:10}:w)};
    const after=reduce(before,{type:'style',styleId:'precinct',nowMs:300});
    assert.equal(after.styleId,'precinct');
    assert.equal(after.model,before.model);assert.equal(after.selection,before.selection);
    assert.equal(after.queue,before.queue);assert.equal(after.online,before.online);
    assert.equal(after.workers.length,10);
    assert.deepEqual(after.workers.map(w=>[w.sessionId,w.identitySeed,w.phase]),before.workers.map(w=>[w.sessionId,w.identitySeed,w.phase]));
    assert.equal(new Set(after.workers.map(w=>w.seatId)).size,10);
    assert.ok(after.workers.every(w=>getOfficeStyle('precinct').layout.seats.some(s=>s.id===w.seatId&&!s.reservedFor)));
    const w=before.workers[0], n=after.workers[0];
    if(phase==='reporting')assert.equal(n.phaseStartedAt,10);
    else {
      const oldD=pathDuration(sharedWorkerPath(getOfficeStyle('botanical').layout,w,before.model,before.workers));
      const newD=pathDuration(sharedWorkerPath(getOfficeStyle('precinct').layout,n,after.model,after.workers));
      assert.ok(Math.abs((300-n.phaseStartedAt)/newD-(300-w.phaseStartedAt)/oldD)<1e-9);
    }
    const back=reduce(after,{type:'style',styleId:'botanical',nowMs:300});
    assert.deepEqual(back.queue,before.queue);
    assert.equal(reduce(after,{type:'style',styleId:'precinct',nowMs:301}),after);
  }
});
test('style cameras restore separately and reject stale updates; overflow protects selection',()=>{
  let r=create(model(populated(12)),true,0);
  const a={position:[1,2,3] as const,target:[0,0,0] as const,zoom:12};
  const b={...a,zoom:25};
  r=reduce(r,{type:'camera',styleId:'botanical',pose:a});
  r=reduce(r,{type:'style',styleId:'precinct',nowMs:1});assert.equal(r.camera,null);
  assert.equal(reduce(r,{type:'camera',styleId:'botanical',pose:b}),r);
  r=reduce(r,{type:'camera',styleId:'precinct',pose:b});
  r=reduce(r,{type:'style',styleId:'botanical',nowMs:2});assert.deepEqual(r.camera,a);
  r=reduce(r,{type:'style',styleId:'precinct',nowMs:3});assert.deepEqual(r.camera,b);
  r=reduce(r,{type:'select',selection:{kind:'session',sessionId:'main'}});
  const hidden=r.model.sessionIds.find(id=>!r.workers.some(w=>w.sessionId===id))!;
  r=reduce(r,{type:'revealWorker',sessionId:hidden,nowMs:4});
  assert.equal(r.workers.length,10);assert.ok(r.workers.some(w=>w.sessionId==='main'));
  assert.ok(r.workers.some(w=>w.sessionId===hidden));
});
