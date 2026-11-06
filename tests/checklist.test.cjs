const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const html = fs.readFileSync('public/index.html', 'utf8');
const source = html.match(/<script>([\s\S]*?)<\/script>/)[1];
const elements = new Map();
function element(id) {
  if (!elements.has(id)) elements.set(id, {value:'',style:{},classList:{add(){},remove(){}},setAttribute(){},focus(){}});
  return elements.get(id);
}
const context = vm.createContext({
  console, Date, crypto:require('node:crypto').webcrypto,
  window:{},localStorage:{setItem(){},removeItem(){},getItem(){return null;}},
  document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];},querySelector(){return null;}},
  setTimeout(){},
});
// Test application functions without starting network/login initialization.
vm.runInContext(source.slice(0,source.indexOf('(async function init(){')),context);
const run = code => vm.runInContext(code,context);
run(`EMPLOYEES=[{no:1,nama:'Test SSC',gender:'P',aktif:true}]; CACHE.auditor='test';`);
element('chkEmp').value='1';
element('chkDate').value='2026-11-04';
assert.equal(run("groomingItems('P',3).length"),12);
assert.equal(run("groomingItems('L',4).length"),11);
run(`CACHE.records={'2026-11-04':{1:{items:{rambut:false,nametag:true},note:'lama',savedAt:1}}};
ITEM_SETTINGS=normalizeItemSettings([{id:'rambut',t:'Nama Baru',aktif:false},{id:'custom_test',t:'Kuku',d:'Bersih',rule:'HARUS',aktif:true}]);`);
const before=run('JSON.stringify(CACHE.records)');
run('renderChecklist()');
assert.equal(run('JSON.stringify(Object.keys(current))'),'["rambut","nametag"]');
assert.equal(run('current.rambut'),false);
assert.equal(run('currentDefinitions[0].t'),'Rambut / Kepala');
assert.equal(element('sumNo').textContent,1);
assert.equal(run('JSON.stringify(CACHE.records)'),before);
assert.equal(run("groomingItems('P',3).some(x=>x.id==='custom_test')"),true);
assert.equal(run("groomingItems('P',3).some(x=>x.id==='rambut')"),false);
// Saving an existing legacy checklist retains precisely its saved items.
run('saveChecklist()');
assert.equal(run('JSON.stringify(Object.keys(CACHE.records["2026-11-04"][1].items))'),'["rambut","nametag"]');
// New records snapshot definitions; later rename/deactivation leaves historical labels intact.
element('chkDate').value='2026-11-05';
run("renderChecklist(); mark = function(id,val){current[id]=val;}; mark('custom_test',false); saveChecklist();");
assert.equal(run('CACHE.records["2026-11-05"][1].itemDefinitions.find(x=>x.id==="custom_test").t'),'Kuku');
run("ITEM_SETTINGS=normalizeItemSettings([{id:'custom_test',t:'Nama Lain',aktif:false}]); renderChecklist();");
assert.equal(run('current.custom_test'),false);
assert.equal(run('currentDefinitions.find(x=>x.id==="custom_test").t'),'Kuku');
assert.equal(run("monthData('2026-11')[1].labels.custom_test"),'Kuku');
assert.equal(run("rekapRows('2026-11')[0].viol"),2);
assert.equal(run("rekapRows('2026-11')[0].perItem.Kuku"),1);
// Toggling an unmodified built-in retains its name and gender/day rules.
run("ITEM_SETTINGS=normalizeItemSettings([{id:'rambut',aktif:false}]);");
assert.equal(run("allMasterItems().find(x=>x.id==='rambut').t"),'Rambut / Kepala');
run("ITEM_SETTINGS=normalizeItemSettings([{id:'rambut',aktif:true}]);");
assert.match(run("groomingItems('L',4).find(x=>x.id==='rambut').d"),/telinga terlihat/);
run("showSettings('items');");
assert.equal(element('settings-employees').hidden,true);
assert.equal(element('settings-items').hidden,false);
// Transaction writes go only to master data; existing records are untouched.
(async()=>{
  const before=run('JSON.stringify(CACHE.records)');
  run(`let masterDoc={list:[{id:'custom_other',t:'Item perangkat lain',d:'',rule:'HARUS',aktif:true}]};
    let writePath='';
    firebase={firestore:{FieldValue:{serverTimestamp:()=>1}}};
    FB={collection:()=>({doc:id=>{writePath=id;return {get:async()=>({data:()=>masterDoc})};}}),
      runTransaction:async fn=>fn({get:async()=>({data:()=>masterDoc}),set:(ref,value)=>{masterDoc=value;}})};`);
  await run("writeItemSetting({id:'custom_test',t:'Kuku',d:'Bersih',rule:'HARUS',aktif:true})");
  assert.equal(run('writePath'),'meta-items');
  assert.equal(run('masterDoc.list.length'),2);
  assert.equal(run('JSON.stringify(CACHE.records)'),before);
  const masterBefore=run('JSON.stringify(ITEM_SETTINGS)');
  run("FB.runTransaction=async()=>{throw new Error('offline');};");
  await assert.rejects(run("writeItemSetting({id:'custom_test',aktif:false})"),/offline/);
  assert.equal(run('JSON.stringify(ITEM_SETTINGS)'),masterBefore);
  assert.equal(run('JSON.stringify(CACHE.records)'),before);
  console.log('Passed: settings navigation, daily rules, legacy records, historical snapshots, totals, and isolated master transactions.');
})().catch(error=>{console.error(error);process.exitCode=1;});
