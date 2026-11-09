'use strict';
const KEY='gp-nutrition-v2-ergonomic-prototype-only';
const MEALS=[['breakfast','Petit-déjeuner'],['snack-am','Collation matin'],['lunch','Déjeuner'],['snack-pm','Collation après-midi'],['dinner','Dîner']];
const $=id=>document.getElementById(id);
const isoDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const today=()=>isoDate(new Date());
let day=today(),mealKey=null,editId=null,db={days:{}};
try{const parsed=JSON.parse(localStorage.getItem(KEY)||'{}');if(parsed&&typeof parsed==='object'&&parsed.days&&typeof parsed.days==='object')db=parsed;}catch{}
const save=()=>localStorage.setItem(KEY,JSON.stringify(db));
const data=()=>db.days[day]||{items:[],complete:false};
const items=()=>data().items||[];
const totals=arr=>arr.reduce((a,i)=>{const q=i.grams/100;for(const k of ['kcal','p','c','f'])a[k]+=i[k]*q;return a},{kcal:0,p:0,c:0,f:0});
const fmt=n=>Math.round(n).toLocaleString('fr-FR');
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function update(fn){const record=structuredClone(data());fn(record);db.days[day]=record;save();render();}
function render(){ $('day').value=day;$('journal-date').textContent=new Date(day+'T12:00:00').toLocaleDateString('fr-FR',{dateStyle:'full'});const all=totals(items());$('cal').textContent=fmt(all.kcal);$('remain').textContent=fmt(1700-all.kcal);$('protein').textContent=fmt(all.p)+' g';$('carbs').textContent=fmt(all.c)+' g';$('fat').textContent=fmt(all.f)+' g';$('complete').checked=!!data().complete;
$('home-meals').innerHTML=MEALS.map(([key,label])=>{const t=totals(items().filter(i=>i.meal===key));return '<button class="meal" data-open="'+key+'"><span><strong>'+label+'</strong><small>'+items().filter(i=>i.meal===key).length+' aliment(s)</small></span><span class="right">'+fmt(t.kcal)+' kcal ›</span></button>'}).join('');
$('journal-meals').innerHTML=MEALS.map(([key,label])=>{const group=items().filter(i=>i.meal===key);return '<section class="mealblock"><header><h2>'+label+'</h2><button class="add" data-add="'+key+'">+ Aliment</button></header>'+(group.length?group.map(i=>'<div class="food"><div><strong>'+safe(i.name)+'</strong><small>'+fmt(i.grams)+' g · '+fmt(i.kcal*i.grams/100)+' kcal</small></div><button data-edit="'+safe(i.id)+'" aria-label="Modifier '+safe(i.name)+'">✎</button><button data-delete="'+safe(i.id)+'" aria-label="Supprimer '+safe(i.name)+'">×</button></div>').join(''):'<p class="empty">Aucun aliment enregistré</p>')+'</section>'}).join('');}
function page(name){document.querySelectorAll('.page').forEach(e=>e.hidden=e.id!==name);document.querySelectorAll('nav button').forEach(e=>{if(e.dataset.page===name)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current')});scrollTo(0,0);}
function openEditor(key,id=null){mealKey=key;editId=id;const item=items().find(i=>i.id===id);$('editor-title').textContent=(item?'Modifier':'Ajouter')+' — '+MEALS.find(m=>m[0]===key)[1];$('food-form').reset();if(item)for(const k of ['name','grams','kcal','p','c','f'])$('food-form').elements[k].value=item[k];$('editor').showModal();}
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.page){page(b.dataset.page);return;}if(b.dataset.open){page('journal');openEditor(b.dataset.open);return;}if(b.dataset.add){openEditor(b.dataset.add);return;}if(b.dataset.edit){const item=items().find(i=>i.id===b.dataset.edit);if(item)openEditor(item.meal,item.id);return;}if(b.dataset.delete){if(confirm('Supprimer cet aliment ?'))update(r=>{r.items=r.items.filter(i=>i.id!==b.dataset.delete)});return;}});
$('food-form').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget.elements;const field=k=>f.namedItem(k).value;const v={id:editId||crypto.randomUUID(),meal:mealKey,name:field('name').trim(),grams:Number(field('grams')),kcal:Number(field('kcal')),p:Number(field('p')),c:Number(field('c')),f:Number(field('f'))};if(!v.name||!Number.isFinite(v.grams)||v.grams<=0||['kcal','p','c','f'].some(k=>!Number.isFinite(v[k])||v[k]<0))return;update(r=>{r.items=r.items||[];const index=r.items.findIndex(i=>i.id===editId);if(index>=0)r.items[index]=v;else r.items.push(v)});$('editor').close();});
$('cancel').onclick=()=>$('editor').close();
$('complete').onchange=e=>update(r=>r.complete=e.target.checked);
$('day').onchange=e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){day=e.target.value;render();}};
for(const [id,offset] of [['prev',-1],['next',1]])$(id).onclick=()=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+offset);day=isoDate(d);render();};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({format:'prototype-mobile',...db},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gros-petard-prototype-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
render();