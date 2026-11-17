/* AVS R2.4 clean image-prompt compiler. Archive packets are READ-ONLY source facts.
   Never serialize a dossier object into the final image prompt. */
const str=(v,max=240)=>String(v??'').replace(/[\u0000-\u001f]+/g,' ').trim().slice(0,max);
const valid=v=>{const s=str(v,350);return s&&!/^(?:尚未确认|尚未确定|待确认|不详|未知|未提及|unknown|none|null|undefined|N\/A|无)$/i.test(s)?s:''};
const unpack=x=>{let v=x;for(let n=0;n<3&&typeof v==='string';n++){try{v=JSON.parse(v)}catch{return {}}}return v&&typeof v==='object'&&!Array.isArray(v)?v:{}};
const path=(o,...parts)=>parts.reduce((v,k)=>v?.[k],o);
const datum=(o,...paths)=>{for(const p of paths){const v=path(o,...p.split('.'));if(typeof v==='string'||typeof v==='number'){const value=valid(v);if(value)return value}}return ''};
const clothes=x=>{const current=unpack(x.current);const slots=path(current,'outfit','slots')||{};const labels=[];
 for(const k of ['outerwear','one_piece','top','bottom','hosiery','footwear','extra_layers']){
  const v=slots[k];const a=Array.isArray(v)?v:[v];for(const item of a)if(item){const text=typeof item==='string'?valid(item):valid(item.name||item.design?.description);if(text&&!labels.includes(text))labels.push(text)}
 }
 const ensemble=path(current,'outfit','ensemble');if(typeof ensemble==='string'&&valid(ensemble))labels.unshift(valid(ensemble));
 return labels.slice(0,8);
};
export function extractCharacterFacts(packet){const x=unpack(packet),p=path(x,'canon','physical_design')||{};
 const current=unpack(x.current),face=p.face||{},hair=p.natural_hair||{},body=p.body||{},appear=p.appearance||{};
 const name=datum(x,'name','identity.name')||'未命名角色';
 const anchors=[
  datum(hair,'color'),datum(hair,'length'),datum(current,'hair.current_style'),
  datum(face,'face_shape'),datum(face,'eyes'),datum(face,'iris'),
  datum(appear,'skin_tone'),datum(body,'height'),datum(body,'body_type')||datum(x,'identity.body_type'),
  datum(body,'waist'),datum(body,'hips'),datum(body,'bust'),
  datum(current,'makeup.name'),datum(current,'manicure.name')
 ].filter(Boolean);
 const groups=x.visual59||{};
 for(const group of ['beauty','body'])for(const [key,value] of Object.entries(groups[group]||{})){if(value&&anchors.length<24)anchors.push(`${key}: ${String(value).slice(0,160)}`)}
 if(x.render_identity)anchors.unshift(x.render_identity);
 const outfit=Array.isArray(x.items)?x.items.filter(i=>i.wear_state==='worn'||/手|臂|holding|held|hand|arm/i.test(i.location||'')).map(i=>(i.wear_state==='worn'?'':`held at ${i.location}: `)+(i.fact||i.name)).filter(Boolean):clothes(x);
 const accessories=unpack(x.current).accessories||[];
 for(const a of (Array.isArray(accessories)?accessories:[accessories]).slice(0,5)){
  const name=valid(typeof a==='string'?a:a?.name||'');if(name&&!outfit.includes(name))outfit.push(name);
 }
 const species=path(p,'species_features')||{};
 for(const feature of ['horns','ears','wings','tail','special_lower_body']){
  const v=species[feature];const name=valid(typeof v==='string'?v:v?.name||v?.description||'');
  if(name)anchors.push(name.slice(0,140));
 }
 // Only use free-form canon description as a fallback, never as a duplicate of specific anchor facts.
 if(!anchors.length){const summary=datum(appear,'overall')||datum(x,'canon.design_intent.core');if(summary)anchors.push(summary.slice(0,220))}
 const identity=anchors.slice(0,17).join('；').slice(0,620);
 const wardrobe=outfit.join('；').slice(0,390);
 return {id:datum(x,'character_id'),name:str(name,90),identity,wardrobe,
  sourceSummary:[identity,wardrobe].filter(Boolean).join('；').slice(0,900)};
}
export function safeVisualText(value,max=280){let s=str(value,max*2);if(!s)return '';
 // Defensive boundary: remove internal record identifiers and model metadata from dynamic text.
 s=s.replace(/\b(?:character_id|current_snapshot|model_inference|focus anchor|scene object|preserve_screen_direction)\b\s*[:=]?\s*\w*/gi,' ')
  .replace(/\bchar_[a-z0-9]+\b/gi,' ').replace(/\b(?:unknown|undefined|null)\b/gi,' ');
 if(/[{}]/.test(s)||/"(?:canon|identity|current|field_meta)"\s*:/.test(s))return '';
 return s.replace(/\s{2,}/g,' ').trim().slice(0,max);
}
export function cleanList(values,max=8,size=150){return (Array.isArray(values)?values:[]).map(x=>safeVisualText(x,size)).filter(Boolean).slice(0,max)}
export const positionWords={left:'left side',center:'center',right:'right side','upper-left':'upper left','upper-right':'upper right','lower-left':'lower left','lower-right':'lower right',other:'appropriate position'};
export const depthWords={foreground:'foreground',midground:'middle ground',background:'background'};
export function characterImageText(ch,fact){const pieces=[fact.name, fact.identity, fact.wardrobe,
  positionWords[ch.zone]||'',depthWords[ch.depth]||'',
  ...['facing','pose','action','expression','gaze','wardrobe_motion'].map(k=>safeVisualText(ch[k],180)),
  ...cleanList(ch.visible_physiology,3,90)];return pieces.filter(Boolean).join(', ').slice(0,1200)}
export function composePrompt(style,parts,budget=6500){const locked=String(style||'');const dynamic=[...new Set(parts.map(x=>safeVisualText(x,650)).filter(Boolean))].join(', ');
 if(locked.length>4000)throw new Error('锁定画风提示词过长，请玩家手动编辑缩短；AVS不会自动截断');
 const allowance=budget-locked.length-(locked?2:0);if(allowance<240)throw new Error('锁定画风提示词超出当前编译预算，请玩家手动调整');
 const clipped=dynamic.slice(0,allowance).replace(/[,，;；\s]+$/,'');return (locked?locked+(clipped?', ':''):'')+clipped;
}
export function validateImagePrompt(prompt,negative){for(const t of [prompt,negative]){
 if(/\bcharacter_id\s*=|\bfocus anchor\b|\bscene object\s*:|\bmodel_inference\b|"(?:identity|canon|current|field_meta)"\s*:|\bchar_[a-z0-9]{6,}/i.test(t))throw new Error('最终提示词包含AVS档案内部字段，已阻止生图请求');
 if(/【\s*(?:重要记忆区|记忆区|选项栏|选项|平行事件|额外独立剧情|状态栏)|(?:^|\n)\s*(?:>\s*)?选项[一二三四五六七八九十\d]+\s*[:：]/m.test(t))throw new Error('提示词包含未发生选项或记忆/平行事件块，已阻止污染的生图请求');
 }return true;}
