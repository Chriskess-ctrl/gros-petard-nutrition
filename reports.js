// Création de vrais PDF sur l’appareil avec la copie locale de pdf-lib (MIT).
import {analyze,BODY_FIELDS,MEASUREMENT_UNIT,sumMacros,dayDistance,timestamp} from './core.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=(v,d=0)=>v==null?'—':Number(v).toLocaleString('fr-FR',{minimumFractionDigits:d,maximumFractionDigits:d}).replace(/[\u202f\u00a0]/g,' ');
const date=s=>s.split('-').reverse().join('/');
function goals(settings){return [['kcal','Calories','kcal / jour'],['protein','Protéines','g / jour'],['carbs','Glucides','g / jour'],['fat','Lipides','g / jour'],['weight','Poids repère','kg']].filter(([k])=>settings[k]!=null).map(([k,label,unit])=>`${label} : ${fmt(settings[k],1)} ${unit}`);}
export async function createReport(data,options){
  const lib=window.PDFLib;if(!lib)throw Error('Le module PDF n’est pas chargé. Recharge une fois l’application avec une connexion.');
  const {PDFDocument,StandardFonts,rgb}=lib,pdf=await PDFDocument.create(),normal=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold),serif=await pdf.embedFont(StandardFonts.TimesRoman);
  pdf.setTitle('GROS PÉTARD — Journal Nutrition & Silhouette');pdf.setAuthor(options.name||'Journal personnel');pdf.setSubject('Observations personnelles pour le suivi diététique');pdf.setProducer('GROS PÉTARD 2.0 · pdf-lib');
  const ink=rgb(.25,.18,.23),prune=rgb(.46,.27,.36),muted=rgb(.45,.38,.42),rose=rgb(.96,.91,.93),line=rgb(.9,.84,.87),cream=rgb(.99,.975,.955);
  let page,y,unsupported=false;const width=595.28,height=841.89,left=42,right=width-42,content=right-left,bottom=55;
  function clean(text){return Array.from(String(text??'').normalize('NFC').replace(/\r\n?/g,'\n').replace(/\u202f|\u00a0/g,' ').replace(/→/g,' > ').replace(/≤/g,'<=')).map(char=>{if(char==='\n')return char;if(char==='\t')return ' ';if(char.charCodeAt(0)<32)return '';try{normal.encodeText(char);return char;}catch{unsupported=true;return '[symbole]';}}).join('');}
  function textAt(text,x,yy,size=10,font=normal,color=ink){page.drawText(clean(text),{x,y:yy,size,font,color});}
  function newPage(){page=pdf.addPage([width,height]);page.drawRectangle({x:0,y:height-83,width,height:83,color:cream});textAt('GROS PÉTARD',left,height-34,10,bold,prune);textAt('Nutrition & Silhouette · Journal personnel',left,height-52,10,normal,muted);textAt(`${date(options.start)} — ${date(options.end)}`,right-158,height-34,9,normal,muted);page.drawLine({start:{x:left,y:height-74},end:{x:right,y:height-74},thickness:.6,color:line});y=height-105;}
  function ensure(needed){if(y-needed<bottom)newPage();}
  function wrapped(text,size=10,maxWidth=content,font=normal){const output=[];const safe=clean(text);safe.split('\n').forEach(paragraph=>{if(!paragraph){output.push('');return;}let line='';paragraph.split(/ +/).forEach(word=>{if(font.widthOfTextAtSize(word,size)>maxWidth){if(line){output.push(line);line='';}let chunk='';for(const char of word){if(font.widthOfTextAtSize(chunk+char,size)>maxWidth){output.push(chunk);chunk='';}chunk+=char;}line=chunk;return;}const next=line?line+' '+word:word;if(font.widthOfTextAtSize(next,size)>maxWidth){output.push(line);line=word;}else line=next;});if(line)output.push(line);});return output;}
  function paragraph(text,{size=10,font=normal,color=ink,gap=8,indent=0}={}){const lines=wrapped(text,size,content-indent,font),leading=size*1.48;lines.forEach(l=>{ensure(leading);if(l)textAt(l,left+indent,y,size,font,color);y-=leading;});y-=gap;}
  function heading(text,needed=110){ensure(needed);y-=6;paragraph(text,{size:20,font:serif,color:prune,gap:10});}
  function subheading(text){ensure(40);paragraph(text,{size:11,font:bold,color:prune,gap:5});}
  function table(headers,rows,widths){
    const drawRow=(cells,isHead)=>{const size=9,leading=13,pad=7;const lines=cells.map((c,i)=>wrapped(c,size,widths[i]-pad*2,isHead?bold:normal));const rowHeight=Math.max(1,...lines.map(l=>l.length))*leading+pad*2;
      if(y-rowHeight<bottom){newPage();drawRow(headers,true);}if(isHead)page.drawRectangle({x:left,y:y-rowHeight+4,width:content,height:rowHeight,color:rose});
      let x=left;lines.forEach((l,i)=>{l.forEach((t,j)=>textAt(t,x+pad,y-pad-j*leading,size,isHead?bold:normal,isHead?prune:ink));x+=widths[i];});page.drawLine({start:{x:left,y:y-rowHeight+3},end:{x:right,y:y-rowHeight+3},thickness:.4,color:line});y-=rowHeight;
    };
    ensure(70);drawRow(headers,true);rows.forEach(r=>drawRow(r,false));y-=14;
  }
  function chart(points,label,unit){
    const list=points.filter(p=>p.value!=null);if(!list.length)return;ensure(160);subheading(label);const cx=left+37,cw=content-49,ch=104,base=y-112,values=list.map(p=>p.value),lo=Math.min(...values),hi=Math.max(...values),pad=Math.max((hi-lo)*.15,.4),min=lo-pad,max=hi+pad;
    const times=list.map(p=>new Date(p.date+'T12:00:00Z').getTime()),first=Math.min(...times),last=Math.max(...times),xx=t=>cx+(last===first?cw/2:(t-first)/(last-first)*cw),yy=v=>base+(v-min)/(max-min)*ch;
    [0,.5,1].forEach(t=>{const py=base+t*ch;page.drawLine({start:{x:cx,y:py},end:{x:cx+cw,y:py},color:line,thickness:.5});textAt(fmt(min+t*(max-min),1),left,py-3,8,normal,muted);});
    list.forEach((p,i)=>{if(i)page.drawLine({start:{x:xx(times[i-1]),y:yy(list[i-1].value)},end:{x:xx(times[i]),y:yy(p.value)},color:prune,thickness:1.7});page.drawCircle({x:xx(times[i]),y:yy(p.value),size:2.8,color:prune});});
    textAt(date(list[0].date),cx,base-15,8,normal,muted);textAt(date(list.at(-1).date),cx+cw-50,base-15,8,normal,muted);textAt(unit,left,y-7,8,normal,muted);y=base-33;
  }

  const a=analyze(data,options.start,options.end),body=data.body.filter(e=>e.date>=options.start&&e.date<=options.end).sort((a,b)=>a.date.localeCompare(b.date));
  newPage();heading('Mon bilan de la période');
  if(options.name)paragraph(options.name,{size:12,font:bold});
  paragraph('Apports et mesures estimés ou déclarés. Ce journal décrit les données saisies et ne constitue pas une prescription médicale.',{size:9,color:muted});
  subheading('Couverture du journal');paragraph(`${dayDistance(options.start,options.end)+1} jours dans la période · ${a.complete.length} journées alimentaires complètes · ${a.days.filter(d=>!d.complete&&d.meals>0).length} journées alimentaires partielles · ${a.hungers.length} notes de faim · ${a.weightCount} pesées.`);
  paragraph('Les moyennes alimentaires utilisent uniquement les journées marquées complètes. Les dates non renseignées ne comptent pas pour zéro.',{size:9,color:muted});
  table(['Moyennes / jour complet','kcal','Prot. g','Gluc. g','Lip. g'],[['Apports notés',fmt(a.means.k),fmt(a.means.p,1),fmt(a.means.c,1),fmt(a.means.f,1)]],[191,80,80,80,80.28]);
  paragraph(`Faim moyenne des notes : ${fmt(a.hungerMean,1)}/10. Variation entre première et dernière pesée : ${a.weightDelta>0?'+':''}${fmt(a.weightDelta,1)} kg.`,{size:10});
  const g=goals(data.settings);subheading('Mes repères personnels, facultatifs');paragraph(g.length?g.join(' · '):'Aucun repère chiffré renseigné.',{size:9});paragraph('Ces valeurs sont saisies par l’utilisatrice et restent modifiables ; l’application ne les valide ni ne les ajuste automatiquement.',{size:9,color:muted});
  if(options.note){heading('Ce que je souhaite aborder');paragraph(options.note);}
  heading('Mes observations');
  a.hours.filter(h=>h.count).forEach(h=>paragraph(`${h.name} : faim moyenne ${fmt(h.mean,1)}/10 · ${h.count} sensations.`,{size:9,gap:3}));
  if(a.timing.earlyN>=2&&a.timing.lateN>=2)paragraph(`Après le dernier repas : ${fmt(a.timing.early,1)}/10 dans les 2 h (${a.timing.earlyN} notes), ${fmt(a.timing.late,1)}/10 entre 2 et 6 h (${a.timing.lateN} notes).`);
  if(a.sport.withN>=2&&a.sport.withoutN>=2)paragraph(`Faim les jours avec séance : ${fmt(a.sport.with,1)}/10 (${a.sport.withN} jours). Sans séance : ${fmt(a.sport.without,1)}/10 (${a.sport.withoutN} jours). Activité renseignée dans les deux groupes.`);
  a.satiety.slice(0,5).forEach(s=>paragraph(`${s.name} : satiété moyenne ${fmt(s.mean,1)}/10 sur ${s.count} repas.`,{size:9,gap:3}));
  a.contexts.slice(0,6).forEach(c=>paragraph(`Contexte « ${c.name} » : faim moyenne ${fmt(c.mean,1)}/10 · ${c.count} notes.`,{size:9,gap:3}));
  if(a.bodyLink.correlation!=null)paragraph(`Apports hebdomadaires et variation du poids moyen la semaine suivante : r = ${fmt(a.bodyLink.correlation,2)} sur ${a.bodyLink.count} paires de semaines. Au moins 3 journées complètes et 2 pesées dans chaque semaine.`,{size:9});
  paragraph('Associations descriptives, sans preuve de cause. Les observations dépendent des notes disponibles. Le poids ne permet pas de distinguer eau, graisse et muscle. Aucun déficit ni besoin énergétique n’est estimé.',{size:9,color:muted});
  heading('Poids moyen par semaine',235);
  const weights=a.weeks.filter(w=>w.weight!=null);chart(weights.map(w=>({date:w.date,value:w.weight})),'Moyennes des pesées disponibles','kg');
  if(weights.length)table(['Semaine du lundi','Poids moyen kg','Pesées'],weights.map(w=>[date(w.date),fmt(w.weight,2),String(w.weighings)]),[230,170,111.28]);else paragraph('Aucune pesée dans la période.');
  heading('Repères croisés par semaine');
  if(a.weeks.length)table(['Lundi','kcal / j complet','J. complets','Faim /10','Sport min','Taille cm'],a.weeks.map(w=>[date(w.date),fmt(w.kcal),String(w.completeDays),fmt(w.hungerMean,1),String(w.sport),fmt(w.waist,1)]),[89,103,80,80,79,80.28]);else paragraph('Aucune semaine renseignée.');
  paragraph('Les semaines peuvent être partielles aux limites de la période. Taille : dernière mesure de la semaine. Faim : moyenne des notes saisies ; sport : durée des séances notées.',{size:8,color:muted});
  heading('Mes apports jour par jour');
  if(a.days.length)table(['Date','Saisie','kcal','P g','G g','L g'],a.days.map(d=>[date(d.date),d.complete?'Complète':'Partielle',fmt(d.k),fmt(d.p,1),fmt(d.c,1),fmt(d.f,1)]),[98,93,80,80,80,80.28]);else paragraph('Aucun repas ou état de journée renseigné.');
  heading('Mes mensurations');
  if(body.length)body.forEach(b=>{ensure(82);subheading(date(b.date));paragraph(Object.keys(BODY_FIELDS).filter(k=>b[k]!=null).map(k=>`${BODY_FIELDS[k]} : ${fmt(b[k],1)} ${MEASUREMENT_UNIT(k)}`).join(' · '),{size:9});if(b.note)paragraph(b.note,{size:9,color:muted});});else paragraph('Aucune mesure dans la période.');
  if(options.detail){
    heading('Le détail de mon journal');
    const dates=[...new Set([...a.entries.map(e=>e.date),...Object.keys(data.days).filter(d=>d>=options.start&&d<=options.end&&data.days[d].note)])].sort();
    if(!dates.length)paragraph('Aucun événement enregistré pour cette période.');
    dates.forEach(d=>{
      ensure(130);subheading(date(d)+(data.days[d]?.complete?' · alimentation complète':' · saisie partielle'));
      if(data.days[d]?.note)paragraph('Mon mot du jour : '+data.days[d].note,{size:9,color:muted});
      a.entries.filter(e=>e.date===d).sort((a,b)=>timestamp(a)-timestamp(b)).forEach(e=>{
        ensure(60);
        if(e.kind==='meal'){
          paragraph(`${e.time} · ${e.meal}${e.name?' · '+e.name:''}`,{font:bold,size:10,gap:3});
          e.items.forEach(i=>paragraph(`${i.name} : ${fmt(i.qty,1)} ${i.unit==='portion'?'portion(s)':i.unit} = ${fmt(i.amount,1)} ${i.baseUnit}, ${i.basis}. ${fmt(i.k)} kcal · P ${fmt(i.p,1)} · G ${fmt(i.c,1)} · L ${fmt(i.f,1)} g.`,{size:9,indent:10,gap:3}));
          const total=sumMacros(e.items);paragraph(`Total : ${fmt(total.k)} kcal · P ${fmt(total.p,1)} · G ${fmt(total.c,1)} · L ${fmt(total.f,1)} g. Faim avant : ${fmt(e.hunger)}/10 ; satiété après : ${fmt(e.satiety)}/10${e.duration!=null?'; durée : '+fmt(e.duration)+' min':''}.`,{size:9,indent:10,gap:4});
        }
        if(e.kind==='hunger'){
          paragraph(`${e.time} · Faim ${fmt(e.intensity)}/10 · ${e.type} · ${e.period}`,{font:bold,size:10,gap:4});
          if(e.physical.length)paragraph('Sensations physiques : '+e.physical.join(', '),{size:9,indent:10,gap:3});if(e.emotions.length)paragraph('Émotions / état : '+e.emotions.join(', '),{size:9,indent:10,gap:3});if(e.context)paragraph('Contexte : '+e.context,{size:9,indent:10,gap:3});
        }
        if(e.kind==='sport')paragraph(`${e.time} · ${e.type} · ${fmt(e.duration)} min${e.effort!=null?' · effort '+fmt(e.effort)+'/10':''}`,{font:bold,size:10,gap:4});
        if(e.note)paragraph(e.note,{size:9,indent:10,color:muted,gap:7});else y-=5;
      });
    });
  }
  heading('Comment lire ce journal',230);
  paragraph('Faim : 0 = aucune, 10 = très forte. Satiété : 0 = aucune, 10 = sensation très pleine. Effort : 0 = très facile, 10 = maximal. Ces échelles sont personnelles.',{size:9,color:muted});
  paragraph('Les nutriments sont calculés à partir des quantités et des références alimentaires choisies, pour 100 g ou 100 ml. Cru, cuit et égoutté sont distingués ; aucune conversion de cuisson n’est appliquée. Les valeurs d’étiquette et les recettes précises améliorent les estimations.',{size:9,color:muted});
  if(unsupported)paragraph('Certains pictogrammes ou caractères hors de l’alphabet pris en charge ont été remplacés par [symbole]. Le journal original reste inchangé.',{size:8,color:muted});
  const pages=pdf.getPages();pages.forEach((p,i)=>{p.drawLine({start:{x:left,y:40},end:{x:right,y:40},thickness:.4,color:line});p.drawText('Journal privé · partage au choix de l’utilisatrice',{x:left,y:27,size:8,font:normal,color:muted});p.drawText(`${i+1} / ${pages.length}`,{x:right-35,y:27,size:8,font:normal,color:muted});});
  return pdf.save();
}

