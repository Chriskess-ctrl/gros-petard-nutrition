// Modèle local, calculs et validation. Aucun appel réseau ni objectif imposé.
export const VERSION = '2.0.0';
export const SCHEMA = 2;
export const MACROS = ['k', 'p', 'c', 'f'];
export const BODY_FIELDS = { weight: 'Poids', waist: 'Taille', hips: 'Hanches', glutes: 'Fessiers', thigh: 'Cuisse', chest: 'Poitrine', arm: 'Bras' };
export const MEASUREMENT_UNIT = key => key === 'weight' ? 'kg' : 'cm';
export const uid = () => globalThis.crypto?.randomUUID?.() || `gp-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
export function localDate(d = new Date()) { return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`; }
export function localTime(d = new Date()) { return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`; }
export function validDate(s) { if (typeof s !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const d = new Date(s+'T12:00:00Z'); return !isNaN(d) && d.toISOString().slice(0,10) === s && s >= '1900-01-01' && s <= '2200-12-31'; }
export function shiftDate(s, n) { const d = new Date(s+'T12:00:00Z'); d.setUTCDate(d.getUTCDate()+n); return d.toISOString().slice(0,10); }
export const dayDistance = (a,b) => Math.round((new Date(b+'T12:00:00Z')-new Date(a+'T12:00:00Z'))/86400000);
export function weekStart(s) { const d = new Date(s+'T12:00:00Z'); return shiftDate(s,-((d.getUTCDay()+6)%7)); }
export const timestamp = e => new Date(e.date+'T'+e.time+':00').getTime();
export const avg = values => values.length ? values.reduce((a,b)=>a+b,0)/values.length : null;
export const zeroMacros = () => ({k:0,p:0,c:0,f:0});
export function sumMacros(items) { const out=zeroMacros(); items.forEach(item=>MACROS.forEach(key=>out[key]+=Number(item[key])||0)); return out; }
export function makeItem(food, quantity, unit = food.unit) {
  const qty=Number(quantity), amount=unit==='portion' ? qty*food.portion : qty;
  if (!Number.isFinite(qty) || qty<=0 || qty>100000) throw Error('Indique une quantité positive.');
  return {id:uid(),foodId:food.id,name:food.name,qty,unit,amount,baseUnit:food.unit,basis:food.basis, ...Object.fromEntries(MACROS.map(key=>[key,food[key]*amount/100]))};
}
export function emptyState() { return {schemaVersion:SCHEMA,entries:[],body:[],foods:[],favorites:[],days:{},settings:{kcal:null,protein:null,carbs:null,fat:null,weight:null,reportName:'',reportNote:'',lastBackup:null},updatedAt:null}; }

const fail = (field) => { throw Error(`Sauvegarde invalide : ${field}. Tes données actuelles sont conservées.`); };
function object(v,field) { if (!v || typeof v!=='object' || Array.isArray(v)) fail(field); return v; }
function string(v,field,max=4000,optional=false) { if(optional && (v==null)) return ''; if(typeof v!=='string' || v.length>max) fail(field); return v; }
function number(v,field,min=0,max=100000) { if(typeof v!=='number' || !Number.isFinite(v) || v<min || v>max) fail(field); return v; }
function optionalNumber(v,field,min=0,max=100000) { return v==null || v==='' ? null : number(v,field,min,max); }
function array(v,field,max=100000) { if(!Array.isArray(v) || v.length>max) fail(field); return v; }
function id(v) { if(typeof v!=='string' || !/^[A-Za-z0-9_-]{1,100}$/.test(v)) fail('identifiant'); return v; }
function date(v) { if(!validDate(v)) fail('date'); return v; }
function time(v) { if(typeof v!=='string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(v)) fail('heure'); return v; }
function tags(v,field) { return array(v??[],field,30).map(x=>string(x,field,100)); }
function checkedItem(v) {
  object(v,'aliment du repas'); const out={id:id(v.id),foodId:string(v.foodId??'','référence',100),name:string(v.name,'nom de l’aliment',200),qty:number(v.qty,'quantité',0.001),unit:string(v.unit,'unité',30),amount:number(v.amount,'quantité pesée',0.001),baseUnit:string(v.baseUnit,'unité de référence',10),basis:string(v.basis,'cru/cuit',100)};
  if(!['g','ml','portion'].includes(out.unit) || !['g','ml'].includes(out.baseUnit)) fail('unité');
  MACROS.forEach(k=>out[k]=number(v[k],k)); return out;
}
export function validateState(input) {
  const v=object(input,'contenu'); if(v.schemaVersion!==SCHEMA) fail('version non prise en charge');
  const out=emptyState();
  out.entries=array(v.entries,'journal').map(e=>{
    object(e,'événement'); const base={id:id(e.id),date:date(e.date),time:time(e.time),kind:e.kind,note:string(e.note,'note',4000,true)};
    if(e.kind==='hunger') return {...base,intensity:number(e.intensity,'faim',0,10),type:string(e.type,'sensation',100),period:string(e.period,'moment',100),physical:tags(e.physical,'sensations physiques'),emotions:tags(e.emotions,'émotions'),context:string(e.context,'contexte',300,true)};
    if(e.kind==='meal') { const items=array(e.items,'aliments',200).map(checkedItem); if(!items.length) fail('repas vide'); return {...base,name:string(e.name,'nom du repas',200),meal:string(e.meal,'type de repas',100),items,hunger:optionalNumber(e.hunger,'faim avant',0,10),satiety:optionalNumber(e.satiety,'satiété après',0,10),duration:optionalNumber(e.duration,'durée du repas',1,1440)}; }
    if(e.kind==='sport') return {...base,type:string(e.type,'activité',100),duration:number(e.duration,'durée du sport',1,1440),effort:optionalNumber(e.effort,'effort',0,10)};
    fail('type d’événement');
  });
  if(new Set(out.entries.map(e=>e.id)).size!==out.entries.length) fail('événements en double');
  out.body=array(v.body,'mesures').map(e=>{object(e,'mesure'); const b={id:id(e.id),date:date(e.date),note:string(e.note,'note de mesure',2000,true)}; let n=0; Object.keys(BODY_FIELDS).forEach(k=>{if(e[k]!=null){b[k]=number(e[k],BODY_FIELDS[k],0.1,1000);n++;}}); if(!n) fail('mesure vide'); return b;});
  if(new Set(out.body.map(e=>e.date)).size!==out.body.length || new Set(out.body.map(e=>e.id)).size!==out.body.length) fail('mesures en double');
  out.foods=array(v.foods,'bibliothèque',10000).map(e=>{object(e,'aliment'); const food={id:id(e.id),name:string(e.name,'nom',200),unit:string(e.unit,'unité',10),basis:string(e.basis,'poids de référence',100),portion:number(e.portion,'portion',0.1,10000),category:string(e.category,'famille',100),source:string(e.source,'source',500,true)}; if(!['g','ml'].includes(food.unit))fail('unité de bibliothèque');MACROS.forEach(k=>food[k]=number(e[k],k,0,k==='k'?2000:100)); return food;});
  if(new Set(out.foods.map(e=>e.id)).size!==out.foods.length) fail('aliments en double');
  out.favorites=array(v.favorites,'favoris',1000).map(f=>({id:id(f.id),name:string(f.name,'nom du favori',200),meal:string(f.meal,'type de favori',100),items:array(f.items,'aliments favoris',200).map(checkedItem)}));
  if(out.favorites.some(f=>!f.items.length) || new Set(out.favorites.map(f=>f.id)).size!==out.favorites.length) fail('favoris');
  const days=object(v.days,'journées'); if(Object.keys(days).length>100000) fail('trop de journées');
  Object.entries(days).forEach(([d,x])=>{ date(d); object(x,'journée'); if(typeof x.complete!=='boolean' || typeof x.activityKnown!=='boolean') fail('état de journée');out.days[d]={complete:x.complete,activityKnown:x.activityKnown,note:string(x.note,'note de journée',2000,true)}; });
  const settings=object(v.settings,'réglages');
  ['kcal','protein','carbs','fat','weight'].forEach(k=>out.settings[k]=optionalNumber(settings[k],k,0.1,k==='kcal'?20000:2000));
  ['reportName','reportNote'].forEach(k=>out.settings[k]=string(settings[k],k,k==='reportName'?120:4000,true));
  if(settings.lastBackup!=null){const s=string(settings.lastBackup,'dernière sauvegarde',60); if(isNaN(Date.parse(s))) fail('dernière sauvegarde');out.settings.lastBackup=s;}
  out.updatedAt=v.updatedAt==null?null:string(v.updatedAt,'mise à jour',60);
  if(out.updatedAt!==null&&isNaN(Date.parse(out.updatedAt)))fail('date de mise à jour');
  return out;
}

export function migrateV1(v) {
  object(v,'V1'); array(v.entries,'journal V1');array(v.body,'mesures V1');array(v.foods,'aliments V1');
  const out=emptyState(), groups=new Map();
  v.entries.forEach(e=>{
    const base={id:uid(),date:date(e.date),time:time(e.time),kind:e.kind,note:string(e.note,'note',4000,true)};
    if(e.kind==='hunger'){out.entries.push({...base,intensity:number(e.intensity,'faim',0,10),type:string(e.type??'Je ne sais pas','sensation',100),period:string(e.period??'Autre','moment',100),physical:[],emotions:[],context:string(e.context,'contexte',300,true)});return;}
    if(e.kind!=='meal') fail('type V1');
    const key=e.date+'|'+e.time+'|'+e.meal; let group=groups.get(key);
    if(!group){group={...base,name:'',meal:string(e.meal,'repas',100),items:[],hunger:null,satiety:null,duration:null};groups.set(key,group);out.entries.push(group);} 
    const legacyOptional=(x,k)=>x==null||x===''?null:number(Number(x),k,0,10);
    if(e.hunger!=null&&e.hunger!=='')group.hunger=legacyOptional(e.hunger,'faim');
    if(e.satiety!=null&&e.satiety!=='')group.satiety=legacyOptional(e.satiety,'satiété');
    if(e.note&&!group.note.includes(e.note))group.note=(group.note+'\n'+e.note).trim();
    const item={id:uid(),foodId:'',name:string(e.food,'nom',200),qty:number(e.qty,'quantité',0.001),amount:e.qty,unit:'g',baseUnit:'g',basis:string(e.basis??'produit','référence',100)};
    MACROS.forEach(k=>item[k]=number(e[k],k));group.items.push(item);
  });
  const byDate=new Map();v.body.forEach(b=>{const d=date(b.date);const record=byDate.get(d)||{id:uid(),date:d,note:''};Object.keys(BODY_FIELDS).forEach(k=>{if(b[k]!=null) record[k]=number(b[k],k,0.1,1000);});byDate.set(d,record);});out.body=[...byDate.values()];
  out.foods=v.foods.map(f=>({id:uid(),name:string(f.name,'nom',200),...Object.fromEntries(MACROS.map(k=>[k,number(f[k],k,0,k==='k'?2000:100)])),basis:string(f.basis??'produit','référence',100),unit:'g',portion:100,category:'Mes aliments',source:'Aliment personnalisé importé de la V1.'}));
  if(v.settings?.protein!=null)out.settings.protein=number(Number(v.settings.protein),'repère protéines',0.1,2000);
  return validateState(out);
}
export function parseBackup(text) {
  if(typeof text!=='string' || text.length>15*1024*1024) fail('fichier trop volumineux');
  let v;try{v=JSON.parse(text);}catch{fail('JSON illisible');}
  if(v?.application==='gros-petard-nutrition'){if(v.formatVersion!==SCHEMA)fail('version de sauvegarde');return validateState(v.data);}
  if(v?.schemaVersion===SCHEMA)return validateState(v);
  if(v?.schemaVersion!=null)fail('version de sauvegarde');
  if(v?.entries && v?.body && v?.foods)return migrateV1(v);
  fail('ce fichier n’est pas une sauvegarde de cette application');
}
export function backupObject(data) { return {application:'gros-petard-nutrition',formatVersion:SCHEMA,appVersion:VERSION,exportedAt:new Date().toISOString(),data:validateState(data)}; }
export function dailyRows(data,start,end) {
  const byDate=new Map();
  const day=d=>{if(!byDate.has(d))byDate.set(d,{date:d,...zeroMacros(),meals:0,hungerSum:0,hungerCount:0,sport:0,sportCount:0,complete:data.days[d]?.complete===true,activityKnown:data.days[d]?.activityKnown===true});return byDate.get(d);};
  data.entries.forEach(e=>{if(e.date<start||e.date>end)return;const d=day(e.date);if(e.kind==='meal'){d.meals++;const totals=sumMacros(e.items);MACROS.forEach(k=>d[k]+=totals[k]);}if(e.kind==='hunger'){d.hungerSum+=e.intensity;d.hungerCount++;}if(e.kind==='sport'){d.sport+=e.duration;d.sportCount++;d.activityKnown=true;}});
  Object.keys(data.days).forEach(d=>{if(d>=start&&d<=end)day(d);});
  return [...byDate.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(d=>({...d,hunger:d.hungerCount?d.hungerSum/d.hungerCount:null}));
}
export function weeklyRows(data,start,end) {
  const weeks=new Map();const make=d=>{const w=weekStart(d);if(!weeks.has(w))weeks.set(w,{date:w,weights:[],days:[],body:[],hunger:[],sport:0});return weeks.get(w);};
  dailyRows(data,start,end).forEach(d=>{const w=make(d.date);w.days.push(d);w.sport+=d.sport;});
  data.body.filter(e=>e.date>=start&&e.date<=end).forEach(e=>{const w=make(e.date);if(e.weight!=null)w.weights.push(e.weight);w.body.push(e);});
  data.entries.filter(e=>e.kind==='hunger'&&e.date>=start&&e.date<=end).forEach(e=>make(e.date).hunger.push(e.intensity));
  return [...weeks.values()].sort((a,b)=>a.date.localeCompare(b.date)).map(w=>({...w,weight:avg(w.weights),weighings:w.weights.length,completeDays:w.days.filter(d=>d.complete).length,kcal:avg(w.days.filter(d=>d.complete).map(d=>d.k)),protein:avg(w.days.filter(d=>d.complete).map(d=>d.p)),hungerMean:avg(w.hunger),waist:w.body.filter(b=>b.waist!=null).sort((a,b)=>a.date.localeCompare(b.date)).at(-1)?.waist??null}));
}
export function pearson(pairs) {
  if(pairs.length<5) return null; const ax=avg(pairs.map(p=>p[0])),ay=avg(pairs.map(p=>p[1]));let c=0,x=0,y=0;
  pairs.forEach(([a,b])=>{c+=(a-ax)*(b-ay);x+=(a-ax)**2;y+=(b-ay)**2;});return x&&y ? c/Math.sqrt(x*y) : null;
}
export function analyze(data,start,end) {
  const days=dailyRows(data,start,end), complete=days.filter(d=>d.complete), entries=data.entries.filter(e=>e.date>=start&&e.date<=end), hungers=entries.filter(e=>e.kind==='hunger');
  const allMeals=data.entries.filter(e=>e.kind==='meal').map(e=>({e,time:timestamp(e)})).sort((a,b)=>a.time-b.time);
  const afterMeal=hungers.map(h=>{const t=timestamp(h);let lo=0,hi=allMeals.length;while(lo<hi){const mid=Math.floor((lo+hi)/2);if(allMeals[mid].time<=t)lo=mid+1;else hi=mid;}const preceding=lo>0?allMeals[lo-1]:null;const gap=preceding?(t-preceding.time)/60000:null;return {h,meal:preceding?.e,gap};}).filter(x=>x.gap!=null&&x.gap<=360);
  const sportDays=days.filter(d=>d.activityKnown && d.hungerCount>0 && d.sport>0),restDays=days.filter(d=>d.activityKnown && d.hungerCount>0 && d.sport===0);
  const weeks=weeklyRows(data,start,end), pairs=[];
  for(let i=1;i<weeks.length;i++){const previous=weeks[i-1],w=weeks[i];if(dayDistance(previous.date,w.date)===7&&previous.weight!=null&&w.weight!=null&&previous.completeDays>=3&&w.completeDays>=3&&previous.weighings>=2&&w.weighings>=2)pairs.push([previous.kcal,w.weight-previous.weight]);}
  const contexts=new Map();hungers.forEach(e=>{const key=e.context||'Contexte non renseigné';const a=contexts.get(key)||[];a.push(e.intensity);contexts.set(key,a);});
  const byHour=[{name:'Nuit · 0–6 h',values:[]},{name:'Matin · 6–12 h',values:[]},{name:'Après-midi · 12–18 h',values:[]},{name:'Soir · 18–24 h',values:[]}];hungers.forEach(h=>byHour[Math.floor(Number(h.time.slice(0,2))/6)].values.push(h.intensity));
  const early=afterMeal.filter(x=>x.gap<120),late=afterMeal.filter(x=>x.gap>=120);
  const mealsByName=new Map();entries.filter(e=>e.kind==='meal'&&e.satiety!=null).forEach(e=>{const name=e.name||e.meal;const a=mealsByName.get(name)||[];a.push(e.satiety);mealsByName.set(name,a);});
  const weights=data.body.filter(e=>e.date>=start&&e.date<=end&&e.weight!=null).sort((a,b)=>a.date.localeCompare(b.date));
  return {days,complete,weeks,entries,hungers,hungerMean:avg(hungers.map(h=>h.intensity)),means:Object.fromEntries(MACROS.map(k=>[k,avg(complete.map(d=>d[k]))])),weightDelta:weights.length>=2?weights.at(-1).weight-weights[0].weight:null,weightCount:weights.length,
    sport:{with:avg(sportDays.map(d=>d.hunger)),without:avg(restDays.map(d=>d.hunger)),withN:sportDays.length,withoutN:restDays.length},
    timing:{early:avg(early.map(x=>x.h.intensity)),late:avg(late.map(x=>x.h.intensity)),earlyN:early.length,lateN:late.length},
    contexts:[...contexts].map(([name,values])=>({name,count:values.length,mean:avg(values)})).sort((a,b)=>b.count-a.count),
    hours:byHour.map(x=>({name:x.name,mean:avg(x.values),count:x.values.length})),satiety:[...mealsByName].filter(([,v])=>v.length>=2).map(([name,v])=>({name,mean:avg(v),count:v.length})),bodyLink:{correlation:pearson(pairs),count:pairs.length}};
}
export function csvCell(v) { let s=String(v??'');if(/^[\s]*[=+@\-]/.test(s)||/^[\t\r\n]/.test(s)) s="'"+s;return '"'+s.replace(/"/g,'""')+'"'; }
export function toCSV(data,start,end) {
  const columns=['Date','Heure','Type','Nom','Aliment','Quantité saisie','Unité','Quantité pesée','Unité de référence','Cru/cuit','kcal','Protéines g','Glucides g','Lipides g','Faim /10','Satiété /10','Sensations physiques','Émotions','Contexte','Durée min','Note','Journée complète','Poids kg','Taille cm','Hanches cm','Fessiers cm','Cuisse cm','Poitrine cm','Bras cm'];
  const rows=[];data.entries.filter(e=>e.date>=start&&e.date<=end).sort((a,b)=>timestamp(a)-timestamp(b)).forEach(e=>{const base={'Date':e.date,'Heure':e.time,'Type':e.kind,'Nom':e.name||e.meal||e.type,'Note':e.note,'Journée complète':data.days[e.date]?.complete?'oui':'non'};
    if(e.kind==='meal')e.items.forEach((x,i)=>rows.push({...base,'Aliment':x.name,'Quantité saisie':x.qty,'Unité':x.unit,'Quantité pesée':x.amount,'Unité de référence':x.baseUnit,'Cru/cuit':x.basis,'kcal':x.k,'Protéines g':x.p,'Glucides g':x.c,'Lipides g':x.f,...(i===0?{'Faim /10':e.hunger,'Satiété /10':e.satiety,'Durée min':e.duration}:{})}));
    if(e.kind==='hunger')rows.push({...base,'Faim /10':e.intensity,'Sensations physiques':e.physical.join(', '),'Émotions':e.emotions.join(', '),'Contexte':e.context});
    if(e.kind==='sport')rows.push({...base,'Durée min':e.duration});
  });
  data.body.filter(e=>e.date>=start&&e.date<=end).forEach(b=>rows.push({'Date':b.date,'Type':'mesures','Note':b.note,'Poids kg':b.weight,'Taille cm':b.waist,'Hanches cm':b.hips,'Fessiers cm':b.glutes,'Cuisse cm':b.thigh,'Poitrine cm':b.chest,'Bras cm':b.arm}));
  return '\ufeff'+[columns,...rows.map(r=>columns.map(c=>r[c]))].map(row=>row.map(csvCell).join(';')).join('\r\n');
}
