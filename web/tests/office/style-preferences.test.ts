import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readOfficePreferences as read,writeOfficePreferences as write} from '../../src/office/styles/preferences';
const pose={position:[43,39,51],target:[14,0,9],zoom:12,homeZoom:10,viewportWidth:1200};
const load=(v:unknown)=>read({getItem:()=>JSON.stringify(v)});
test('presentation preferences round trip and serialize only presentation fields',()=>{
  let raw=''; const p=load({version:1,styleId:'precinct',camerasByStyle:{precinct:pose},sessionId:'secret-session'});
  write({setItem:(key,value)=>{assert.equal(key,'para-office-presentation-v1');raw=value;}},p);
  assert.equal(raw.includes('secret-session'),false);
  assert.deepEqual(read({getItem:()=>raw}),p);assert.equal(p.styleId,'precinct');
});
test('invalid preferences and denied storage fall back without throwing',()=>{
  for(const v of [null,{},[],{version:2,styleId:'precinct'},{version:1,styleId:'other'}])assert.deepEqual(load(v),{version:1,styleId:'botanical',camerasByStyle:{}});
  assert.equal(read({getItem:()=>'{oops'}).styleId,'botanical');
  assert.equal(read({getItem:()=>{throw Error('denied');}}).styleId,'botanical');
  assert.doesNotThrow(()=>write({setItem:()=>{throw Error('denied');}},load(null)));
});
test('invalid camera values drop only the affected pose',()=>{
  for(const bad of [{zoom:0},{zoom:-2},{zoom:NaN},{zoom:Infinity},{position:[1,2]},{target:[0,null,0]},
    {homeZoom:0},{homeZoom:Infinity},{viewportWidth:-1},{viewportWidth:NaN}]) {
    const p=load({version:1,styleId:'precinct',camerasByStyle:{botanical:pose,precinct:{...pose,...bad}}});
    assert.equal(p.styleId,'precinct');assert.equal(p.camerasByStyle.precinct,undefined);
    assert.deepEqual(p.camerasByStyle.botanical,pose);
  }
});