export function printReport(data,options){
  const popup=window.open('','_blank');if(!popup)throw Error('Chrome a bloqué la fenêtre. Autorise les fenêtres pour cette application ou télécharge directement le PDF.');popup.opener=null;
  const a=analyze(data,options.start,options.end),body=data.body.filter(b=>b.date>=options.start&&b.date<=options.end).sort((a,b)=>a.date.localeCompare(b.date));
  const table=(headers,rows)=>`<table><thead><tr>${headers.map(h=>'<th>'+esc(h)+'</th>').join('')}</tr></thead><tbody>${rows.map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>').join('')}</tbody></table>`;
  let html=`<h1>GROS PÉTARD</h1><p class="subtitle">Nutrition & Silhouette · ${date(options.start)} au ${date(options.end)}</p>${options.name?'<h2>'+esc(options.name)+'</h2>':''}<p>${a.complete.length} journées complètes · ${a.hungers.length} notes de faim · ${a.weightCount} pesées. Les moyennes alimentaires excluent les journées partielles et non renseignées.</p><h2>Mes apports moyens</h2>${table(['kcal','Protéines g','Glucides g','Lipides g'],[[fmt(a.means.k),fmt(a.means.p,1),fmt(a.means.c,1),fmt(a.means.f,1)]])}<p>Faim moyenne : ${fmt(a.hungerMean,1)}/10. Variation entre première et dernière pesée : ${fmt(a.weightDelta,1)} kg.</p><h2>Mes repères facultatifs</h2><p>${esc(goals(data.settings).join(' · ')||'Aucun repère renseigné.')}</p>${options.note?'<h2>Ce que je souhaite aborder</h2><p class="note">'+esc(options.note)+'</p>':''}<h2>Par semaine</h2>${table(['Lundi','Poids moyen kg','Pesées','kcal / j complet','J. complets','Faim /10','Sport min'],a.weeks.map(w=>[date(w.date),fmt(w.weight,2),w.weighings,fmt(w.kcal),w.completeDays,fmt(w.hungerMean,1),w.sport]))}<h2>Jour par jour</h2>${table(['Date','Saisie','kcal','P g','G g','L g'],a.days.map(d=>[date(d.date),d.complete?'Complète':'Partielle',fmt(d.k),fmt(d.p,1),fmt(d.c,1),fmt(d.f,1)]))}<h2>Mes mesures</h2>${body.map(b=>`<article><strong>${date(b.date)}</strong><p>${Object.keys(BODY_FIELDS).filter(k=>b[k]!=null).map(k=>`${BODY_FIELDS[k]} : ${fmt(b[k],1)} ${MEASUREMENT_UNIT(k)}`).join(' · ')}</p><p class="note">${esc(b.note)}</p></article>`).join('')}`;
  if(options.detail)html+='<h2>Détail du journal</h2>'+a.entries.slice().sort((a,b)=>timestamp(a)-timestamp(b)).map(e=>{
    let details='';if(e.kind==='meal')details=e.items.map(i=>`${i.name} : ${fmt(i.amount,1)} ${i.baseUnit} (${i.basis}), ${fmt(i.k)} kcal · P ${fmt(i.p,1)} · G ${fmt(i.c,1)} · L ${fmt(i.f,1)} g`).join('\n')+`\nFaim avant ${fmt(e.hunger)}/10, satiété après ${fmt(e.satiety)}/10.`;
    if(e.kind==='hunger')details=`Faim ${e.intensity}/10 · ${e.type} · ${e.period}\n${e.physical.join(', ')}\n${e.emotions.join(', ')}\n${e.context}`;
    if(e.kind==='sport')details=e.type+' · '+e.duration+' min'+(e.effort!=null?' · effort '+e.effort+'/10':'');
    return `<article><strong>${date(e.date)} · ${esc(e.time)} · ${esc(e.name||e.meal||e.type)}</strong><p class="note">${esc(details)}</p>${e.note?'<p class="note">'+esc(e.note)+'</p>':''}</article>`;
  }).join('')+Object.entries(data.days).filter(([d,v])=>d>=options.start&&d<=options.end&&v.note).map(([d,v])=>`<p class="note"><strong>${date(d)} · mot du jour</strong><br>${esc(v.note)}</p>`).join('');
  html+='<footer>Journal personnel privé. Données déclarées, valeurs nutritionnelles indicatives. Faim et satiété : 0 = aucune, 10 = très forte / très pleine. Les observations ne prouvent pas une causalité et ne constituent pas des prescriptions médicales.</footer>';
  popup.document.write(`<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Rapport GROS PÉTARD</title><style>@page{size:A4;margin:16mm}body{font:11px/1.6 system-ui,sans-serif;color:#402f3b;max-width:760px;margin:25px auto}h1,h2{color:#75465d}h1{font-size:28px;letter-spacing:2px}h2{font:24px Georgia,serif;margin-top:24px}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border-bottom:1px solid #eadce2;padding:8px;text-align:left}th{background:#f6e9ef}thead{display:table-header-group}tr,article{break-inside:avoid}article{padding:12px 0;border-bottom:1px solid #eee}.note{white-space:pre-wrap;overflow-wrap:anywhere}footer{font-size:9px;margin-top:25px;color:#75616d}@media screen{body{padding:20px}}@media print{body{margin:0}}</style></head><body>${html}</body></html>`);popup.document.close();setTimeout(()=>{popup.focus();popup.print();},300);
}
