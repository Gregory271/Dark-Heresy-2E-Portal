import {rollSheetDice, sendSheetText} from './sheet-chat.mjs';
import {ammoWeapon, ammunitionState, setAmmunition, reloadAmmunition} from './ammunition.mjs';
export const chatControlMarkup = '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true" focusable="false"><path d="M3 3h14v10H8l-5 4V3Z" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M6 7h8M6 10h5" stroke="currentColor" stroke-width="1.5"/></svg><span>Chat</span>';
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const canEdit = actor => Boolean(actor?.isOwner || game.user.isGM);
const number = (value, fallback=0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
export function characteristicValue(actor, key) {
  const c=actor.system?.characteristics?.[key];
  return c ? number(c.total, number(c.base)+5*number(c.advance)+number(c.modifier)) : 0;
}
export function armourLocations(actor) {
  const tb = number(actor.system?.characteristics?.toughness?.bonus, Math.floor(characteristicValue(actor,'toughness')/10)+number(actor.system?.characteristics?.toughness?.unnatural));
  const items = Array.from(actor.items?.contents || actor.items || []);
  return [['head','Head'],['leftArm','Left arm'],['body','Body'],['rightArm','Right arm'],['leftLeg','Left leg'],['rightLeg','Right leg']].map(([id,label])=>{
    const native=actor.system?.armour?.[id];
    const ap=number(native?.value,Math.max(0,...items.filter(i=>i.type==='armour'&&i.system?.equipped).map(i=>number(i.system.armourPoints?.[id]))));
    const toughness=number(native?.toughnessBonus,tb);
    const total=number(native?.total,ap+toughness);
    const extra=total-ap-toughness;
    return {id,label,ap,toughness,total,extra:extra?`${extra>0?'+':''}${extra} other`:''};
  });
}
export function skillRows(actor) {
  const rows=[];
  for(const [key,s] of Object.entries(actor.system?.skills || {})) {
    const c=Object.entries(actor.system.characteristics || {}).find(([k,c])=>[k,c.short].includes(s.characteristic));
    const base=c?characteristicValue(actor,c[0]):0;
    for(const [speciality,entry] of s.isSpecialist?Object.entries(s.specialities || {}):[['',s]]) {
      if(!number(entry.advance) && !entry.taken) continue;
      rows.push({key,speciality,label:speciality?`${s.label} (${entry.label})`:s.label||key,target:number(entry.current,base+(number(entry.advance)?(number(entry.advance)-1)*10:-20))});
    }
  }
  return rows.sort((a,b)=>a.label.localeCompare(b.label));
}
export function weaponModes(item) {
  if(String(item.system?.class).toLowerCase()==='melee') return [{id:'standard',label:'Standard attack · Half',bonus:10,hits:1},{id:'charge',label:'Charge · Full',bonus:20,hits:1},{id:'all-out',label:'All-out attack · Full (no Dodge/Parry)',bonus:30,hits:1},{id:'called',label:'Called shot · Full',bonus:-20,hits:1}];
  const r=item.system?.rateOfFire || {};
  const modes=[];
  if(number(r.single)) modes.push({id:'standard',label:'Standard attack · Half',bonus:10,hits:1});
  if(number(r.burst)) modes.push({id:'semi',label:'Semi-auto burst · Half',bonus:0,hits:number(r.burst)});
  if(number(r.full)) modes.push({id:'full',label:'Full-auto burst · Half',bonus:-10,hits:number(r.full)});
  if(!modes.length) modes.push({id:'standard',label:'Attack (check weapon profile)',bonus:0,hits:1});
  modes.push({id:'called',label:'Called shot · Full',bonus:-20,hits:1});
  return modes;
}
export function damagePool(actor,item,formula) {
  let text=String(formula ?? item.flags?.dh2CharacterBuilder?.printedDamage ?? item.system?.damage ?? '').trim();
  const sb=Math.floor(characteristicValue(actor,'strength')/10)+number(actor.system?.characteristics?.strength?.unnatural);
  text=text.replace(/\bSB\b/gi,String(sb)).replace(/\bPR\b/gi,String(actor.system?.psy?.rating||0)).replace(/\s/g,'');
  const m=text.match(/^(\d+)d(5|10)((?:[+-]\d+)*)$/i);
  if(!m) throw Error('Enter damage as dice plus numbers, for example 1d10+4. Resolve variable psychic damage from its rules.');
  let modifier=(m[3].match(/[+-]\d+/g)||[]).reduce((n,s)=>n+Number(s),0);
  // Printed profile damage already includes SB. Native weapon formula does not.
  if(formula == null && !item.flags?.dh2CharacterBuilder?.printedDamage && String(item.system?.class).toLowerCase()==='melee' && !/\bSB\b/i.test(item.system.damage)) modifier+=sb;
  const qualities=[item.flags?.dh2CharacterBuilder?.weaponQualities,item.system?.description,...Array.from(item.items?.contents||item.items||[]).map(i=>i.name)].join(' ');
  const keep=Number(m[1]), tearing=/\bTearing\b/i.test(qualities), primitive=Number(qualities.match(/Primitive\s*\(?\s*(\d+)/i)?.[1]||0);
  return {quantity:keep+(tearing?1:0),sides:Number(m[2]),damage:{keep,primitive,modifier}};
}
function modal(actor,title,content,buttons) {
  const dialog=document.createElement('dialog'); dialog.className='dh2-combat-dialog';
  dialog.setAttribute('aria-label',title);
  dialog.innerHTML=`<form><header><h2>${escapeHTML(title)}</h2><button type="button" data-close aria-label="Close">×</button></header><div class="dh2-combat-content">${content}</div><p role="alert" data-error></p><footer></footer></form>`;
  document.body.append(dialog);
  const close=()=>{dialog.close();dialog.remove();};
  dialog.querySelector('[data-close]').onclick=close;
  dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
  dialog.querySelector('form').addEventListener('submit',event=>event.preventDefault());
  for(const [label,action] of buttons) {
    const b=document.createElement('button');b.type='button';b.textContent=label;
    if(label==='Send to Chat') { b.className='dh2-chat-share'; b.innerHTML=chatControlMarkup; b.title='Send this description to chat (no roll)'; b.setAttribute('aria-label',`Send to Chat: ${title}`); }
    b.onclick=async()=>{if(!canEdit(actor)) return; b.disabled=true;try{await action(new FormData(dialog.querySelector('form')));close();}catch(e){dialog.querySelector('[data-error]').textContent=e.message;b.disabled=false;}};
    dialog.querySelector('footer').append(b);
  }
  dialog.showModal();return dialog;
}
const input=(label,name,value,extra='')=>`<label>${escapeHTML(label)}<input name="${name}" type="number" value="${escapeHTML(value)}" ${extra}></label>`;
export function openTest(actor,{title,target,weapon=null,psychic=false}) {
  if(!canEdit(actor)) return;
  const modes=weapon?weaponModes(weapon):[];
  const crew=actor.type==='vehicle';
  const bonus=number(actor.flags?.dh2CharacterBuilder?.combatModifier);
  const content=`<div class="dh2-combat-fields">${input(crew?'Crew test target (required)':'Base target','target',crew?'':target,'required')}${input('Situational modifier','modifier',0)}${input('Persistent sheet modifier','persistent',bonus)}${modes.length?`<label>Action<select name="mode">${modes.map(m=>`<option value="${m.id}">${escapeHTML(m.label)} (${m.bonus>=0?'+':''}${m.bonus})</option>`).join('')}</select></label><label>Aim<select name="aim"><option value="0">None</option><option value="10">Half action (+10)</option><option value="20">Full action (+20)</option></select></label>`:''}</div><p>${psychic?'Enter the final Focus Power target for your chosen psychic strength. Phenomena, Perils, opposed rolls and power effects are resolved separately.':crew?'Enter the gunner’s BS or driver’s Operate target, including their training. No player character is selected implicitly.':'Derived characteristics and skills include the system’s current adjustments. Add range, cover, wounds and other situational modifiers once.'}</p>${weapon?'<p>Hit counts are before evasion. Apply ammunition, jams, target defences and special qualities separately. Aim is only valid where the chosen action permits it.</p>':''}`;
  modal(actor,title,content.replace('Apply ammunition, jams, target defences and special qualities separately.','Ammunition is spent automatically for weapons with a clip. Resolve jams, target defences and special qualities separately.'),[['Roll to Chat',async data=>{
    if(String(data.get('target')).trim()==='') throw Error('Enter the crew test target.');
    const values=['target','modifier','persistent'].map(k=>Number(data.get(k)));if(values.some(v=>!Number.isFinite(v)||Math.abs(v)>1000)) throw Error('Enter valid target and modifier values.');
    const mode=modes.find(m=>m.id===data.get('mode'));
    const aim=number(data.get('aim'));
    await rollSheetDice(actor,{title:`${title}${mode?' — '+mode.label:''}`,quantity:1,sides:100,target:values.reduce((a,b)=>a+b,0)+(mode?.bonus||0)+aim,attack:mode?{mode:mode.id,maxHits:mode.hits}:undefined,ammunition:weapon?{id:weapon.id,mode:mode.id}:undefined});
    actor.sheet?.render(false);
  }]]);
}
export function openAmmunition(actor, ref) {
  const item=ammoWeapon(actor,ref), state=ammunitionState(item);
  if (!state.capacity) throw Error('This weapon has no ammunition capacity recorded.');
  modal(actor,`${item.name} — Ammunition`, `<div class="dh2-combat-fields">${input('Loaded','loaded',state.loaded,`min="0" max="${state.capacity}" required`)}${input('Spare rounds / charges','reserve',state.reserve,'min="0" max="100000" required')}</div><p>Capacity ${state.capacity}. Spare ammunition is allocated to this weapon, not shared with other weapons. Record only ammunition you own.</p><p>Reload transfers spare ammunition into the weapon, retaining unspent rounds. Apply the weapon’s reload action time. Special ammunition, overcharge, jams and discarded magazines require manual adjustment.</p>`, [['Save totals', async data=>{
    if(['loaded','reserve'].some(k=>String(data.get(k)).trim()===''))throw Error('Enter both ammunition totals.');
    await setAmmunition(actor,ref,Number(data.get('loaded')),Number(data.get('reserve')));
  }], ['Reload from saved reserves', async()=>{await reloadAmmunition(actor,ref); actor.sheet?.render(false);}]]);
}
export function openItem(actor,item) {
  if(!item)return;
  const raw=item.flags?.dh2CharacterBuilder?.sourceText||item.system?.benefit||item.system?.description||'No description recorded.';
  const text=document.createElement('div');text.innerHTML=raw;
  const description=text.textContent;
  const buttons=canEdit(actor)?[['Send to Chat',()=>sendSheetText(actor,{title:item.name,text:description})]]:[];
  modal(actor,item.name,`<p class="dh2-rule-description">${escapeHTML(description)}</p>`,buttons);
}
export function openDamage(actor,item) {
  if(!canEdit(actor))return;
  let pool, supported=true;try{pool=damagePool(actor,item);}catch{supported=false;pool={quantity:1,sides:10,damage:{keep:1,modifier:0,primitive:0}};}
  const formula=supported?`${pool.damage.keep}d${pool.sides}${pool.damage.modifier>=0?'+':''}${pool.damage.modifier}`:'';
  modal(actor,`${item.name} — Damage`,`<label>Damage (includes Strength Bonus when relevant)<input name="formula" value="${escapeHTML(formula)}" required></label><div class="dh2-combat-fields">${input('Extra dice (e.g. Tearing)','extra',pool.quantity-pool.damage.keep,'min="0" max="5"')}${input('Primitive cap (0 = none)','primitive',pool.damage.primitive,'min="0" max="10"')}</div><p>Raw damage only. Penetration: ${escapeHTML(item.system.penetration||0)}. Apply armour, Toughness, force fields and special effects to the target separately. Roll again for additional hits.</p>`,[['Roll Damage',async data=>{
    const p=damagePool(actor,item,String(data.get('formula')));
    p.quantity=p.damage.keep+Number(data.get('extra'));p.damage.primitive=Number(data.get('primitive'));
    await rollSheetDice(actor,{...p,title:`${item.name} — Damage (Pen ${item.system.penetration||0})`});
  }]]);
}
export async function changeResource(actor,path,value) {
  if(!canEdit(actor))throw Error('You do not own this Actor.');
  if(!['system.wounds.value','system.wounds.critical','system.fatigue.value','system.fate.value','system.integrity.value','system.integrity.critical'].includes(path))throw Error('Unsupported resource.');
  const n=Number(value);if(!Number.isInteger(n)||n<0||n>10000)throw Error('Enter a non-negative whole number.');
  await actor.update({[path]:n});
}

export async function updateCombatField(actor,path,value) {
  if(!canEdit(actor))throw Error('You do not own this Actor.');
  const strings=['name','flags.dh2CharacterBuilder.combatNotes','system.crew'];
  const numbers=['system.wounds.value','system.wounds.max','system.wounds.critical','system.fatigue.value','system.fate.value','system.fate.max','system.integrity.value','system.integrity.max','system.integrity.critical','system.front','system.side','system.rear','system.manoeuverability','system.psy.rating','system.speed.tactical','flags.dh2CharacterBuilder.combatModifier'];
  if(strings.includes(path)) {
    if(path==='name'&&!String(value).trim())throw Error('Enter a name.');
    return actor.update({[path]:String(value).slice(0,path==='name'?200:5000)});
  }
  if(!numbers.includes(path))throw Error('Unsupported field.');
  const n=Number(value);
  if(String(value).trim()===''||!Number.isInteger(n)||Math.abs(n)>10000||(!['flags.dh2CharacterBuilder.combatModifier','system.manoeuverability'].includes(path)&&n<0))throw Error('Enter a valid whole number.');
  return actor.update({[path]:n});
}
