const test=require('node:test');
const assert=require('node:assert/strict');
const {createApp,attachFirestore,clone}=require('./checklist-harness.cjs');
const tick=()=>new Promise(setImmediate);
function existingRecord(){return {items:{rambut:false,nametag:true},note:'lama',savedAt:1};}
function duplicateRecords(){return {'2026-11-04':{1:{items:{custom_a:false,custom_b:false},itemDefinitions:[{id:'custom_a',t:'Kuku',d:'Bersih',rule:'HARUS'},{id:'custom_b',t:'Kuku',d:'Pendek',rule:'HARUS'}],savedAt:1}}};}
test('aturan bawaan tetap mengikuti hari dan jenis kelamin',()=>{
  const a=createApp();assert.equal(a.run("groomingItems('P',3).length"),12);assert.equal(a.run("groomingItems('L',4).length"),11);
  assert.equal(a.run("groomingItems('L',3).find(x=>x.id==='telinga').rule"),'TIDAK BOLEH');
  a.run("ITEM_SETTINGS=normalizeItemSettings([{id:'rambut',aktif:false}]);");
  assert.equal(a.run("allMasterItems().some(x=>x.id==='rambut')"),false);
});
test('riwayat lama memakai item tersimpan meskipun master dihapus / ditambah',async()=>{
  const a=createApp();a.context.record=existingRecord();a.run(`CACHE.records={'2026-11-04':{1:record}};ITEM_SETTINGS=normalizeItemSettings([{id:'rambut',aktif:false},{id:'custom_new',t:'Kuku',d:'Bersih',rule:'HARUS'}]);renderChecklist();`);
  assert.deepEqual(a.json('current'),{rambut:false,nametag:true});await a.run('saveChecklist()');
  assert.deepEqual(a.json("CACHE.records['2026-11-04'][1].items"),{rambut:false,nametag:true});
  assert.equal(a.run("CACHE.records['2026-11-04'][1].itemDefinitions[0].t"),'Rambut / Kepala');
});
test('nama, ketentuan dan pelanggaran historis bertahan setelah rename / hapus',async()=>{
  const a=createApp();a.run("ITEM_SETTINGS=normalizeItemSettings([{id:'custom_a',t:'Kuku',d:'Bersih',rule:'HARUS'}]);renderChecklist();mark('custom_a',false);");await a.run('saveChecklist()');
  a.run("ITEM_SETTINGS=normalizeItemSettings([{id:'custom_a',t:'Nama lain',aktif:false}]);renderChecklist();");
  assert.equal(a.run('current.custom_a'),false);assert.equal(a.run("currentDefinitions.find(x=>x.id==='custom_a').t"),'Kuku');
  assert.equal(a.run("monthData('2026-11')[0].labels.custom_a"),'Kuku');
});
test('status sukses dan cache menunggu konfirmasi server; klik ganda diabaikan',async()=>{
  const a=createApp(),{control,docs}=attachFirestore(a);let release;control.gate=new Promise(r=>release=r);
  a.run('renderChecklist();mark("rambut",false);');const saving=a.run('saveChecklist()');await tick();
  assert.equal(a.element('chkStatusPill').textContent,'Menyimpan...');assert.equal(a.element('btnSaveChecklist').disabled,true);
  assert.deepEqual(a.json('CACHE.records'),{});assert.equal(a.run('messages.length'),0);
  await a.run('saveChecklist()');assert.equal(control.calls,1);a.run('mark("rambut",true);');assert.equal(a.run('current.rambut'),false);
  release();await saving;assert.equal(a.element('btnSaveChecklist').disabled,false);
  assert.match(a.element('chkStatusPill').textContent,/Tersimpan/);assert.equal(docs.get('rec-2026-11-04')['1'].items.rambut,false);
});
test('penolakan Firebase mempertahankan draft tanpa sukses palsu; retry bisa sukses',async()=>{
  const a=createApp(),{control}=attachFirestore(a);control.fail='permission denied';a.run('renderChecklist();mark("rambut",false);');
  await a.run('saveChecklist()');assert.match(a.element('chkStatusPill').textContent,/Gagal disimpan/);
  assert.deepEqual(a.json('CACHE.records'),{});assert.equal(a.run('current.rambut'),false);
  assert.equal(a.run('messages.some(x=>x.type==="ok")'),false);assert.match(a.element('cloudDot').textContent,/gagal menyimpan/);
  control.fail=null;await a.run('saveChecklist()');assert.match(a.element('chkStatusPill').textContent,/Tersimpan/);
});
test('gagal memperbarui riwayat tidak mengubah hasil yang sebelumnya tersimpan',async()=>{
  const a=createApp(),original=existingRecord();a.context.records={'2026-11-04':{1:clone(original)}};a.run('CACHE.records=records;renderChecklist();mark("rambut",true);');
  const {control,docs}=attachFirestore(a,{'rec-2026-11-04':{1:clone(original)}});control.fail='offline';await a.run('saveChecklist()');
  assert.deepEqual(a.json("CACHE.records['2026-11-04'][1]"),original);assert.deepEqual(docs.get('rec-2026-11-04')['1'],original);
});
test('transaksi menyimpan satu karyawan tanpa menghapus pemeriksaan karyawan lain',async()=>{
  const a=createApp(),{docs}=attachFirestore(a,{'rec-2026-11-04':{2:existingRecord()}});a.run('renderChecklist();');await a.run('saveChecklist()');
  assert.deepEqual(docs.get('rec-2026-11-04')['2'],existingRecord());assert.ok(docs.get('rec-2026-11-04')['1']);
});
test('konflik pemeriksaan yang sama ditolak tanpa menimpa data terbaru',async()=>{
  const a=createApp();a.context.original=existingRecord();a.run("CACHE.records={'2026-11-04':{1:original}};renderChecklist();");
  const remote={...existingRecord(),note:'Pembaruan perangkat lain',savedAt:2};const {docs}=attachFirestore(a,{'rec-2026-11-04':{1:remote}});await a.run('saveChecklist()');
  assert.deepEqual(docs.get('rec-2026-11-04')['1'],remote);assert.match(a.json('messages')[0].message,/berubah di perangkat lain/);
});
test('draft pemeriksaan baru dengan master usang ditolak sebelum menulis',async()=>{
  const a=createApp();a.run('renderChecklist();');const {docs}=attachFirestore(a,{'meta-items':{list:[{id:'rambut',aktif:false,revision:1}]}});
  await a.run('saveChecklist()');assert.equal(docs.has('rec-2026-11-04'),false);assert.match(a.json('messages')[0].message,/Item pemeriksaan sudah berubah/);
});
test('hapus pemeriksaan menunggu server dan mempertahankan data karyawan lain',async()=>{
  const a=createApp(),record=existingRecord();a.context.record=record;a.run("CACHE.records={'2026-11-04':{1:record}};renderChecklist();openConfirmModal=async()=>true;");
  const {docs}=attachFirestore(a,{'rec-2026-11-04':{1:record,2:record}});await a.run('deleteChecklist()');
  assert.equal(docs.get('rec-2026-11-04')['1'],undefined);assert.deepEqual(docs.get('rec-2026-11-04')['2'],record);assert.equal(a.run("CACHE.records['2026-11-04']"),undefined);
});
test('gagal hapus pemeriksaan tidak menghilangkan riwayat dari cache',async()=>{
  const a=createApp(),record=existingRecord();a.context.record=record;a.run("CACHE.records={'2026-11-04':{1:record}};renderChecklist();openConfirmModal=async()=>true;");
  const {control}=attachFirestore(a,{'rec-2026-11-04':{1:record}});control.fail='denied';await a.run('deleteChecklist()');assert.deepEqual(a.json("CACHE.records['2026-11-04'][1]"),record);
});
test('ID item berbeda dengan nama sama tetap terpisah pada rekap, dashboard dan Excel',()=>{
  const a=createApp();a.context.records=duplicateRecords();a.run('CACHE.records=records;renderRekap();renderDashboard();');
  assert.equal(a.run("Object.keys(rekapRows('2026-11')[0].perItem).length"),2);assert.equal(a.run("rekapRows('2026-11')[0].viol"),2);
  for(const id of ['rekapTbl','dashByItem']){assert.match(a.element(id).innerHTML,/Kuku — Bersih/);assert.match(a.element(id).innerHTML,/Kuku — Pendek/);}
  a.run(`let exported;XLSX={utils:{book_new:()=>({sheets:[]}),aoa_to_sheet:rows=>({rows}),book_append_sheet:(book,sheet,name)=>book.sheets.push({sheet,name})},writeFile:book=>exported=book};exportExcel();`);
  const sheets=a.json('exported.sheets');assert.match(sheets[0].sheet.rows[6][7],/Kuku — Bersih \(1x\), Kuku — Pendek \(1x\)/);assert.equal(sheets[0].sheet.rows[6][8],40000);
  assert.match(sheets[1].sheet.rows[1][4],/Kuku — Bersih, Kuku — Pendek/);
});
test('dua item identik tetap memiliki pembeda tampilan, nama historis tidak ditimpa',()=>{
  const a=createApp(),records=duplicateRecords();records['2026-11-04'][1].itemDefinitions[1].d='Bersih';a.context.records=records;a.run('CACHE.records=records;renderDashboard();');
  assert.match(a.element('dashByItem').innerHTML,/Item 1/);assert.match(a.element('dashByItem').innerHTML,/Item 2/);
  a.run("CACHE.records['2026-11-05']={1:{items:{custom_a:false},itemDefinitions:[{id:'custom_a',t:'Nama baru',d:'Bersih',rule:'HARUS'}]}};");
  assert.equal(a.run("Object.keys(rekapRows('2026-11')[0].perItem).length"),3);
});
test('nama item yang mengandung markup ditampilkan sebagai teks',()=>{
  const a=createApp();a.context.records=duplicateRecords();a.run("CACHE.records=records;CACHE.records['2026-11-04'][1].itemDefinitions[0].t='<img src=x>';renderChecklist();renderDashboard();renderRekap();");
  for(const id of ['chkItems','dashByItem','rekapTbl']){assert.doesNotMatch(a.element(id).innerHTML,/<img src=x>/);assert.match(a.element(id).innerHTML,/&lt;img src=x&gt;/);}
});
test('semua item dihapus menampilkan penjelasan dan menonaktifkan Simpan / Reset',async()=>{
  const a=createApp();a.run("ITEM_SETTINGS=defaultGroomingItems('P',3).map(x=>({...x,aktif:false}));renderChecklist();");
  assert.match(a.element('chkItems').innerHTML,/Belum ada item pemeriksaan/);for(const id of ['btnSaveChecklist','btnResetChecklist','chkNote'])assert.equal(a.element(id).disabled,true);
  const {control}=attachFirestore(a);await a.run('saveChecklist()');assert.equal(control.calls,0);
  a.run("ITEM_SETTINGS.push({id:'custom_a',t:'Kuku',d:'Bersih',rule:'HARUS',aktif:true});renderChecklist();");assert.equal(a.element('btnSaveChecklist').disabled,false);
});
test('riwayat tersimpan tetap dapat dilihat saat semua master item dihapus',()=>{
  const a=createApp();a.context.record=existingRecord();a.run("CACHE.records={'2026-11-04':{1:record}};ITEM_SETTINGS=defaultGroomingItems('P',3).map(x=>({...x,aktif:false}));renderChecklist();");
  assert.deepEqual(a.json('current'),{rambut:false,nametag:true});assert.equal(a.element('btnSaveChecklist').disabled,false);
});
test('form edit usang tidak dapat mengaktifkan kembali item yang telah dihapus',async()=>{
  const a=createApp();a.run("ITEM_SETTINGS=normalizeItemSettings([{id:'custom_a',t:'Kuku',aktif:true}]);openItemModal('custom_a');");
  const {docs}=attachFirestore(a,{'meta-items':{list:[{id:'custom_a',t:'Kuku',aktif:false,revision:1}]}});await a.run('saveItemForm({preventDefault(){}})');
  assert.equal(docs.get('meta-items').list[0].aktif,false);assert.match(a.element('itemError').textContent,/sudah dihapus/);
});
test('dua editor item yang sama tidak saling menimpa perubahan',async()=>{
  const a=createApp();a.run("ITEM_SETTINGS=normalizeItemSettings([{id:'custom_a',t:'Kuku',aktif:true,revision:1}]);openItemModal('custom_a');");
  const {docs}=attachFirestore(a,{'meta-items':{list:[{id:'custom_a',t:'Nama baru remote',aktif:true,revision:2}]}});await a.run('saveItemForm({preventDefault(){}})');
  assert.equal(docs.get('meta-items').list[0].t,'Nama baru remote');assert.match(a.element('itemError').textContent,/berubah di perangkat lain/);
});
test('hapus item bawaan / custom tersembunyi dan transaksi tidak mengubah riwayat',async()=>{
  const a=createApp();a.context.records=duplicateRecords();a.run("CACHE.records=records;ITEM_SETTINGS=normalizeItemSettings([{id:'custom_a',t:'Kuku',aktif:true}]);openConfirmModal=async()=>true;");
  const {docs}=attachFirestore(a,{'meta-items':{list:[{id:'custom_a',t:'Kuku',aktif:true},{id:'custom_other',t:'Lain',aktif:true}]}});const before=a.json('CACHE.records');
  await a.run("deleteItem('custom_a')");await a.run("deleteItem('rambut')");assert.equal(a.run("allMasterItems().some(x=>['custom_a','rambut'].includes(x.id))"),false);
  assert.deepEqual(a.json('CACHE.records'),before);assert.equal(docs.get('meta-items').list.find(x=>x.id==='custom_other').aktif,true);assert.equal(a.run("monthData('2026-11')[0].labels.custom_a"),'Kuku');
});
test('batal hapus dan kegagalan transaksi tidak mengubah master lokal / server',async()=>{
  const a=createApp(),{control,docs}=attachFirestore(a);a.run("openConfirmModal=async()=>false;");await a.run("deleteItem('rambut')");assert.equal(control.calls,0);
  control.fail='offline';a.run("openConfirmModal=async()=>true;");await a.run("deleteItem('rambut')");assert.deepEqual(a.json('ITEM_SETTINGS'),[]);assert.equal(docs.size,0);
});
test('beralih karyawan saat penyimpanan berjalan tidak menimpa tampilan karyawan baru',async()=>{
  const a=createApp(),{control}=attachFirestore(a);let release;control.gate=new Promise(r=>release=r);a.run('renderChecklist();');const saving=a.run('saveChecklist()');await tick();
  a.element('chkEmp').value='2';a.run('renderChecklist();');release();await saving;assert.equal(a.element('chkTitle').textContent,'Titik Grooming — Test SSC 2');assert.equal(a.element('chkStatusPill').textContent,'Belum disimpan');
});
test('penyimpanan lokal gagal tidak menghasilkan status sukses',async()=>{
  const a=createApp();a.run("renderChecklist();localStorage.setItem=()=>{throw new Error('quota exceeded');};");await a.run('saveChecklist()');assert.deepEqual(a.json('CACHE.records'),{});assert.match(a.element('chkStatusPill').textContent,/Gagal disimpan/);
});
