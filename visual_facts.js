/* Read-only projection of V4.1.10 facts and item identities. */
const text=(x,n=700)=>String(x??'').trim().slice(0,n);
export function unpack(x){if(typeof x==='string'){try{return JSON.parse(x)}catch{return {}}}return x&&typeof x==='object'?x:{}}
export function genderOf(x){const value=text(x.gender||x.identity?.gender||x.identity?.sex,40).toLowerCase();
 if(['female','女','女性','雌性'].includes(value))return 'female';
 if(['male','男','男性','雄性'].includes(value))return 'male';
 if(['other','nonbinary','非二元'].includes(value))return 'other';
 // This is the formal AVS female-admission contract, not a guess from a name.
 return x.archive_kind==='avs_female'?'female':'unknown';}
export function projectCharacter(ch){const current=unpack(ch.current),groups=ch.visual59?.groups||ch.visual58?.groups||{};
 const visual59=Object.fromEntries(Object.entries(groups).map(([group,fields])=>[group,Object.fromEntries(Object.entries(fields||{}).map(([key,r])=>[key,text(typeof r==='string'?r:r?.fact||r?.prose,800)]).filter(([,v])=>v))]));
 const item=(x,slot,index)=>{if(!x)return null;if(typeof x==='string')x={name:x};return {
  item_id:text(x.item_id||x.asset_id||x.id||`${ch.character_id}:${slot}:${index}`,140),owner_id:text(x.owner_id||ch.character_id,140),slot:text(x.slot||slot,50),name:text(x.name,180),
  wear_state:text(x.wear_state||x.wearing_state||(ledger.length?'unknown':'worn'),50),location:text(x.location?.label||x.location,180),condition:text(x.condition,100),
  fact:text(x.design?.fact||x.design?.description||x.description,800),prose:text(x.design?.prose,400),members:Array.isArray(x.members)?x.members.map(m=>({name:text(m.name,80),wear_state:text(m.wear_state,30),location:text(m.location?.label||m.location,90)})):[]};};
 const ledger=Array.isArray(ch.ng_items)?ch.ng_items:[];
 const fallback=Object.entries(current.outfit?.slots||{}).flatMap(([slot,values])=>(Array.isArray(values)?values:[values]).map((v,i)=>item(v,slot,i))).filter(Boolean);
 const extras=(Array.isArray(current.accessories)?current.accessories:[]).map((v,i)=>item(v,'accessory',i)).filter(Boolean);
 const items=(ledger.length?ledger.map((v,i)=>item(v,v.slot,i)):[...fallback,...extras]).filter(Boolean).filter(i=>i.owner_id===String(ch.character_id));
 if(items.length>80)throw new Error('单个角色当前物品超过80件，请缩小当前画面范围；不会截断后继续生图');
 return {character_id:ch.character_id,name:text(ch.name||ch.identity?.name,120),archive_kind:'avs_female',
  gender:genderOf({...ch,archive_kind:'avs_female'}),identity:structuredClone(ch.identity||{}),canon:structuredClone(ch.canon||{}),
  visual59,items,current:{activity:current.activity,hair:current.hair,makeup:current.makeup,manicure:current.manicure,
   pose:current.pose,expression:current.expression,dress_state:current.dress_state,visibility:current.visibility,scene:current.scene,
   outfit:ledger.length?{slots:{}}:structuredClone(current.outfit||{}),accessories:ledger.length?[]:structuredClone(current.accessories||[])}};}
export function visualSource(packet){const x=unpack(packet);return {id:x.character_id,name:x.name,gender:genderOf(x),items:x.items||[],visual59:x.visual59||{},raw:x};}
