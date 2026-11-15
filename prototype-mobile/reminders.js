'use strict';
(() => {
  const root = document.querySelector('[data-plus-panel="reminders"]');
  if (!root) return;
  const defaults = {
    weight:{enabled:false,frequency:'weekly',day:'1',time:'07:30'},
    measure:{enabled:false,frequency:'monthly',day:'1',time:'08:00'},
    food:{enabled:false,frequency:'daily',day:'1',time:'20:00'}
  };
  const key='gp-nutrition-reminder-schedules-v1';
  let saved={}; try {saved=JSON.parse(localStorage.getItem(key))||{}}catch{}
  const config=Object.fromEntries(Object.entries(defaults).map(([k,v])=>[k,{...v,...(saved[k]||{})}]));
  root.innerHTML='<div hidden><input type="checkbox" id="remind-weight"><input type="checkbox" id="remind-measure"><input type="checkbox" id="remind-food"><button type="button" id="save-reminders">Sauvegarde historique</button><p id="reminders-feedback"></p></div><h1>🔔 Mes rappels</h1><p class="plus-note">Choisis tes horaires. Les rappels sont enregistrés sur cet appareil. Les notifications en arrière-plan seront disponibles après activation du service Push.</p><div id="reminder-cards"></div><button type="button" id="reminder-save-schedules" class="primary">Enregistrer les rappels</button><button type="button" id="reminder-test-notification">Tester une notification</button><p id="reminder-status" role="status" aria-live="polite" class="plus-feedback"></p>';
  const labels={weight:['⚖️','Pesée'],measure:['📏','Mensurations'],food:['🍽️','Repas']};
  const days=['Dimanche','Lundi','Mardi','Mercredi','Jeudi','Vendredi','Samedi'];
  const cards=document.getElementById('reminder-cards');
  for(const [k,v] of Object.entries(config)){
    const article=document.createElement('section'); article.className='reminder-card';
    article.innerHTML='<label class="reminder-head"><span>'+labels[k].join(' ')+'</span><input type="checkbox" data-field="enabled"></label><div class="reminder-options"><label>Fréquence<select data-field="frequency"><option value="daily">Chaque jour</option><option value="weekly">Chaque semaine</option><option value="monthly">Chaque mois</option></select></label><label class="reminder-day">Jour<select data-field="day"></select></label><label>Heure<input type="time" data-field="time" required></label></div>';
    const day=article.querySelector('[data-field="day"]');
    day.innerHTML=days.map((d,i)=>'<option value="'+i+'">'+d+'</option>').join('');
    article.querySelector('[data-field="enabled"]').checked=!!v.enabled;
    article.querySelector('[data-field="frequency"]').value=v.frequency;
    article.querySelector('[data-field="time"]').value=v.time;
    day.value=v.day;
    const sync=()=>{const f=article.querySelector('[data-field="frequency"]').value;article.querySelector('.reminder-day').hidden=f==='daily';day.innerHTML=(f==='monthly'?Array.from({length:31},(_,i)=>'<option value="'+(i+1)+'">'+(i+1)+' du mois</option>').join(''):days.map((d,i)=>'<option value="'+i+'">'+d+'</option>').join(''));day.value=v.day;if(!day.value)day.selectedIndex=0;article.querySelector('.reminder-options').hidden=!article.querySelector('[data-field="enabled"]').checked;};
    article.querySelector('[data-field="frequency"]').addEventListener('change',sync);
    article.querySelector('[data-field="enabled"]').addEventListener('change',sync);
    sync();cards.append(article);article.dataset.reminder=k;
  }
  const status=document.getElementById('reminder-status');
  document.getElementById('reminder-save-schedules').addEventListener('click',()=>{
    for(const article of cards.children){
      const v=config[article.dataset.reminder];
      for(const field of ['enabled','frequency','day','time']){const el=article.querySelector('[data-field="'+field+'"]');v[field]=field==='enabled'?el.checked:el.value;}
      if(!/^([01]\\d|2[0-3]):[0-5]\\d$/.test(v.time)){status.textContent='Heure invalide.';return;}
    }
    try{localStorage.setItem(key,JSON.stringify(config));status.textContent='Horaires enregistrés sur ce Samsung. Envoi automatique en arrière-plan non encore actif.';}catch{status.textContent='Impossible de sauvegarder sur cet appareil.';}
  });
  document.getElementById('reminder-test-notification').addEventListener('click',async()=>{
    if(!('Notification' in window)||!('serviceWorker' in navigator)){status.textContent='Notifications non prises en charge dans ce navigateur.';return;}
    try{
      const permission=Notification.permission==='default'?await Notification.requestPermission():Notification.permission;
      if(permission!=='granted'){status.textContent='Autorise les notifications dans les réglages Samsung.';return;}
      const registration=await navigator.serviceWorker.ready;
      await registration.showNotification('GROS PÉTARD — Nutrition',{body:'🔔 Notification de test réussie !',icon:'../icon-192.png',tag:'gp-reminder-test',data:{url:'./index.html'}});
      status.textContent='Notification de test envoyée à Samsung.';
    }catch(e){status.textContent='Test impossible : '+(e.message||'erreur navigateur');}
  });
})();
