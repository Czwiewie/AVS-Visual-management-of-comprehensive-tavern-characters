
/* AVS R2.1 background vocabulary, isolated from V4.1.10 Core.
 * Source metadata: yanadere0549/anima-prompt-helper (MIT).
 * Fetch only vocabulary/metadata, never execute downloaded scripts.
 */
const CACHE='AVS_R2_ASSET_LEXICON_V1';
const TTL=7*24*3600*1000;
const SOURCE=[
 'https://raw.githubusercontent.com/yanadere0549/anima-prompt-helper/main/data/tag_palette.json',
 'https://raw.githubusercontent.com/yanadere0549/anima-prompt-helper/main/data/tag_palette_extras.json',
 'https://raw.githubusercontent.com/PYU224/tagdb-updater/main/dist/danbooru-general.json'
];
const GROUPS={
  hair_color:'发色',hair_length:'发型',hair_style:'发型',eye_color:'外貌',
  expression:'表情',pose:'姿势',clothing:'服饰',accessory:'配饰',accessory_floral:'配饰',
  weapon:'物品',food:'物品',animal:'物品',situation:'姿势',camera:'构图',
  composition:'构图',lighting:'光影',color_tone:'光影',weather_atmos:'环境',
  season:'环境',architecture:'环境',location:'环境',magic_fantasy:'物品',effects:'光影',
  style:'画面风格',natural_language:'画面风格'
};
// Included offline fallback. These words are a vocabulary, never facts about the character.
const SEED={
 发型:['long hair','short hair','medium hair','ponytail','twintails','side ponytail','braided hair','low ponytail','high ponytail','hime cut','bob cut','wavy hair','curly hair','straight hair','hair bun','loose hair','messy hair','blunt bangs','side-swept bangs','hair over one eye'],
 发色:['black hair','brown hair','blonde hair','white hair','silver hair','red hair','blue hair','pink hair','purple hair','green hair','gradient hair'],
 外貌:['blue eyes','red eyes','green eyes','golden eyes','brown eyes','purple eyes','heterochromia','freckles','mole under eye','pointed ears'],
 表情:['smile','gentle smile','soft smile','grin','closed eyes','blush','surprised','frown','pout','tears','serious','determined','smirk','wink','looking at viewer','looking away','looking down','eye contact'],
 服饰:['school uniform','sailor collar','blazer','pleated skirt','dress','long dress','evening gown','kimono','yukata','hoodie','cardigan','turtleneck','sweater','coat','cape','armor','boots','high heels','loafers','ribbon','thighhighs','stockings'],
 配饰:['glasses','sunglasses','earrings','necklace','choker','bracelet','hair ribbon','hairpin','hair ornament','flower ornament','brooch','belt','handbag','watch','gloves','scarf','hat','hairband'],
 姿势:['standing','sitting','walking','running','kneeling','leaning forward','looking back','turning around','raised hand','hand on hip','hands clasped','arms crossed','waving','holding hands','reaching out','jumping','dancing','head tilt','hugging','crouching'],
 构图:['full body','upper body','portrait','close-up','cowboy shot','wide shot','from above','from below','from side','three-quarter view','dynamic angle','depth of field','foreground framing','cinematic composition','over the shoulder'],
 光影:['soft lighting','rim lighting','backlighting','volumetric lighting','golden hour','moonlight','window light','dramatic shadows','colorful reflections','subsurface scattering','soft shading','cel shading'],
 环境:['garden','library','bedroom','classroom','street','rooftop','shrine','forest','seaside','river','temple','palace','rain','snow','sunset','night sky','flower petals'],
 物品:['sword','book','umbrella','phone','lantern','flowers','teacup','fan','staff','scroll','necklace','basket','camera','parasol','violin','potion','bag','jewelry box']
};
const HINTS={
 发型:/发[型色丝梢辫际饰]|头发|刘海|双马尾|马尾|髻|hair|braid|ponytail/i,
 发色:/发色|金发|银发|黑发|红发|白发|头发|hair colou?r/i,
 外貌:/眼|瞳|脸|面|耳|雀斑|面容|外貌|容貌|eyes|face/i,
 表情:/笑|微笑|脸红|羞|哭|泪|惊|皱眉|眼神|神情|表情|smil|blush|tear/i,
 服饰:/裙|衣|袍|甲|装|靴|鞋|袜|披风|制服|袖|领|裙摆|dress|coat|skirt|boots/i,
 配饰:/耳环|项链|项圈|发夹|头饰|手镯|饰品|手套|戒指|眼镜|配饰|necklace|earring/i,
 姿势:/站|坐|跪|走|跑|转身|回头|握|抱|舞|伸手|举手|躬身|姿势|动作|walking|sitting|holding/i,
 构图:/近景|远景|特写|镜头|全身|俯视|仰视|画面|构图|视角|camera|wide shot/i,
 光影:/光|影|阳|月|夕|霓虹|昏|明暗|灯|light|shadow/i,
 环境:/山|海|河|街|屋|室|雨|雪|夜|花园|庭院|森林|楼阁|庭|场景|garden|forest/i,
 物品:/剑|刀|书|伞|花|杯|扇|权杖|卷轴|琴|篮|手机|物品|道具|book|sword/i
};
const ALIASES={
 'long hair':['长发'], 'short hair':['短发'], 'ponytail':['马尾'], 'twintails':['双马尾'],
 'braided hair':['辫子','编发'],'smile':['微笑','笑容'],'blush':['脸红','羞红'],
 'looking back':['回头'],'sitting':['坐下','坐着'],'standing':['站立','站着'],
 'walking':['走路','行走'],'running':['奔跑'],'holding hands':['牵手','握手'],
 'pleated skirt':['百褶裙'],'high heels':['高跟鞋'],'stockings':['丝袜'],
 'earrings':['耳环'],'necklace':['项链'],'umbrella':['雨伞'],
 'book':['书籍','书本'],'sword':['长剑','剑'],'flower petals':['花瓣'],
 'moonlight':['月光'],'soft lighting':['柔和光线'],'sunset':['夕阳','日落']
};
let catalog=null, sourceStatus='离线基础词典', lastFetch=0, loading=null;
function seed(){return Object.entries(SEED).flatMap(([group,tags])=>tags.map(tag=>({group,tag,aliases:ALIASES[tag]||[],origin:'AVS内置离线词典'})));}
function validateTag(t){return typeof t==='string'&&t.length>=2&&t.length<=80&&/^[a-zA-Z0-9' -]+$/.test(t)&&!/(nsfw|explicit|nude|fetish|loli|shota|underage|artist:)/i.test(t);}
function parsePalette(data){
  if(!Array.isArray(data?.categories))throw new Error('GitHub素材库格式错误');
  const found=[];
  for(const c of data.categories){const group=GROUPS[c.id];if(!group)continue;
    for(const v of c.tags||[]){let tag=String(v.tag||'').trim();
      if(!validateTag(tag))continue;
      found.push({group,tag,aliases:Array.isArray(v.aliases)?v.aliases.slice(0,5):[],origin:'anima-prompt-helper'});
    }
  }return found;
}
function classifyGeneral(tag){
 if(/hair|braid|ponytail|bangs|twintails|hairbun/i.test(tag))return '发型';
 if(/eye|freckles|eyelashes|eyebrows|face|cheek/i.test(tag))return '外貌';
 if(/smil|blush|laugh|cry|tears|frown|pout|wink|expression/i.test(tag))return '表情';
 if(/skirt|dress|shirt|blouse|coat|uniform|sweater|gloves|boots|heels|sock|stockings|kimono|cape|armor/i.test(tag))return '服饰';
 if(/necklace|earrings|bracelet|choker|ring|hairpin|ornament|brooch|ribbon|glasses/i.test(tag))return '配饰';
 if(/standing|sitting|walking|running|kneeling|hugging|crossed arms|hand|reaching|dancing|looking back/i.test(tag))return '姿势';
 if(/wide shot|close-up|full body|portrait|from above|from below|view|angle|shot|focus/i.test(tag))return '构图';
 if(/lighting|shadow|moonlight|sunlight|backlight|glow|sunset/i.test(tag))return '光影';
 if(/sword|book|umbrella|staff|flower|potion|camera|violin|scroll/i.test(tag))return '物品';
 if(/garden|street|shrine|forest|room|temple|library|rain|snow|beach/i.test(tag))return '环境';
 return '';
}
function parseDanbooru(list){
 if(!Array.isArray(list))throw new Error('GitHub Danbooru格式错误');
 return list.filter(x=>x?.t&&x.c===0).map(x=>({tag:String(x.t||'').replaceAll('_',' ').trim(),
    aliases:typeof x.ja==='string'&&x.ja? [x.ja]:[],
    count:Number(x.cnt||0)
 })).filter(x=>validateTag(x.tag)&&x.count>80)
  .sort((a,b)=>b.count-a.count).slice(0,22000)
  .map(x=>({...x,group:classifyGeneral(x.tag),origin:'tagdb-updater'}))
  .filter(x=>x.group).slice(0,2700);
}
function dedupe(items){const seen=new Set();return items.filter(x=>{const k=x.group+'|'+x.tag.toLowerCase();if(seen.has(k))return false;seen.add(k);return true;});}
function cacheLoad(){try{const x=JSON.parse(localStorage.getItem(CACHE)||'null');if(x&&Array.isArray(x.items)&&x.items.length>150){catalog=dedupe([...seed(),...x.items]);sourceStatus='已读取GitHub词典缓存';lastFetch=Number(x.date)||0;}}catch(_){}}
export function assetStatus(){return {count:(catalog||seed()).length,status:sourceStatus,updated:lastFetch,source:SOURCE};}
export async function warmAssetLibrary(){
 if(loading)return loading;
 if(!catalog)cacheLoad();
 if(catalog&&Date.now()-lastFetch<TTL)return catalog;
 loading=(async()=>{
  const loaded=[];
  for(const url of SOURCE){try{
    const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),18000);
    let response;try{response=await fetch(url,{cache:'no-cache',signal:abort.signal,credentials:'omit'});}finally{clearTimeout(timer)}
    if(!response.ok)throw new Error('HTTP '+response.status);
    const raw=await response.text();if(raw.length>11000000)throw new Error('素材文件过大');
    const data=JSON.parse(raw);
    loaded.push(...(url.includes('tagdb-updater')?parseDanbooru(data):parsePalette(data)));
   }catch(e){console.warn('[AVS] GitHub视觉词典来源不可用',url,String(e));}
  }
  if(loaded.length>=100){
    catalog=dedupe([...seed(),...loaded]);sourceStatus=`GitHub素材词典已加载（${loaded.length}条）`;
    lastFetch=Date.now();try{localStorage.setItem(CACHE,JSON.stringify({date:lastFetch,items:loaded}));}catch(_){}
  }else if(!catalog){catalog=seed();sourceStatus='离线基础词典，GitHub加载失败';}
  return catalog;
 })().finally(()=>{loading=null});
 return loading;
}
export function lexiconForScene(scene='',packets=[],limit=72){
 const entries=catalog||seed(),txt=(String(scene)+' '+(Array.isArray(packets)?packets.join(' '):String(packets))).slice(-18000);
 const groups=Object.keys(HINTS).filter(k=>HINTS[k].test(txt));
 // Appearance/wardrobe are candidate words only: never mutate canon or assert a new outfit.
 const suggestions=[];
 for(const group of groups){let arr=entries.filter(e=>e.group===group);
   const scored=arr.map(e=>({e,score:e.aliases?.some(a=>a&&txt.includes(a))?10:txt.toLowerCase().includes(e.tag.toLowerCase())?9:0}));
   scored.sort((a,b)=>b.score-a.score);
   const picked=scored.filter(x=>x.score>0).slice(0,6).map(x=>x.e.tag);
   if(!picked.length)continue;
   suggestions.push({group,tags:picked});
 }
 return suggestions.slice(0,12).map(x=>x.group+'：'+x.tags.join('、')).join('\n').slice(0,3500);
}
export function libraryCandidates(scene='',limit=80){
 const all=catalog||seed();const groups=Object.keys(HINTS).filter(k=>HINTS[k].test(scene));
 return groups.flatMap(group=>all.filter(e=>e.group===group).slice(0,Math.min(8,limit))).slice(0,limit).map(e=>({group:e.group,tag:e.tag}));
}
