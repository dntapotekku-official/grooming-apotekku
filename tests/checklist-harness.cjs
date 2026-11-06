const fs=require('node:fs');
const vm=require('node:vm');
const clone=value=>value===undefined?undefined:JSON.parse(JSON.stringify(value));
function createApp(){
  const elements=new Map(),storage=new Map();
  function element(id){
    if(!elements.has(id)){
      const buttons=[{},{ }];
      elements.set(id,{value:'',textContent:'',innerHTML:'',disabled:false,style:{},classList:{add(){},remove(){}},setAttribute(){},focus(){},querySelectorAll:()=>buttons});
    }
    return elements.get(id);
  }
  const context=vm.createContext({console,Date,crypto:require('node:crypto').webcrypto,
    window:{},localStorage:{setItem(k,v){storage.set(k,v);},removeItem(k){storage.delete(k);},getItem(k){return storage.get(k)||null;}},
    document:{getElementById:element,addEventListener(){},querySelectorAll(){return [];},querySelector(){return null;}},setTimeout(){}});
  const source=fs.readFileSync('public/index.html','utf8').match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInContext(source.slice(0,source.indexOf('(async function init(){')),context);
  const run=code=>vm.runInContext(code,context);
  run(`EMPLOYEES=[{no:1,nama:'Test SSC',gender:'P',divisi:'SSC',jabatan:'Staf',status:'TETAP',aktif:true},{no:2,nama:'Test SSC 2',gender:'L',divisi:'SSC',jabatan:'Staf',aktif:true}];
    CACHE.auditor='test'; let messages=[]; toast=(message,type)=>messages.push({message,type});`);
  element('chkEmp').value='1';element('chkDate').value='2026-11-04';
  for(const id of ['dashMonth','rekapMonth'])element(id).value='2026-11';
  return {run,element,context,storage,json:code=>JSON.parse(run(`JSON.stringify(${code})`))};
}
function attachFirestore(app,initial={}){
  const docs=new Map(Object.entries(clone(initial)));
  const control={fail:null,gate:null,writes:[],calls:0};
  let queue=Promise.resolve();
  const db={collection:collection=>({doc:id=>({collection,id})}),runTransaction:callback=>{
    control.calls++;
    const task=queue.then(async()=>{
      if(control.fail)throw new Error(control.fail);
      const writes=[];
      const result=await callback({get:async ref=>({data:()=>clone(docs.get(ref.id))}),set:(ref,value)=>writes.push({id:ref.id,value:clone(value)}),delete:ref=>writes.push({id:ref.id,remove:true})});
      if(control.gate)await control.gate;
      if(control.fail)throw new Error(control.fail);
      for(const write of writes){if(write.remove)docs.delete(write.id);else docs.set(write.id,write.value);control.writes.push(write);}
      return result;
    });
    queue=task.catch(()=>{});
    return task;
  }};
  app.context.mockDB=db;
  app.run('FB=mockDB; firebase={firestore:{FieldValue:{serverTimestamp:()=>123}}};');
  return {docs,control};
}
module.exports={createApp,attachFirestore,clone};
