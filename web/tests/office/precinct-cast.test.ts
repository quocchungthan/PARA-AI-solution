import {test} from 'node:test';
import assert from 'node:assert/strict';
import {precinctAppearance,buildPrecinctCharacter} from '../../src/office/styles/precinct/cast';
import type {OfficeRole} from '../../src/office/types';
test('permanent role representatives use recognizable approved cast and distinct silhouettes',()=>{
  const pairs:[OfficeRole,string][]=[['coordinator','Amy'],['coder','Jake'],['reviewer','Rosa'],['functional-reviewer','Boyle'],['scrum-master','Terry'],['hr','Gina'],['researcher','Kevin']];
  const silhouettes=new Set<string>();
  for(const [role,name] of pairs){
    const a=precinctAppearance(role==='coordinator'?'assistant':'lead',role,'lead-'+role);
    assert.equal(a.castId,name);
    const rig=buildPrecinctCharacter(a,'seated');assert.equal(rig.length,6);
    silhouettes.add(JSON.stringify(rig));
  }
  assert.equal(silhouettes.size,7);
  const holt=precinctAppearance('human','coordinator','human');assert.equal(holt.castId,'Holt');assert.equal(holt.hairStyle,'bald');assert.equal(holt.tie,true);
  const terry=precinctAppearance('lead','scrum-master','lead-scrum-master');assert.equal(terry.build,'broad');assert.equal(terry.suspenders,true);
  assert.equal(precinctAppearance('lead','researcher','researcher').glasses,true);
});
test('supporting cast is deterministic and articulated rigs keep finite parts in each pose',()=>{
  const a=precinctAppearance('worker','coder','worker-0');assert.deepEqual(a,precinctAppearance('worker','coder','worker-0'));
  assert.notEqual(a.castId,'Jake');
  for(const pose of ['seated','standing'] as const)for(const part of buildPrecinctCharacter(a,pose)) {
    assert.ok(part.voxels.length>0);
    for(const v of part.voxels)assert.ok([...v.position,...v.size].every(Number.isFinite));
  }
});
