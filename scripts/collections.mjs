#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {getDb,REPO_ROOT} from './lib/db.mjs';
import {table} from './lib/format.mjs';
import {parseCsv,pick} from './lib/csv.mjs';
import {entities} from './lib/entities.mjs';

export const reads={
 objects:'select code,name,classification,location,grade,inventory_checked_on from v_catalogue order by code',
 people:'select code,name,organisation from people order by code',
 locations:'select l.code,l.name,l.kind,count(o.id)::int as objects from locations l left join objects o on o.current_location_id=l.id group by l.id order by l.code',
 accessions:'select a.code,a.name,a.received_on,a.decision,a.title_evidence,p.name as source from accessions a left join people p on p.id=a.source_id order by a.received_on',
 loans:'select code,name,borrower,status,due_on,objects from v_loans order by due_on',
 conditions:'select c.code,o.code as object,c.grade,c.checked_on,c.checked_by,c.next_review,c.findings from conditions c join objects o on o.id=c.object_id order by checked_on desc,c.code',
 exhibitions:'select e.code,e.name,e.starts_on,e.ends_on,l.name as location from exhibitions e join locations l on l.id=e.location_id order by starts_on',
 movements:'select o.code,m.moved_at,f.name as from_location,t.name as to_location,m.moved_by,m.authorised_by,m.reason from movements m join objects o on o.id=m.object_id left join locations f on f.id=m.from_location_id join locations t on t.id=m.to_location_id order by moved_at desc,m.id',
 'accession-backlog':"select code,name,received_on,current_date-received_on as days_waiting from accessions where decision='pending' order by received_on",
 'loans-due':"select code,name,borrower,due_on,days_overdue from v_loans where status='active' and due_on<=current_date+30 order by due_on",
 'condition-review':"select code,name,location,grade,next_review from v_catalogue where grade is null or grade in ('poor','urgent') or next_review<=current_date+30 order by code",
 'inventory-gaps':"select code,name,location,inventory_checked_on from v_catalogue where inventory_checked_on is null or inventory_checked_on<current_date-365 order by code",
 'exhibition-readiness':'select * from v_exhibition_readiness order by exhibition,code',
 'rights-review':"select code,name,rights_note,restricted from objects where nullif(btrim(rights_note),'') is null order by code",
 'provenance-gaps':"select o.code,o.name,a.decision,o.provenance from objects o left join accessions a on a.id=o.accession_id where nullif(btrim(o.provenance),'') is null or a.decision is distinct from 'accepted' order by o.code",
 'loan-condition':"select l.code as loan,o.code,o.name,c.grade,c.next_review,l.due_on from loans l join loan_items li on li.loan_id=l.id join objects o on o.id=li.object_id join v_catalogue c on c.id=o.id where l.status<>'returned' and (c.grade is null or c.grade in ('poor','urgent') or c.next_review<l.due_on) order by l.code,o.code",
 'location-load':'select l.code,l.name,count(o.id)::int as objects,count(o.id) filter(where c.grade in (\'poor\',\'urgent\'))::int as condition_concerns from locations l left join objects o on o.current_location_id=l.id left join v_catalogue c on c.id=o.id group by l.id order by l.code',
 'unlocated':"select code,name from objects where current_location_id is null order by code",
 'export-review':"select l.code as loan,o.code,o.name,l.source_country,l.destination_country,li.export_decision,li.reviewed_by,li.permit_ref from loans l join loan_items li on li.loan_id=l.id join objects o on o.id=li.object_id where l.source_country<>l.destination_country and l.status<>'returned' order by l.code,o.code",
 'maker-care':"select coalesce(o.maker,'Unrecorded') as maker,count(*)::int as objects,count(*) filter(where c.grade is null or c.grade in ('poor','urgent'))::int as condition_concerns from objects o join v_catalogue c on c.id=o.id group by o.maker order by maker",
 attention:'select * from v_attention order by rule,code'
};
const refs={source_id:'people',accession_id:'accessions',normal_location_id:'locations',current_location_id:'locations',object_id:'objects',borrower_id:'people',destination_id:'locations',loan_id:'loans',from_location_id:'locations',to_location_id:'locations',location_id:'locations',exhibition_id:'exhibitions'};
const locked=['movements','conditions','notes'];
function entity(t){if(!entities[t])throw Error('Unknown record type: '+t);return entities[t];}
function required(value,label){if(typeof value!=='string'||!value.trim())throw Error(label+' must not be blank');return value;}
function date(value,label){if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value))||new Date(value).toISOString().slice(0,10)!==value)throw Error(label+' must be a real YYYY-MM-DD date');return value;}
export async function resolve(db,t,term){
 entity(t);required(term,'Record reference');
 let rows=await db.query(`select * from ${t} where lower(code)=lower($1) or lower(name)=lower($1) or id::text=$1`,[term]);
 if(!rows.length)rows=await db.query(`select * from ${t} where starts_with(id::text,lower($1)) or strpos(lower(name),lower($1))>0 or strpos(lower(code),lower($1))>0 order by code`,[term]);
 if(rows.length!==1)throw Error((rows.length?'Ambiguous':'No')+` ${t} match for "${term}"`+(rows.length?'\n'+rows.map(r=>`${r.code} | ${r.name} | ${r.id}`).join('\n'):''));
 return rows[0];
}
export async function transaction(db,fn,dry=false){await db.exec('BEGIN');try{const result=await fn();await db.exec(dry?'ROLLBACK':'COMMIT');return result;}catch(e){await db.exec('ROLLBACK');throw e;}}
export async function save(db,t,data,term=null,{internal=false}={}){
 const allowed=entity(t);if(!data||typeof data!=='object'||Array.isArray(data)||!Object.keys(data).length)throw Error('Data must be a nonempty object');
 if(!internal&&t==='movements')throw Error('Use move, checkout or return-loan to preserve location history');
 if(term&&locked.includes(t))throw Error('History is append-only; add a correction note');
 const old=term?await resolve(db,t,term):null;
 if(old&&data.code&&data.code!==old.code)throw Error('Code is immutable');
 if(!internal&&t==='objects'&&old&&Object.hasOwn(data,'current_location_id'))throw Error('Use move to update current location');
 if(!internal&&t==='loans'&&(Object.hasOwn(data,'status')||Object.hasOwn(data,'returned_on')))throw Error('Use checkout or return-loan for loan status');
 if(!internal&&t==='loans'&&old&&old.status!=='planned')throw Error('Only planned loans may be edited');
 const values={};
 for(const [key,value] of Object.entries(data)){
  if(!allowed.includes(key))throw Error(`Unknown ${t} field: ${key}`);
  if(value===null){values[key]=null;continue;}
  if(refs[key]){values[key]=(await resolve(db,refs[key],value)).id;continue;}
  if(key==='restricted'){if(typeof value!=='boolean')throw Error('restricted must be boolean');}
  else if(key==='source_record'){if(!internal)throw Error('source_record is import-owned');}
  else if(typeof value!=='string')throw Error(key+' must be text');
  else if(key.endsWith('_on')||['next_review','insurance_until'].includes(key))date(value,key);
  else if(['code','name','checked_by','author','body','findings'].includes(key))required(value,key);
  values[key]=value;
 }
 if(!internal&&t==='loan_items'){
  if(old&&(values.loan_id||values.object_id))throw Error('Loan item links are immutable');
  const loan=await resolve(db,'loans',values.loan_id||old?.loan_id||'');if(loan.status!=='planned')throw Error('Only planned loan items may be edited');
 }
 if(t==='objects'&&old&&(Object.hasOwn(values,'source_record')||Object.hasOwn(values,'vernon_id'))&&!internal)throw Error('Import identity is immutable');
 if(!old){required(values.code,'code');required(values.name,'name');}
 const keys=Object.keys(values),params=Object.values(values);
 if(old){params.push(old.id);return (await db.query(`update ${t} set ${keys.map((k,i)=>`${k}=$${i+1}`).join(',')} where id=$${params.length} returning *`,params))[0];}
 return (await db.query(`insert into ${t} (${keys.join(',')}) values (${keys.map((_,i)=>'$'+(i+1)).join(',')}) returning *`,params))[0];
}
export async function compliance(db){
 const rows=(await db.query('select * from v_attention order by rule,code')).map(r=>({...r,source:r.rule==='LOCATION'?'SPECTRUM-LOCATION':r.rule==='TITLE'?'LOCAL-TITLE':'LOCAL-POLICY'}));
 const loans=await db.query("select * from loans where status<>'returned' order by code");
 for(const l of loans){
  const items=await db.query('select li.*,o.code as object_code from loan_items li join objects o on o.id=li.object_id where loan_id=$1',[l.id]);
  const add=(rule,issue,source)=>rows.push({rule,code:l.code,name:l.name,issue,source});
  if(!l.agreement_ref?.trim())add('AGREEMENT','Signed loan agreement reference missing','LOCAL-LOAN');
  if(!l.insurance_until||l.insurance_until<l.due_on||l.insurance_until<new Date().toISOString().slice(0,10))add('INSURANCE','Recorded insurance cover absent or ends before the loan or today','SPECTRUM-LOCATION');
  if(!items.length)add('EMPTY-LOAN','No objects attached','LOCAL-LOAN');
  if(l.source_country!==l.destination_country)for(const item of items){
   if(item.export_decision==='unknown'||!item.reviewed_by?.trim()||(item.export_decision==='required'&&!item.permit_ref?.trim()))add('EXPORT',`${item.object_code}: export assessment or permission evidence incomplete`,l.source_country==='NZ'?'NZ-PROTECTED-OBJECTS':'LOCAL-EXPORT');
  }
 }
 return rows;
}
async function moveWithin(db,object,to,by,authoriser,reason,loan=null){
 required(by,'moved_by');required(authoriser,'authorised_by');required(reason,'reason');
 const o=await resolve(db,'objects',object),loc=await resolve(db,'locations',to);
 await db.query('select id from objects where id=$1 for update',[o.id]);
 const current=(await db.query('select * from objects where id=$1',[o.id]))[0];
 if(current.current_location_id===loc.id)throw Error('Object is already at that location');
 const movement=await save(db,'movements',{code:randomUUID(),name:`Move ${o.code}`,object_id:o.id,from_location_id:current.current_location_id,to_location_id:loc.id,moved_by:by,authorised_by:authoriser,reason,loan_id:loan},null,{internal:true});
 await db.query('update objects set current_location_id=$1 where id=$2',[loc.id,o.id]);return movement;
}
export async function move(db,object,to,by,authoriser,reason){return transaction(db,async()=>{
 const o=await resolve(db,'objects',object);await db.query('select id from objects where id=$1 for update',[o.id]);
 const active=await db.query("select l.code from loans l join loan_items li on li.loan_id=l.id where li.object_id=$1 and l.status='active'",[o.id]);
 if(active.length)throw Error('Object is on an active loan; use return-loan');
 return moveWithin(db,object,to,by,authoriser,reason);
});}
export async function checkout(db,term,by,authoriser){return transaction(db,async()=>{
 const l=await resolve(db,'loans',term);await db.query('select id from loans where id=$1 for update',[l.id]);
 const fresh=await resolve(db,'loans',l.id);if(fresh.status!=='planned')throw Error('Loan must be planned');
 const today=new Date().toISOString().slice(0,10);if(today<l.starts_on||today>l.due_on)throw Error('Checkout must fall within loan dates');
 if((await compliance(db)).some(r=>r.code===l.code))throw Error('Resolve loan evidence checks before checkout');
 const items=await db.query('select o.* from objects o join loan_items li on li.object_id=o.id where li.loan_id=$1 order by o.id',[l.id]);
 for(const o of items){
  await db.query('select id from objects where id=$1 for update',[o.id]);
  if(!o.normal_location_id||!o.current_location_id)throw Error('Object locations must be recorded');
  if((await db.query("select l.id from loans l join loan_items li on li.loan_id=l.id where li.object_id=$1 and l.status='active'",[o.id])).length)throw Error('Object already on an active loan');
  const c=(await db.query('select * from v_catalogue where id=$1',[o.id]))[0];
  if(!c.grade||['poor','urgent'].includes(c.grade)||!c.next_review||c.next_review<l.due_on)throw Error('Condition evidence must cover the loan');
  if(c.accession_decision!=='accepted')throw Error('Acquisition must be accepted before outward loan');
  await moveWithin(db,o.id,l.destination_id,by,authoriser,`Loan ${l.code}`,l.id);
 }
 await db.query("update loans set status='active' where id=$1",[l.id]);return [{loan:l.code,status:'active',objects:items.length}];
});}
export async function returnLoan(db,term,by,authoriser){return transaction(db,async()=>{
 const l=await resolve(db,'loans',term);await db.query('select id from loans where id=$1 for update',[l.id]);
 if((await resolve(db,'loans',l.id)).status!=='active')throw Error('Loan must be active');
 const items=await db.query('select o.* from objects o join loan_items li on li.object_id=o.id where li.loan_id=$1 order by o.id',[l.id]);
 for(const o of items){if(!o.normal_location_id)throw Error('Normal location required before return');await moveWithin(db,o.id,o.normal_location_id,by,authoriser,`Return ${l.code}`,l.id);}
 await db.query("update loans set status='returned',returned_on=current_date where id=$1",[l.id]);return [{loan:l.code,status:'returned',objects:items.length}];
});}
const importHeaders={code:['Accession Number'],name:['Object Name','Name/Title','Title','Name'],vernon_id:['System ID','System Id'],description:['Description'],maker:['Artist/Maker','Maker'],classification:['Classification'],current_location_id:['Current Location'],normal_location_id:['Normal Location'],provenance:['Provenance'],rights_note:['Rights Notes'],image_ref:['Image Reference']};
export async function importCsv(db,file,{dryRun=false,map={}}={}){
 const rows=parseCsv(fs.readFileSync(file,'utf8'));if(!rows.length)throw Error('No object rows');
 if(typeof map==='string')map=JSON.parse(fs.readFileSync(map,'utf8'));
 if(!map||Array.isArray(map)||typeof map!=='object')throw Error('Map must be an object');
 for(const [k,v] of Object.entries(map))if(!importHeaders[k]||typeof v!=='string'||!Object.keys(rows[0]).includes(v))throw Error('Unknown mapping field or missing column: '+k);
 return transaction(db,async()=>{
  await db.exec('LOCK TABLE objects, locations IN SHARE ROW EXCLUSIVE MODE');
  let inserted=0,unchanged=0;const seen=new Set(),seenIds=new Set();
  for(const row of rows){
   const data={};for(const [k,headers] of Object.entries(importHeaders))data[k]=pick(row,...(map[k]?[map[k]]:headers))||null;
   required(data.code,'Accession Number');required(data.name,'Object Name or Title');
   if(seen.has(data.code.toLowerCase()))throw Error('Duplicate accession number in import');seen.add(data.code.toLowerCase());
   if(data.vernon_id){if(seenIds.has(data.vernon_id))throw Error('Duplicate System ID');seenIds.add(data.vernon_id);}
   const old=await db.query('select * from objects where lower(code)=lower($1) or (vernon_id is not null and vernon_id=$2)',[data.code,data.vernon_id]);
   if(old.length){if(old.length!==1||old[0].code!==data.code||JSON.stringify(canonical(old[0].source_record))!==JSON.stringify(canonical(row)))throw Error(`Existing object differs: ${data.code}; reconcile deliberately`);unchanged++;continue;}
   for(const key of ['current_location_id','normal_location_id'])if(data[key]){
    const label=data[key];const matches=await db.query('select * from locations where lower(name)=lower($1)',[label]);
    if(matches.length>1)throw Error('Ambiguous imported location: '+label);
    data[key]=matches[0]?.id||(await save(db,'locations',{code:'IMPORT-'+randomUUID(),name:label,kind:'store',suitability_notes:'Imported label; verify kind and suitability'})).id;
   }
   await save(db,'objects',{...data,restricted:true,source_record:row},null,{internal:true});inserted++;
  }
  return [{rows:rows.length,inserted,unchanged,dry_run:dryRun}];
 },dryRun);
}
function canonical(v){return v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,v[k]])):v;}
const options={add:['data'],update:['data'],move:['by','authoriser','reason'],checkout:['by','authoriser'],'return-loan':['by','authoriser'],log:['by','text'],inventory:['by','date'],import:['file','map','dry-run'],export:['file'],'draft-loan':['file'],'draft-weekly':['file']};
export async function run(db,args){
 const pos=[],opt={};for(const a of args){if(a.startsWith('--')){const [k,...v]=a.slice(2).split('=');if(Object.hasOwn(opt,k))throw Error('Duplicate option: '+k);opt[k]=v.length?v.join('='):true;}else pos.push(a);}
 const [cmd='help',...rest]=pos;for(const k of Object.keys(opt))if(!['json',...(options[cmd]||[])].includes(k))throw Error('Unknown option: --'+k);
 const arity=n=>{if(rest.length!==n)throw Error(`${cmd} expects ${n} argument(s)`);};
 const need=k=>required(opt[k],'--'+k);
 if(reads[cmd]){arity(0);return db.query(reads[cmd]);}
 if(cmd==='help'){arity(0);return [{reads:Object.keys(reads).join(', '),actions:'object REF; add TYPE --data=FILE; update TYPE REF --data=FILE; move OBJECT LOCATION --by=NAME --authoriser=NAME --reason=TEXT; checkout LOAN --by=NAME --authoriser=NAME; return-loan LOAN --by=NAME --authoriser=NAME; inventory OBJECT --by=NAME --date=YYYY-MM-DD; log OBJECT --by=NAME --text=TEXT; compliance; weekly-review; import vernon --file=FILE [--dry-run] [--map=FILE]; export --file=FILE; draft-loan LOAN; draft-weekly'}];}
 if(cmd==='compliance'){arity(0);return compliance(db);}
 if(cmd==='weekly-review'){arity(0);return {loans:await db.query(reads['loans-due']),care:await db.query(reads['condition-review']),evidence:await compliance(db)};}
 if(cmd==='object'){arity(1);const o=await resolve(db,'objects',rest[0]);return {object:o,conditions:await db.query('select * from conditions where object_id=$1 order by checked_on desc',[o.id]),movements:await db.query('select * from movements where object_id=$1 order by moved_at',[o.id]),notes:await db.query('select * from notes where object_id=$1 order by created_at',[o.id])};}
 if(['add','update'].includes(cmd)){arity(cmd==='add'?1:2);return [await save(db,rest[0],JSON.parse(fs.readFileSync(need('data'),'utf8')),rest[1])];}
 if(cmd==='move'){arity(2);return [await move(db,...rest,need('by'),need('authoriser'),need('reason'))];}
 if(cmd==='checkout'||cmd==='return-loan'){arity(1);return (cmd==='checkout'?checkout:returnLoan)(db,rest[0],need('by'),need('authoriser'));}
 if(cmd==='inventory'){arity(1);const day=date(need('date'),'date');if(day>new Date().toISOString().slice(0,10))throw Error('Inventory observation cannot be in the future');return [await save(db,'objects',{inventory_checked_on:day,inventory_checked_by:need('by')},rest[0])];}
 if(cmd==='log'){arity(1);return [await save(db,'notes',{code:randomUUID(),name:'Registrar note',object_id:rest[0],author:need('by'),body:need('text')})];}
 if(cmd==='import'){arity(1);if(rest[0]!=='vernon')throw Error('Supported import: vernon');if(opt['dry-run']!==undefined&&opt['dry-run']!==true)throw Error('--dry-run takes no value');return importCsv(db,need('file'),{dryRun:!!opt['dry-run'],map:opt.map||{}});}
 if(cmd==='export'){arity(0);const snapshot=await transaction(db,async()=>{await db.exec('SET TRANSACTION ISOLATION LEVEL REPEATABLE READ');const records={};for(const t of Object.keys(entities))records[t]=await db.query(`select * from ${t} order by code`);return {format:'collections-v1',exported_at:new Date().toISOString(),records};});const f=path.resolve(need('file'));fs.mkdirSync(path.dirname(f),{recursive:true});fs.writeFileSync(f,JSON.stringify(snapshot,null,2),{flag:'wx'});return [{file:f,record_types:Object.keys(entities).length}];}
 if(cmd==='draft-loan'||cmd==='draft-weekly'){
  arity(cmd==='draft-loan'?1:0);let data;
  if(cmd==='draft-loan'){const loan=await resolve(db,'loans',rest[0]);data={loan,objects:await db.query('select o.code,o.name,li.export_decision,li.permit_ref from loan_items li join objects o on o.id=li.object_id where loan_id=$1',[loan.id]),checks:(await compliance(db)).filter(x=>x.code===loan.code)};}
  else data=await run(db,['weekly-review']);
  const dir=path.resolve(process.env.OUTPUT_DIR||REPO_ROOT,'drafts');fs.mkdirSync(dir,{recursive:true});const name=opt.file||`${cmd}-${randomUUID()}.md`;if(path.basename(name)!==name||!name.endsWith('.md'))throw Error('Draft name must be a .md basename');
  const f=path.join(dir,name);fs.writeFileSync(f,`# DRAFT: ${cmd==='draft-loan'?'Loan schedule for registrar review':'Weekly collections review'}\n\nVerify the records and attach approved agreement terms. No message has been sent.\n\n${JSON.stringify(data,null,2)}\n`,{flag:'wx'});return [{draft:f}];
 }
 throw Error('Unknown command: '+cmd);
}
export function human(result){if(Array.isArray(result)){if(!result.length)return '(none)';return table(result,Object.keys(result[0]).map(key=>({key,label:key.replaceAll('_',' '),format:v=>v instanceof Date?v.toISOString():v&&typeof v==='object'?JSON.stringify(v):v,width:70})));}return Object.entries(result).map(([k,v])=>k.toUpperCase()+'\n'+human(Array.isArray(v)?v:[v])).join('\n\n');}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){let db;try{db=await getDb();const out=await run(db,process.argv.slice(2));console.log(process.argv.includes('--json')?JSON.stringify(out,null,2):human(out));}catch(e){console.error(e.message);process.exitCode=1;}finally{if(db)await db.close();}}
