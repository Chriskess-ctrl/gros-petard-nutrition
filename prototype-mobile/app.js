'use strict';
const KEY='gp-nutrition-v2-ergonomic-prototype-only';
const MEALS=[['breakfast','Petit-déjeuner'],['snack-am','Collation matin'],['lunch','Déjeuner'],['snack-pm','Collation après-midi'],['dinner','Dîner']];
const $=id=>document.getElementById(id);
const FAMILIES=['Fruits','Légumes','Viandes','Poissons et fruits de mer','Œufs','Féculents et céréales','Produits laitiers','Légumineuses','Oléagineux','Matières grasses','Boissons','Produits sucrés','Autres'];
const norm=s=>String(s||'').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase('fr');
const familyOf=item=>item.family||'Autres';

const isoDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
const today=()=>isoDate(new Date());
let day=today(),mealKey=null,editId=null,journalExpanded=null,db={days:{},goals:{kcal:1700,p:80,c:225,f:53}};
function readStoredData() {
  try {
    return JSON.parse(localStorage.getItem(KEY)) || {};
  } catch {
    return {};
  }
}
const stored = readStoredData();
if (stored.days && typeof stored.days === 'object') db = stored;
db.goals={kcal:1700,p:80,c:225,f:53,...(db.goals||{})};
db.library=Array.isArray(db.library)?db.library:[];
db.deletedLibraryNames=Array.isArray(db.deletedLibraryNames)?db.deletedLibraryNames:[];
db.libraryFavorites=Array.isArray(db.libraryFavorites)?db.libraryFavorites:[];
let libraryFilter='all',libraryShowAll=false,libraryOpen=null,libraryEditIndex=null;
const LIBRARY_FAMILY_PREF='gp-library-selected-family';
try { const savedFamily=localStorage.getItem(LIBRARY_FAMILY_PREF)||''; if(FAMILIES.includes(savedFamily)) $('family-filter').value=savedFamily; } catch {}
// Aliments de démarrage : ne jamais écraser les valeurs personnelles ni recréer un aliment supprimé.
const MEAT_STARTERS=[
 {name:'Blanc de poulet',raw:{kcal:110,p:23,c:0,f:1.8},cooked:{kcal:165,p:31,c:0,f:3.6}},
 {name:'Blanc de dinde',raw:{kcal:110,p:24,c:0,f:1.3},cooked:{kcal:150,p:30,c:0,f:2.5}},
 {name:'Bœuf haché 5 % MG',raw:{kcal:137,p:21,c:0,f:5},cooked:{kcal:170,p:27,c:0,f:6.5}},
 {name:'Filet de porc',raw:{kcal:120,p:22,c:0,f:3},cooked:{kcal:160,p:29,c:0,f:4.5}}
].map(x=>({...x,family:'Viandes',unit:'g',...x.raw,variants:{raw:x.raw,cooked:x.cooked}}));
const STARTER_FOODS=[...MEAT_STARTERS,
  {name:'Tomates cerises crues',family:'Légumes',kcal:21,p:0.8,c:3.5,f:0.3,unit:'g'},
  {name:'Champignons de Paris frais',family:'Légumes',kcal:22,p:2.6,c:1.8,f:0.4,unit:'g'},
  {name:'Laitue iceberg crue',family:'Légumes',kcal:14,p:0.9,c:1.8,f:0.1,unit:'g'},
  {name:'Mélange mâche et roquette',family:'Légumes',kcal:22,p:2.2,c:2.0,f:0.5,unit:'g'}
];
for(const food of STARTER_FOODS){if(!db.deletedLibraryNames.includes(norm(food.name))&&!db.library.some(existing=>norm(existing.name)===norm(food.name)))db.library.push({...food});}
// Reconstitue les aliments saisis dans les anciennes versions du prototype.
for(const record of Object.values(db.days)){for(const item of (record.items||[])){if(!db.deletedLibraryNames.includes(norm(item.name))&&!db.library.some(f=>norm(f.name)===norm(item.name)))db.library.push({name:item.name,family:familyOf(item),kcal:item.kcal,p:item.p,c:item.c,f:item.f});}}
$('food-family').innerHTML=FAMILIES.map(f=>'<option>'+f+'</option>').join('');
$('library-add-family').innerHTML=FAMILIES.map(f=>'<option>'+f+'</option>').join('');
$('family-filter').innerHTML='<option value="">Toutes les familles</option>'+FAMILIES.map(f=>'<option>'+f+'</option>').join('');
// Le suivi écrit aussi dans cette sauvegarde pendant que le journal est ouvert.
function nutritionSnapshot() {
  const {weights, measurements} = readStoredData();
  return {...db, weights, measurements};
}
const writeStoredData = data => localStorage.setItem(KEY, JSON.stringify(data));
const save = () => writeStoredData(nutritionSnapshot());
const data=()=>db.days[day]||{items:[],complete:false};
const items=()=>data().items||[];
const totals=arr=>arr.reduce((a,i)=>{const q=i.grams/100;for(const k of ['kcal','p','c','f'])a[k]+=i[k]*q;return a},{kcal:0,p:0,c:0,f:0});
const fmt=n=>Math.round(n).toLocaleString('fr-FR');
const meatFood=name=>db.library.find(food=>norm(food.name)===norm(name)&&food.variants&&(food.variants.raw||food.variants.cooked));
let selectedMeatState='raw';
function mealLiveTotals(){
 const f=$('food-form').elements,unit=f.namedItem('unit').value,q=Number(f.namedItem('quantity').value);
 const grams=unit==='g'?q:unit==='piece'?q*Number(f.namedItem('pieceWeight').value):q*(unit==='cl'?10:1)*Number(f.namedItem('density').value);
 const values=['kcal','p','c','f'].map(k=>Number(f.namedItem(k).value));
 const valid=q>0&&grams>0&&values.every(Number.isFinite)&&['kcal','p','c','f'].every(k=>f.namedItem(k).value!=='');
 $('meal-live-kcal').textContent=valid?fmt(grams*values[0]/100)+' kcal':'— kcal';
 $('meal-live-macros').textContent=valid?'Protéines '+fmt(grams*values[1]/100)+' g · Glucides '+fmt(grams*values[2]/100)+' g · Lipides '+fmt(grams*values[3]/100)+' g':'Renseigne un aliment et une quantité.';
}
function setMealNutritionExpanded(expanded){
 $('meal-nutrition-fields').hidden=!expanded;
 $('meal-nutrition-toggle').setAttribute('aria-expanded',String(expanded));
 $('meal-nutrition-toggle').textContent=expanded?'Masquer les valeurs pour 100 g':'Modifier les valeurs nutritionnelles';
}
$('meal-nutrition-toggle').addEventListener('click',()=>setMealNutritionExpanded($('meal-nutrition-fields').hidden));
$('food-form').addEventListener('input',mealLiveTotals);
function setMeatState(state){
 const form=$('food-form').elements,food=meatFood(form.namedItem('name').value);
 selectedMeatState=state==='cooked'?'cooked':'raw';
 if(food&&!food.variants[selectedMeatState])selectedMeatState=food.variants.raw?'raw':'cooked';
 $('meat-state-field').hidden=!food;
 document.querySelectorAll('[data-meat-state]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.meatState===selectedMeatState)));
 if(food){const values=food.variants[selectedMeatState];for(const k of ['kcal','p','c','f'])form.namedItem(k).value=values?values[k]:'';document.querySelectorAll('[data-meat-state]').forEach(b=>{b.disabled=!food.variants[b.dataset.meatState];b.title=b.disabled?'Valeurs non renseignées dans la bibliothèque':'';});const note=$('meat-state-field').querySelector('small');if(note)note.textContent=(!food.variants.raw||!food.variants.cooked)?'Seul l’état renseigné est disponible. Complète la fiche dans la bibliothèque pour ajouter l’autre.':'Cuisson sans matière grasse ajoutée. Saisis le poids réellement pesé.';}else{document.querySelectorAll('[data-meat-state]').forEach(b=>{b.disabled=false;b.title='';});}mealLiveTotals();
}
function applyFoodToMeal(food,state='raw'){
 const f=$('food-form').elements;
 for(const k of ['name','kcal','p','c','f'])f.namedItem(k).value=food[k]??'';
 f.namedItem('family').value=familyOf(food);
 f.namedItem('unit').value=food.unit||'g';
 f.namedItem('pieceWeight').value=food.pieceWeight??'';
 f.namedItem('density').value=food.density??1;
 setMeatState(food.variants?.[state]?state:food.variants?.raw?'raw':food.variants?.cooked?'cooked':state);
 syncUnit();syncSpellPickerLabels();setMealNutritionExpanded(false);mealLiveTotals();
}
const safe=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function update(fn){const record=structuredClone(data());fn(record);db.days[day]=record;save();render();window.dispatchEvent(new Event('gp:nutrition-updated'));}
function recentLibraryNames(){
 const dates=Object.keys(db.days||{}).sort().reverse(), names=[];
 for(const date of dates){for(const item of (db.days[date]?.items||[])){const n=norm(item.name);if(!names.includes(n))names.push(n);}}
 return names;
}
function renderLibrary(){
 const query=norm($('food-search').value.trim()),family=$('family-filter').value;
 const recent=recentLibraryNames(),favs=db.libraryFavorites||[];
 const filtered=db.library.filter(f=>(!family||familyOf(f)===family)&&norm(f.name).includes(query)&&
 (libraryFilter==='all'||libraryFilter==='favorites'&&favs.includes(norm(f.name))||libraryFilter==='recent'&&recent.includes(norm(f.name))));
 const list=filtered.sort((a,b)=>libraryFilter==='recent'?recent.indexOf(norm(a.name))-recent.indexOf(norm(b.name)):a.name.localeCompare(b.name,'fr',{sensitivity:'base'}));
 const chips=[['all','Tous'],['favorites','⭐ Favoris'],['recent','🕘 Récents']];
 $('library-chips').innerHTML=chips.map(([id,label])=>'<button type="button" data-library-filter="'+id+'" aria-pressed="'+(libraryFilter===id)+'">'+label+'</button>').join('');
 $('library-count').textContent=list.length+' aliment'+(list.length>1?'s':'');
 const visible=(libraryShowAll||query||family)?list:list.slice(0,5);
 $('library-list').innerHTML=visible.length?visible.map(f=>{
  const index=db.library.indexOf(f),expanded=libraryOpen===norm(f.name),favorite=favs.includes(norm(f.name));
  return '<article class="library-food library-food-compact"><div class="library-food-head"><button type="button" class="library-food-main" data-library-expand="'+index+'" aria-expanded="'+expanded+'"><strong>'+safe(f.name)+'</strong><small>'+safe(familyOf(f))+' · '+fmt(f.kcal)+' kcal / 100 g'+(f.variants?.raw?' cru':'')+(f.variants?.cooked?' · '+fmt(f.variants.cooked.kcal)+' cuit':'')+'</small></button><button type="button" class="library-star" data-library-favorite="'+index+'" aria-label="'+(favorite?'Retirer des favoris':'Ajouter aux favoris')+'" aria-pressed="'+favorite+'">'+(favorite?'★':'☆')+'</button><button type="button" class="library-expand" data-library-expand="'+index+'" aria-label="Détails de '+safe(f.name)+'">'+(expanded?'⌃':'⌄')+'</button></div>'+
  (expanded?'<div class="library-food-details"><p>Pour 100 g : '+fmt(f.kcal)+' kcal · P '+fmt(f.p)+' g · G '+fmt(f.c)+' g · L '+fmt(f.f)+' g</p><div class="library-food-actions"><button type="button" data-library="'+index+'">Utiliser</button><button type="button" data-library-edit="'+index+'">Modifier</button><button type="button" data-library-delete="'+index+'">Supprimer</button></div></div>':'')+'</article>';
 }).join(''):'<p class="library-empty">Aucun aliment trouvé. Tu peux en ajouter un à ta bibliothèque.</p>';
 $('library-more').hidden=!!query||!!family||list.length<=5;
 $('library-more').textContent=libraryShowAll?'Afficher moins':'Voir tous les aliments ('+list.length+')';
}

function render() {
  const goal = db.goals;
  const ring = (id, value, target) => {
    const progress = Math.max(0, Math.min(100, value / target * 100));
    const element = $(id);
    element.style.setProperty('--progress', progress + '%');
    element.setAttribute('aria-valuenow', String(Math.round(progress)));
  };
  $('day').value = day;
  $('day-display').dateTime = day;
  $('day-display').textContent = day.split('-').reverse().join('/');
  $('journal-date').textContent = new Date(day + 'T12:00:00').toLocaleDateString('fr-FR', {dateStyle: 'full'});

  const all = totals(items());
  $('cal').textContent = fmt(all.kcal);
  $('remain').textContent = fmt(goal.kcal - all.kcal);
  $('complete').checked = !!data().complete;
  ring('cal-ring', all.kcal, goal.kcal);

  for (const [key, id] of [['p', 'protein'], ['c', 'carbs'], ['f', 'fat']]) {
    $(id).textContent = fmt(all[key]) + ' g';
    $(key + '-rest').textContent = fmt(goal[key] - all[key]) + ' g restants';
    ring(key + '-ring', all[key], goal[key]);
  }
  for (const key of ['kcal', 'p', 'c', 'f']) $('goal-' + key).value = goal[key];

  $('home-meals').innerHTML = MEALS.map(([key, label]) => {
    const meal = totals(items().filter(item => item.meal === key));
    return `<button type="button" class="meal" data-open="${key}">
      <img src="assets/meal-${key}.webp" alt="">
      <strong>${label}</strong>
      <span class="right">${fmt(meal.kcal)} kcal <span aria-hidden="true">›</span></span>
    </button>`;
  }).join('');
  $('journal-day-total').textContent = fmt(all.kcal) + ' / ' + fmt(goal.kcal) + ' kcal';
  $('journal-meals').innerHTML = MEALS.map(([key, label]) => {
    const group = items().filter(item => item.meal === key);
    const t = totals(group);
    const expanded = journalExpanded === key;
    const icon = `<img src="assets/journal-${key}.webp" alt="" width="48" height="48" loading="lazy">`;
    return '<section class="journal-meal'+(expanded?' is-open':'')+'"><button type="button" class="journal-meal-toggle" data-journal-toggle="'+key+'" aria-expanded="'+expanded+'"><span class="journal-meal-icon" aria-hidden="true">'+icon+'</span><span class="journal-meal-info"><strong>'+label+'</strong><small>'+group.length+' aliment(s) · '+fmt(t.kcal)+' kcal</small></span><span class="journal-chevron" aria-hidden="true">'+(expanded?'⌄':'›')+'</span></button>'+(expanded?'<div class="journal-meal-content">'+(group.length?group.map(i=>'<div class="food"><div><strong>'+safe(i.name)+'</strong><small>'+(i.quantity&&i.unit?fmt(i.quantity)+' '+(i.unit==='piece'?(i.quantity===1?'pièce':'pièces'):i.unit):fmt(i.grams)+' g')+' · '+fmt(i.kcal*i.grams/100)+' kcal</small></div><button data-edit="'+safe(i.id)+'" aria-label="Modifier '+safe(i.name)+'">✎</button><button data-delete="'+safe(i.id)+'" aria-label="Supprimer '+safe(i.name)+'">×</button></div>').join(''):'<p class="journal-empty">Aucun aliment enregistré</p>')+'<button type="button" class="primary journal-add" data-add="'+key+'">+ Ajouter un aliment</button></div>':'')+'</section>'
  }).join('');
  renderLibrary();
}
$('enter-journal').addEventListener('click', () => {
  $('welcome').hidden = true;
  $('nutrition-app').hidden = false;
  $('app-nav').hidden = false;
  document.body.classList.remove('on-welcome');
  page('home');
  $('home-title').focus({preventScroll: true});
});
let libraryFromPlus=false;
function page(name){if(name==='plus')showPlusHome();if(name!=='menus')libraryFromPlus=false;if(name==='menus')$('library-back-plus').hidden=!libraryFromPlus;document.body.classList.toggle('interior-page',name!=='home');document.querySelectorAll('.page').forEach(e=>e.hidden=e.id!==name);document.querySelectorAll('nav button').forEach(e=>{if(e.dataset.page===name)e.setAttribute('aria-current','page');else e.removeAttribute('aria-current')});scrollTo(0,0);}

// Sélecteurs visuels dans le formulaire : les <select> restent la source de vérité.
let activeSpellPicker=null;
function syncSpellPickerLabels(){
  for(const key of ['family','unit']){
    const select=$('food-'+key), label=$('food-'+key+'-value');
    if(select&&label)label.textContent=select.selectedOptions[0]?.textContent||'Choisir';
  }
}
function closeSpellPicker(restoreFocus=false){
  const key=activeSpellPicker;
  $('spell-picker-panel').hidden=true;
  activeSpellPicker=null;
  for(const k of ['family','unit'])$('food-'+k+'-trigger').setAttribute('aria-expanded','false');
  if(restoreFocus&&key)$('food-'+key+'-trigger').focus();
}
function openSpellPicker(key){
  if(activeSpellPicker===key){closeSpellPicker(true);return;}
  activeSpellPicker=key;
  const select=$('food-'+key), panel=$('spell-picker-panel'), list=$('spell-picker-options');
  const trigger=$('food-'+key+'-trigger');
  trigger.closest(key==='family'?'.spell-field':'.quantity-grid').after(panel);
  $('spell-picker-title').textContent=key==='family'?'Famille d’aliments':'Unité';
  list.innerHTML='';
  [...select.options].forEach((option,index)=>{
    const button=document.createElement('button');
    button.type='button';button.className='spell-picker-option';button.setAttribute('role','option');
    button.setAttribute('aria-selected',String(select.selectedIndex===index));
    button.textContent=option.textContent;
    button.addEventListener('click',()=>{
      select.value=option.value;
      select.dispatchEvent(new Event('change',{bubbles:true}));
      syncSpellPickerLabels();
      closeSpellPicker(true);
    });
    list.append(button);
  });
  panel.hidden=false;
  for(const k of ['family','unit'])$('food-'+k+'-trigger').setAttribute('aria-expanded',String(k===key));
  const selected=list.querySelector('[aria-selected="true"]')||list.firstElementChild;
  panel.scrollIntoView({block:'nearest'});
  selected?.focus({preventScroll:true});
  selected?.scrollIntoView({block:'nearest'});
}
for(const key of ['family','unit']){
  $('food-'+key+'-trigger').addEventListener('click',()=>openSpellPicker(key));
  $('food-'+key).addEventListener('change',syncSpellPickerLabels);
}
$('spell-picker-close').addEventListener('click',()=>closeSpellPicker(true));
$('spell-picker-panel').addEventListener('keydown',e=>{
  const opts=[...$('spell-picker-options').querySelectorAll('button')];
  const at=opts.indexOf(document.activeElement);
  if(e.key==='Escape'){e.preventDefault();closeSpellPicker(true);}
  else if(e.key==='ArrowDown'||e.key==='ArrowUp'){
    e.preventDefault();opts[(at+(e.key==='ArrowDown'?1:-1)+opts.length)%opts.length]?.focus();
  }else if(e.key==='Home'||e.key==='End'){
    e.preventDefault();opts[e.key==='Home'?0:opts.length-1]?.focus();
  }
});
$('editor').addEventListener('close',()=>closeSpellPicker(false));
$('editor').addEventListener('cancel',event=>{
  if(!activeSpellPicker)return;
  event.preventDefault();
  closeSpellPicker(true);
});

function syncUnit(){const unit=$('food-unit').value;$('piece-weight-label').hidden=unit!=='piece';$('density-label').hidden=unit!=='ml'&&unit!=='cl';const f=$('food-form').elements;f.namedItem('pieceWeight').required=unit==='piece';f.namedItem('density').required=unit==='ml'||unit==='cl';const q=Number(f.namedItem('quantity').value),weight=Number(f.namedItem('pieceWeight').value),density=Number(f.namedItem('density').value);const grams=unit==='g'?q:unit==='piece'?q*weight:q*(unit==='cl'?10:1)*density;$('quantity-conversion').textContent=q>0&&grams>0?'Équivalent : '+Math.round(grams*10)/10+' g':'';mealLiveTotals();}
const foodNameInput=$('meal-food-name');
const foodSuggestions=$('meal-food-suggestions');
let foodSuggestionMatches=[];
let foodSuggestionActive=-1;
function closeFoodSuggestions(){foodSuggestions.hidden=true;foodNameInput.setAttribute('aria-expanded','false');foodNameInput.removeAttribute('aria-activedescendant');foodSuggestionActive=-1;}
function renderFoodSuggestions(){const query=norm(foodNameInput.value.trim());foodSuggestionMatches=query?db.library.filter(food=>(!$('food-form').elements.namedItem('family').value||familyOf(food)===$('food-form').elements.namedItem('family').value)&&norm(food.name).split(/[^\p{L}\p{N}]+/u).some(word=>word.startsWith(query))).sort((a,b)=>{const aa=norm(a.name).startsWith(query)?0:1,bb=norm(b.name).startsWith(query)?0:1;return aa-bb||a.name.localeCompare(b.name,'fr',{sensitivity:'base'});}).slice(0,8):[];foodSuggestionActive=-1;if(!foodSuggestionMatches.length){closeFoodSuggestions();return;}foodSuggestions.innerHTML=foodSuggestionMatches.map((food,i)=>'<button type="button" role="option" id="food-suggestion-'+i+'" aria-selected="false" data-suggestion="'+i+'"><strong>'+safe(food.name)+'</strong><small>'+safe(familyOf(food))+' · '+fmt(food.kcal)+' kcal / 100 g</small></button>').join('');foodSuggestions.hidden=false;foodNameInput.setAttribute('aria-expanded','true');}
function highlightFoodSuggestion(i){foodSuggestionActive=i;foodSuggestions.querySelectorAll('[data-suggestion]').forEach((b,j)=>b.setAttribute('aria-selected',String(i===j)));if(i>=0){foodNameInput.setAttribute('aria-activedescendant','food-suggestion-'+i);foodSuggestions.children[i]?.scrollIntoView({block:'nearest'});}else foodNameInput.removeAttribute('aria-activedescendant');}
function chooseFoodSuggestion(i){const food=foodSuggestionMatches[i];if(!food)return;applyFoodToMeal(food);closeFoodSuggestions();$('food-form').elements.namedItem('quantity').focus();}
foodNameInput.addEventListener('input',()=>{renderFoodSuggestions();const known=db.library.some(food=>norm(food.name)===norm(foodNameInput.value.trim()));setMealNutritionExpanded(!known);});
foodNameInput.addEventListener('focus',renderFoodSuggestions);
$('food-form').elements.namedItem('family').addEventListener('change',renderFoodSuggestions);
foodNameInput.addEventListener('keydown',e=>{if(e.key==='Escape'){closeFoodSuggestions();return;}if(foodSuggestions.hidden)return;if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();highlightFoodSuggestion((foodSuggestionActive+(e.key==='ArrowDown'?1:-1)+foodSuggestionMatches.length)%foodSuggestionMatches.length);}else if(e.key==='Enter'&&foodSuggestionActive>=0){e.preventDefault();chooseFoodSuggestion(foodSuggestionActive);}});
foodSuggestions.addEventListener('click',e=>{const b=e.target.closest('[data-suggestion]');if(b)chooseFoodSuggestion(Number(b.dataset.suggestion));});
$('food-form').addEventListener('focusout',e=>{if(!e.currentTarget.contains(e.relatedTarget))closeFoodSuggestions();});
function openEditor(key,id=null){
  mealKey=key;
  editId=id;
  const item=items().find(i=>i.id===id);
  $('editor-title').textContent=(item?'Modifier':'Ajouter')+' — '+MEALS.find(m=>m[0]===key)[1];
  $('editor').dataset.meal=key;
  document.querySelector('.editor-heading-art').src='assets/journal-'+key+'.webp';
  const form=$('food-form');
  form.reset();
  selectedMeatState='raw';
  $('meat-state-field').hidden=true;
  closeFoodSuggestions();
  if(item){
    const f=form.elements;
    for(const k of ['name','kcal','p','c','f'])f.namedItem(k).value=item[k];
    f.namedItem('unit').value=item.unit||'g';
    f.namedItem('quantity').value=item.quantity||item.grams;
    f.namedItem('pieceWeight').value=item.pieceWeight||'';
    f.namedItem('density').value=item.density||1;
    f.namedItem('family').value=familyOf(item);
    setMeatState(item.meatState||'raw');
    if(item.meatState&&meatFood(item.name)){for(const k of ['kcal','p','c','f'])f.namedItem(k).value=item[k];}
  }
  syncUnit();
  syncSpellPickerLabels();
  closeSpellPicker(false);
  setMealNutritionExpanded(!item&&!db.library.some(food=>norm(food.name)===norm(form.elements.namedItem('name').value)));
  mealLiveTotals();
  $('editor').showModal();
  $('editor-fields').scrollTop=0;
}
document.addEventListener('click',e=>{
  const b=e.target.closest('button');
  if(!b)return;
  if(b.dataset.page){page(b.dataset.page);return;}
  if(b.hasAttribute('data-library-filter')){libraryFilter=b.dataset.libraryFilter;libraryShowAll=false;libraryOpen=null;renderLibrary();return;}
  if(b.hasAttribute('data-library-expand')){const food=db.library[Number(b.dataset.libraryExpand)];if(food){libraryOpen=libraryOpen===norm(food.name)?null:norm(food.name);renderLibrary();}return;}
  if(b.hasAttribute('data-library-favorite')){const food=db.library[Number(b.dataset.libraryFavorite)];if(!food)return;const key=norm(food.name);db.libraryFavorites=db.libraryFavorites.includes(key)?db.libraryFavorites.filter(n=>n!==key):[...db.libraryFavorites,key];save();renderLibrary();return;}
  if(b.hasAttribute('data-library-edit')){const food=db.library[Number(b.dataset.libraryEdit)];if(!food)return;libraryEditIndex=Number(b.dataset.libraryEdit);const form=$('library-add-form');form.reset();for(const key of ['name','family','unit','pieceWeight','density','kcal','p','c','f']){const el=form.elements.namedItem(key);if(el)el.value=food[key]??(key==='density'?1:'');}syncLibraryAddUnit();prepareLibraryState(food);$('library-add-title').textContent='Modifier mon aliment';$('library-add-dialog').showModal();return;}
  if(b.hasAttribute('data-library-delete')){
    const index=Number(b.dataset.libraryDelete),food=db.library[index];
    if(!food)return;
    if(!confirm('Supprimer « '+food.name+' » de la bibliothèque ? Les repas déjà enregistrés resteront inchangés.'))return;
    db.deletedLibraryNames=[...new Set([...db.deletedLibraryNames,norm(food.name)])];
    db.library.splice(index,1);
    db.libraryFavorites=db.libraryFavorites.filter(n=>n!==norm(food.name));
    save();renderLibrary();return;
  }
  if(b.dataset.library){
    const food=db.library[Number(b.dataset.library)];
    if(food){
      journalExpanded=mealKey||'lunch';
      page('journal');
      openEditor(journalExpanded);
      const f=$('food-form').elements;
      applyFoodToMeal(food);
      f.namedItem('unit').value=food.unit||'g';
      f.namedItem('quantity').value=food.unit==='piece'?1:food.unit==='cl'?10:100;
      f.namedItem('pieceWeight').value=food.pieceWeight||'';
      f.namedItem('density').value=food.density||1;
      syncUnit();
      syncSpellPickerLabels();
    }
    return;
  }
  if(b.dataset.journalToggle){journalExpanded=journalExpanded===b.dataset.journalToggle?null:b.dataset.journalToggle;render();return;}
  if(b.dataset.open){journalExpanded=b.dataset.open;render();page('journal');openEditor(b.dataset.open);return;}
  if(b.dataset.add){journalExpanded=b.dataset.add;openEditor(b.dataset.add);return;}
  if(b.dataset.edit){const item=items().find(i=>i.id===b.dataset.edit);if(item)openEditor(item.meal,item.id);return;}
  if(b.dataset.delete){if(confirm('Supprimer cet aliment ?'))update(r=>{r.items=r.items.filter(i=>i.id!==b.dataset.delete)});}
});
$('food-form').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget.elements;const field=k=>f.namedItem(k).value;const unit=field('unit'),quantity=Number(field('quantity')),pieceWeight=Number(field('pieceWeight')),density=Number(field('density'));const grams=unit==='g'?quantity:unit==='piece'?quantity*pieceWeight:quantity*(unit==='cl'?10:1)*density;const v={id:editId||crypto.randomUUID(),meal:mealKey,name:field('name').trim(),family:field('family'),unit,quantity,pieceWeight:unit==='piece'?pieceWeight:null,density:unit==='ml'||unit==='cl'?density:null,grams,meatState:meatFood(field('name').trim())?selectedMeatState:null,kcal:Number(field('kcal')),p:Number(field('p')),c:Number(field('c')),f:Number(field('f'))};if(!v.name||!Number.isFinite(v.grams)||v.grams<=0||['kcal','p','c','f'].some(k=>!Number.isFinite(v[k])||v[k]<0))return;update(r=>{r.items=r.items||[];const index=r.items.findIndex(i=>i.id===editId);if(index>=0)r.items[index]=v;else r.items.push(v)});const existing=db.library.findIndex(f=>norm(f.name)===norm(v.name));const oldFood=existing>=0?db.library[existing]:null;const food={name:v.name,family:v.family,kcal:v.kcal,p:v.p,c:v.c,f:v.f,unit:v.unit,pieceWeight:v.pieceWeight,density:v.density};if(oldFood?.variants){food.variants=structuredClone(oldFood.variants);if(v.meatState)food.variants[v.meatState]={kcal:v.kcal,p:v.p,c:v.c,f:v.f};Object.assign(food,food.variants.raw||food.variants.cooked||{});}if(existing<0)db.library.push(food);db.deletedLibraryNames=db.deletedLibraryNames.filter(n=>n!==norm(food.name));save();closeFoodSuggestions();$('editor').close();journalExpanded=mealKey;page('journal');render();});
$('cancel').onclick=()=>$('editor').close();
$('editor-close').onclick=()=>$('editor').close();
$('food-unit').addEventListener('change',syncUnit);
document.querySelectorAll('[data-meat-state]').forEach(b=>b.addEventListener('click',()=>setMeatState(b.dataset.meatState)));
foodNameInput.addEventListener('input',()=>{if(!meatFood(foodNameInput.value))$('meat-state-field').hidden=true;});
for(const k of ['quantity','pieceWeight','density'])$('food-form').elements.namedItem(k).addEventListener('input',syncUnit);
let libraryStateDraft={};
const libraryKeys=['kcal','p','c','f'];
function captureLibraryState(){const state=$('library-add-state').value;libraryStateDraft[state]=Object.fromEntries(libraryKeys.map(k=>[k,$('library-add-form').elements.namedItem(k).value]));}
function showLibraryState(state){const values=libraryStateDraft[state]||{};for(const k of libraryKeys)$('library-add-form').elements.namedItem(k).value=values[k]??'';$('library-state-help').textContent=state==='single'?'Valeurs pour 100 g, sans distinction cru/cuit.':'Valeurs pour 100 g '+(state==='raw'?'crus':'cuits')+'. Pour enregistrer l’autre état, change le sélecteur.';}
$('library-add-state').addEventListener('change',e=>{const next=e.target.value,old=e.target.dataset.previous||'raw';libraryStateDraft[old]=Object.fromEntries(libraryKeys.map(k=>[k,$('library-add-form').elements.namedItem(k).value]));e.target.dataset.previous=next;showLibraryState(next);});
function prepareLibraryState(food){const select=$('library-add-state');libraryStateDraft=food?.variants?structuredClone(food.variants):food?{single:Object.fromEntries(libraryKeys.map(k=>[k,food[k]??'']))}:{};const state=food?.variants?(food.variants.raw?'raw':'cooked'):food?'single':'raw';select.value=state;select.dataset.previous=state;showLibraryState(state);}
function syncLibraryAddUnit(){const unit=$('library-add-unit').value;const piece=$('library-add-piece-label'),density=$('library-add-density-label');piece.hidden=unit!=='piece';density.hidden=unit!=='ml'&&unit!=='cl';piece.querySelector('input').required=unit==='piece';density.querySelector('input').required=unit==='ml'||unit==='cl';}
$('library-add-unit').addEventListener('change',syncLibraryAddUnit);
$('library-add-open').addEventListener('click',()=>{libraryEditIndex=null;$('library-add-title').textContent='Ajouter à ma bibliothèque';$('library-add-form').reset();syncLibraryAddUnit();prepareLibraryState(null);$('library-add-dialog').showModal();});
$('library-more').addEventListener('click',()=>{libraryShowAll=!libraryShowAll;renderLibrary();});
$('library-add-close').addEventListener('click',()=>$('library-add-dialog').close());
$('library-add-cancel').addEventListener('click',()=>$('library-add-dialog').close());
$('library-add-form').addEventListener('submit',e=>{
  e.preventDefault();
  const form=e.currentTarget;
  const name=form.elements.namedItem('name').value.trim();
  if(!name){alert('Indique le nom de l’aliment.');return;}
  if(db.library.some((f,i)=>i!==libraryEditIndex&&norm(f.name)===norm(name))){alert('Cet aliment existe déjà dans la bibliothèque.');return;}
  const unit=form.elements.namedItem('unit').value;
  const pieceWeight=Number(form.elements.namedItem('pieceWeight').value);
  const density=Number(form.elements.namedItem('density').value);
  if(unit==='piece'&&(!Number.isFinite(pieceWeight)||pieceWeight<=0)){alert('Indique le poids d’une pièce.');return;}
  if((unit==='ml'||unit==='cl')&&(!Number.isFinite(density)||density<=0)){alert('Indique une densité valide.');return;}
  const food={name,family:form.elements.namedItem('family').value,unit,pieceWeight:unit==='piece'?pieceWeight:null,density:unit==='ml'||unit==='cl'?density:null};
  for(const key of ['kcal','p','c','f']){
    const value=Number(form.elements.namedItem(key).value);
    if(!Number.isFinite(value)||value<0){alert('Vérifie les valeurs nutritionnelles.');return;}
    food[key]=value;
  }
  captureLibraryState();
  const state=form.elements.namedItem('foodState').value;
  if(state!=='single'){
    const variants={};
    for(const s of ['raw','cooked']){const values=libraryStateDraft[s];if(!values||libraryKeys.some(k=>values[k]===''||values[k]===undefined))continue;const parsed=Object.fromEntries(libraryKeys.map(k=>[k,Number(values[k])]));if(Object.values(parsed).every(n=>Number.isFinite(n)&&n>=0))variants[s]=parsed;}
    if(!variants[state]){alert('Renseigne les valeurs pour l’état sélectionné.');return;}
    food.variants=variants;
    Object.assign(food,variants.raw||variants.cooked);
  }
  if(libraryEditIndex!==null){const old=db.library[libraryEditIndex];db.library[libraryEditIndex]=food;db.libraryFavorites=db.libraryFavorites.map(n=>n===norm(old.name)?norm(name):n);}else db.library.push(food);
  libraryEditIndex=null;
  db.deletedLibraryNames=db.deletedLibraryNames.filter(n=>n!==norm(name));
  save();renderLibrary();$('library-add-dialog').close();
});
$('food-search').addEventListener('input',renderLibrary);
$('family-filter').addEventListener('change',()=>{libraryShowAll=false;libraryOpen=null;try{localStorage.setItem(LIBRARY_FAMILY_PREF,$('family-filter').value);}catch{}renderLibrary();});
$('complete').onchange=e=>update(r=>r.complete=e.target.checked);
$('day').onchange=e=>{if(/^\d{4}-\d{2}-\d{2}$/.test(e.target.value)){day=e.target.value;render();window.dispatchEvent(new Event('gp:nutrition-updated'));}};
for(const [id,offset] of [['prev',-1],['next',1]])$(id).onclick=()=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+offset);day=isoDate(d);render();window.dispatchEvent(new Event('gp:nutrition-updated'));};
$('export').onclick=()=>{const blob=new Blob([JSON.stringify({format:'prototype-mobile',...nutritionSnapshot()},null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='gros-petard-prototype-'+today()+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
// Plus : sous-pages et réglages.
function showPlusHome(){$('plus-home').hidden=false;$('plus-detail').hidden=true;document.querySelectorAll('[data-plus-panel]').forEach(p=>p.hidden=true);}
function showPlusDetail(name){if(name==='foods'){libraryFromPlus=true;page('menus');return;}$('plus-home').hidden=true;$('plus-detail').hidden=false;document.querySelectorAll('[data-plus-panel]').forEach(p=>p.hidden=p.dataset.plusPanel!==name);if(name==='prefs'){$('pref-unit').value=db.preferences?.unit||'g';$('pref-compact').checked=db.preferences?.compact!==false;}if(name==='reminders'){for(const [id,key] of [['remind-weight','weight'],['remind-measure','measure'],['remind-food','food']])$(id).checked=!!db.reminders?.[key];}window.scrollTo(0,0);}
$('library-back-plus').addEventListener('click',()=>page('plus'));
document.querySelectorAll('[data-plus-open]').forEach(b=>b.addEventListener('click',()=>showPlusDetail(b.dataset.plusOpen)));
$('plus-back').addEventListener('click',()=>{showPlusHome();window.scrollTo(0,0)});
$('save-goals').addEventListener('click',()=>{const values={};for(const k of ['kcal','p','c','f']){const n=Number($('goal-'+k).value);if(!Number.isFinite(n)||n<=0||n>(k==='kcal'?10000:1000)){$('goals-feedback').textContent='Vérifie les quatre valeurs : elles doivent être positives.';return;}values[k]=n;}db.goals=values;save();render();window.dispatchEvent(new Event('gp:nutrition-updated'));$('goals-feedback').textContent='Objectifs enregistrés et jauges mises à jour.';});
$('save-reminders').addEventListener('click',()=>{db.reminders={weight:$('remind-weight').checked,measure:$('remind-measure').checked,food:$('remind-food').checked};save();$('reminders-feedback').textContent='Préférences conservées. Notifications non encore disponibles.';});
$('save-prefs').addEventListener('click',()=>{db.preferences={unit:$('pref-unit').value,compact:$('pref-compact').checked};save();document.body.classList.toggle('gp-spacious',!db.preferences.compact);$('prefs-feedback').textContent='Préférences enregistrées.';});
$('import-data').addEventListener('change',async e=>{const file=e.target.files?.[0];if(!file)return;const feedback=$('backup-feedback');try{if(file.size>5e6)throw Error('Fichier trop volumineux (5 Mo maximum).');const incoming=JSON.parse(await file.text());if(!incoming||incoming.format!=='prototype-mobile'||!incoming.days||typeof incoming.days!=='object'||Array.isArray(incoming.days)||!incoming.goals||typeof incoming.goals!=='object'||!Array.isArray(incoming.library))throw Error('Ce fichier ne correspond pas à une sauvegarde compatible du prototype.');if(!confirm('Remplacer toutes les données de cette version par cette sauvegarde ?')){feedback.textContent='Importation annulée.';return;}db=incoming;db.goals={kcal:1700,p:80,c:225,f:53,...db.goals};db.library=db.library||[];writeStoredData(db);render();window.dispatchEvent(new Event('gp:nutrition-updated'));feedback.textContent='Sauvegarde importée. Les données sont restaurées.';}catch(err){feedback.textContent='Import impossible : '+err.message;}finally{e.target.value='';}});
if(db.preferences?.compact===false)document.body.classList.add('gp-spacious');

render();
