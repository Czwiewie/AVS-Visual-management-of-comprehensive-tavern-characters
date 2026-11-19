import {RESOURCE_CATALOG} from './data/visual_catalog.js';
import {MODE_TEMPLATES} from './data/mode_templates.js';
import {visualSource} from './visual_facts.js';
const norm=x=>String(x??'').normalize('NFKC').toLowerCase().replace(/_/g,' ').replace(/\s+/g,' ').trim();
export const CATEGORY_LABELS={hair:'发型',makeup:'妆容',expression:'表情',pose:'动作',clothing:'成衣',hosiery:'丝袜与袜类',high_heels:'高跟鞋',flat_shoes:'平底鞋',pattern:'纹样',motif:'图案',footwear:'其他鞋履',accessory:'配饰',nails:'美甲',material:'材质',look_bundle:'搭配组合',ornament:'装饰',signature:'整体特征',appearance:'外貌特征',effects:'特效'};
export const TEMPLATE_IDS={portrait:'character_portrait',pov:'observer_view_illustration',single:'live_scene_illustration',group:'live_scene_illustration',comic:'prose_to_comic'};
// Retrieval bridges, not translations of canonical facts. Each hit remains a candidate.
const BRIDGES=[['红色','red'],['黑色','black'],['白色','white'],['蓝色','blue'],['银色','silver'],['金色','gold'],['马尾','ponytail'],['双马尾','twin tails'],['高马尾','high ponytail'],['低马尾','low ponytail'],['长发','long hair'],['短发','short hair'],['直发','straight hair'],['卷发','curly hair'],['波浪','wavy'],['刘海','bangs'],['编发','braid'],['发辫','braid'],['盘发','updo'],['发髻','bun'],['姬发','hime'],['黑发','black hair'],['银发','silver hair'],['金发','blonde hair'],['白发','white hair'],['微笑','smile'],['笑容','smile'],['羞','blush'],['脸红','blush'],['惊讶','surprised'],['皱眉','frown'],['哭','crying'],['流泪','tears'],['严肃','serious'],['眨眼','wink'],['站','standing'],['坐','sitting'],['跪','kneeling'],['跑','running'],['行走','walking'],['回头','looking back'],['牵手','holding hands'],['拥抱','hugging'],['伸手','reaching'],['交叉双臂','arms crossed'],['礼裙','evening dress'],['长裙','long dress'],['连衣裙','dress'],['百褶裙','pleated skirt'],['衬衫','shirt'],['衬衣','blouse'],['制服','uniform'],['西装','suit'],['大衣','coat'],['外套','jacket'],['披风','cape'],['毛衣','sweater'],['高领','turtleneck'],['裤','pants'],['牛仔','denim'],['高跟','high heels'],['靴','boots'],['鞋','shoes'],['丝袜','stockings'],['裤袜','pantyhose'],['连裤袜','pantyhose'],['大腿袜','thighhighs'],['过膝袜','thighhighs'],['渔网袜','fishnet'],['平底','flat'],['平底鞋','ballet flats'],['细跟','stiletto'],['方跟','block heels'],['木屐','geta'],['纹样','pattern'],['火焰','fire'],['闪电','lightning'],['魔法','magic'],['烟雾','smoke'],['雨滴','rain'],['图案','print'],['格纹','plaid'],['菱格','argyle'],['波点','polka dot'],['条纹','striped'],['花卉','floral'],['豹纹','leopard print'],['手套','gloves'],['耳环','earrings'],['耳坠','earrings'],['颈链','necklace'],['项链','necklace'],['颈环','choker'],['手镯','bracelet'],['戒指','ring'],['胸针','brooch'],['发簪','hairpin'],['发夹','hair clip'],['蝴蝶结','bow'],['珍珠','pearl'],['蕾丝','lace'],['刺绣','embroidery'],['金边','gold trim'],['丝绸','silk'],['皮革','leather'],['天鹅绒','velvet'],['美甲','nail'],['指甲','nail'],['红色甲','red nails'],['法式','french'],['珠光','pearlescent'],['亮面','glossy'],['磨砂','matte'],['金属','metallic'],['花纹','pattern']];
export const resourceEntries=Object.freeze([...RESOURCE_CATALOG.entries]);
export const resourceById=new Map(resourceEntries.map(e=>[e.id,e]));
function expanded(query){const q=norm(query);return [q,...BRIDGES.filter(([zh])=>q.includes(zh)).map(([,en])=>en)].filter(Boolean);}
function indexResource(e){return {entry:e,fields:[...new Set([e.label_zh,e.label,e.description,...(e.nai_tags||[]),...(e.aliases_zh||[])].map(norm).filter(Boolean))].map(text=>({text,words:new Set(text.match(/[a-z]{3,}/g)||[])}))}}
const indexedResources=resourceEntries.map(indexResource);
export function searchResources(query,{category='',limit=30}={}){const terms=expanded(query).map(text=>({text,words:text.match(/[a-z]{3,}/g)||[]}));if(!terms.length)return [];
 const ranked=[];for(const row of indexedResources){if(category&&row.entry.category!==category)continue;let score=0;
  for(const term of terms)for(const field of row.fields){if(term.text===field.text)score=Math.max(score,100);else if(field.text.includes(term.text))score=Math.max(score,60);else if(term.text.includes(field.text)&&field.text.length>=4)score=Math.max(score,45);else{let hit=0;for(const word of term.words)if(field.words.has(word))hit++;if(hit)score=Math.max(score,Math.min(25,hit*4));}}
  if(score)ranked.push({entry:row.entry,score});}
 return ranked.sort((a,b)=>b.score-a.score||a.entry.id.localeCompare(b.entry.id)).slice(0,Math.min(resourceEntries.length,limit)).map(x=>x.entry);}
export function templateFor(mode){return MODE_TEMPLATES.find(t=>t.id===TEMPLATE_IDS[mode])||MODE_TEMPLATES.find(t=>t.id===TEMPLATE_IDS.single);}
const compact=e=>({resource_id:e.id,category:e.compile_category||e.category,library_category:e.category,subcategory:e.subcategory,constraints:e.constraints||[],label:e.label_zh||e.label,text:(e.nai_tags||[]).join(', ')||e.description,regions:e.regions||[],needs_parent:!!e.requires_parent_item,needs_scope_split:!!e.requires_scope_split,source:e.source_id});
export function retrieveForPlan(plan,packets,settings){const template=templateFor(plan.mode);const sources=packets.map(visualSource);let remaining=48;const picks=(settings.resourcePicks||[]).slice(0,16).map(({resource_id,character_id})=>({resource_id,character_id}));
 for(const ref of picks){
  if(!resourceById.has(ref.resource_id))throw new Error('本次选择的素材已经失效，请重新选择');
  if(ref.character_id&&ref.character_id!=='auto'&&!plan.cast.some(c=>c.id===ref.character_id))throw new Error('本次素材绑定的人物不在画面中，请修改人物选择或改为自动匹配');
 }
 const actors=plan.cast.map(ch=>{const source=sources.find(x=>x.id===ch.id);const raw=source?.raw||{};
  const flat=x=>typeof x==='string'?x:Array.isArray(x)?x.map(flat).join(' '):x&&typeof x==='object'?Object.values(x).map(flat).join(' '):'';
  const beauty=raw.visual59?.beauty||{},fields=re=>Object.entries(beauty).filter(([key])=>re.test(key)).map(([,v])=>v);
  const items=raw.items||[];const queries={appearance:flat([raw.canon?.physical_design?.face,raw.canon?.physical_design?.appearance,fields(/眼|虹膜|肤/)]),hair:flat([fields(/发/),raw.canon?.physical_design?.natural_hair,raw.current?.hair]),nails:flat([fields(/美甲|指甲/),raw.current?.manicure]),makeup:flat([fields(/妆|唇|眉/),raw.current?.makeup]),footwear:flat([raw.visual59?.clothing?.['高跟鞋'],items.filter(i=>/鞋|footwear|feet|boots/i.test(i.slot+' '+i.name))]),clothing:flat([raw.visual59?.clothing,raw.current?.outfit,items.filter(i=>!/饰|accessory|jewelry/i.test(i.slot))]),accessory:flat([raw.visual59?.accessories,raw.current?.accessories,items.filter(i=>/饰|accessory|jewelry/i.test(i.slot))]),ornament:flat([raw.visual59?.clothing,raw.visual59?.accessories,items]),material:flat(items)};
  queries.hosiery=flat([Object.entries(raw.visual59?.clothing||{}).filter(([k])=>/丝?袜|裤袜|腿套/.test(k)).map(([,v])=>v),items.filter(i=>/袜|stocking|pantyhose|tights|legwear|socks/i.test(i.slot+' '+i.name))]);
  const shoeQuery=queries.footwear;queries.high_heels=/高跟|中跟|细跟|粗跟|方跟|\bheel|stiletto|pumps/i.test(shoeQuery)?shoeQuery:'';queries.flat_shoes=/平底|flat|sneaker|slipper|运动鞋|芭蕾鞋|乐福鞋/i.test(shoeQuery)?shoeQuery:'';
  queries.pattern=queries.ornament;queries.motif=queries.ornament;queries.effects=[plan.scene.moment,plan.scene.atmosphere].join(' ');
  const dynamics=[ch.pose,ch.action,ch.expression,plan.scene.moment,plan.scene.atmosphere].join(' ');
  const ranked=[],seen=new Set();for(const ref of picks.filter(x=>!x.character_id||x.character_id==='auto'||x.character_id===ch.id)){const e=resourceById.get(ref.resource_id);ranked.push({...compact(e),user_selected:true});seen.add(e.id);remaining--;}if(remaining<0)throw new Error('本次素材与人物组合过多，请明确绑定人物或减少参考项');const cats=['hair','clothing','hosiery','high_heels','flat_shoes','footwear','accessory','ornament','pattern','motif','makeup','nails','expression','pose','material','appearance','effects'];
  const allowance=Math.min(16,Math.max(2,Math.floor(48/Math.max(1,plan.cast.length))));
  for(let pass=0;pass<2;pass++)for(const cat of cats){if(settings.resources?.enabled===false)break;const query=['expression','pose'].includes(cat)?dynamics:queries[cat];
   for(const e of searchResources(query,{category:cat,limit:2}).slice(pass,pass+1)){if(seen.has(e.id)||ranked.length>=allowance||remaining<=0)continue;ranked.push(compact(e));seen.add(e.id);remaining--;}}
  return {id:ch.id,gender:source?.gender||'unknown',candidates:ranked};});
 const supportingCandidates=settings.resources?.enabled===false?[]:searchResources(plan.storyForDirector||plan.scene.moment,{limit:40}).filter(e=>!['look_bundle','signature'].includes(e.category)).slice(0,12).map(compact);
 for(const ref of picks.filter(x=>!x.character_id||x.character_id==='auto')){const e=resourceById.get(ref.resource_id);if(e&&!supportingCandidates.some(x=>x.resource_id===e.id))supportingCandidates.unshift({...compact(e),user_selected:true});}
 if(supportingCandidates.length>16)supportingCandidates.splice(16);
 return {user_selected:picks,supportingCandidates,catalog_size:resourceEntries.length,enabled:settings.resources?.enabled!==false,template:{id:template.id,goal:template.goal,layers:template.layers.map(l=>({id:l.id,category:l.name_zh,destination:l.destination,retention:l.retention}))},actors,
  rule:'候选不是事实。仅选择有档案或本幕证据的条目，逐角色编译英文短片段；不得因为库中出现某物就为人物换装。材质/装饰须绑定既有物品ID和附着位置。隐藏的美甲和画外鞋履只保留在元数据。不要复制整个库或类别标题到最终提示词。'};}
function resourceRegions(entry,parent,anchor,category){
 if(parent&&['ornament','material'].includes(category)){
  if(/裙摆|裙边|裤脚|下裙|\b(?:skirt|trouser|pant|lower dress)\b.*\bhem\b|\bhem\b.*\bskirt\b/i.test(anchor))return ['legs'];
  if(/领口|衣领|驳领|前胸|\b(?:neckline|collar|lapel|bodice|chest)\b/i.test(anchor))return ['torso'];
  if(/袖口|手腕|\b(?:sleeve cuff|wrist)\b/i.test(anchor))return ['arms','hands'];
  if(/袖子|袖身|\bsleeve\b/i.test(anchor))return ['arms'];
  if(/鞋面|鞋底|鞋跟|\b(?:shoe|footwear|toe|heel|sole)\b/i.test(anchor))return ['feet'];
  if(/发饰|耳部|耳侧|\b(?:hairpin|headpiece|earring)\b/i.test(anchor))return ['head'];
  const location=[anchor,parent.slot,parent.name].join(' ');
  if(/\bhem\b|下摆/i.test(anchor)&&/裙|\b(?:dress|skirt)\b/i.test(parent.name+' '+parent.slot))return ['legs'];
  if(/靴|boot shaft|boot leg/i.test(location))return ['legs','feet'];
  if(/鞋|鞋面|足|foot|toe|heel|sole|shoe|sandal/i.test(location))return ['feet'];
  if(/袜|腿|hosiery|stocking|pantyhose|legwear|leg/i.test(location))return ['legs','feet'];
  if(/发|头|耳|hair|head|earring/i.test(location))return ['head'];
  if(/手|指|腕|glove|hand|wrist|finger/i.test(location))return ['hands'];
  return ['torso'];
 }
 return entry.regions||[];
}
export function normalizeResourceSelections(incoming,context,source,actor){const allowed=new Set(context?.actors?.find(x=>x.id===actor.id)?.candidates.map(x=>x.resource_id)||[]);const items=new Map((source?.items||[]).map(x=>[x.item_id,x]));const result=[];
 for(const s of (Array.isArray(incoming)?incoming:[]).slice(0,16)){const entry=resourceById.get(s?.resource_id);if(!entry||!allowed.has(entry.id))throw new Error('提示词API选择了未检索到的素材：'+String(s?.resource_id));
  const category=s.component_category||entry.compile_category||entry.category;
  if(entry.requires_scope_split&&!s.component_category)throw new Error('复合搭配必须先用component_category拆分到具体物品');
  if(['look_bundle','signature'].includes(category)||!CATEGORY_LABELS[category])throw new Error('复合搭配必须先用component_category拆分为具体发型、服饰等类别后使用');
  if(!entry.requires_scope_split&&entry.category!=='look_bundle'&&s.component_category&&s.component_category!==(entry.compile_category||entry.category))throw new Error('素材不能改换既定作用类别');
  const evidence=String(s.evidence||'').trim();
  if(!evidence||!JSON.stringify(source?.raw||{}).includes(evidence)&&!String(actor.evidenceStory||'').includes(evidence))throw new Error('素材片段缺少可核对的原文证据：'+entry.label);
  const parent=String(s.parent_item_id||'');if(['clothing','footwear','accessory','material','ornament'].includes(category)&&!items.has(parent))throw new Error('服饰/装饰素材未绑定角色当前物品：'+entry.label);
  if(category==='ornament'&&!String(s.anchor||'').trim())throw new Error('装饰素材缺少附着位置：'+entry.label);
  const value=String(s.text||'').trim();if(!value||value.length>250)throw new Error('素材片段为空或过长：'+entry.label);
  const parentItem=items.get(parent);if(s.visible!==false&&parentItem&&parentItem.wear_state!=='worn'&&parentItem.wear_state!=='partial'&&!/held|holding|folded|forearm|hand|removed|off.body|on.*(?:chair|floor|table)/i.test(value))throw new Error('未穿戴素材缺少持物或放置关系：'+entry.label);
  if(s.visible!==false&&parentItem?.wear_state==='partial'&&!/one|left|right|partially|single/i.test(value))throw new Error('部分穿戴素材缺少左右或数量关系：'+entry.label);
  const physical=parentItem?JSON.stringify([parentItem.name,parentItem.slot,parentItem.fact,parentItem.design]):'';
  if(['high_heels','flat_shoes','footwear'].includes(entry.category)&&parentItem&&!/鞋|靴|footwear|feet|shoes?|boots?|heels?|sandals?|slippers?|loafers?|sneakers?|pumps|geta/i.test(physical))throw new Error('鞋履素材必须绑定鞋履物品，不能附着到其他成衣');
  if(entry.category==='hosiery'&&parentItem&&!/袜|腿套|打底裤|leggings?|hosiery|stockings?|pantyhose|tights|socks?|legwear/i.test(physical))throw new Error('丝袜素材必须绑定本角色的袜类物品');
  if(entry.category==='high_heels'&&(/平底|木屐|\b(?:flat(?:-| )(?:shoes?|sandals?|soles?)|ballet flats|geta|tengu-geta)\b/i.test(physical)))throw new Error('高跟鞋素材与当前物品的平底/木屐结构冲突');
  if(entry.category==='flat_shoes'&&(/高跟|中跟|细跟|粗跟|方跟|\b(?:high heels?|stilettos?|heeled|kitten heels?)\b/i.test(physical)))throw new Error('平底鞋素材与当前物品的鞋跟结构冲突');
  if(entry.category==='hosiery'&&/(?:\b(?:thighhighs?|stockings?)\s+(?:over|under)\s+pantyhose|\b(?:layered|double)\s+(?:stockings?|pantyhose)|丝袜叠穿|叠穿丝袜)/i.test(value))throw new Error('丝袜素材不得引入多层叠穿，左右不对称仍按单件设计处理');
  if(category==='nails'&&!/nail|polish|manicure/i.test(value))throw new Error('美甲色彩缺少指甲作用域：'+entry.label);
  if(['expression','pose'].includes(category)&&result.some(r=>r.category===category))throw new Error('同一人物只能采用一个合并后的表情/姿势素材片段');
  result.push({resource_id:entry.id,category,library_category:entry.category,text:value,evidence,parent_item_id:parent||null,anchor:String(s.anchor||''),regions:entry.requires_scope_split||entry.category==='look_bundle'?({hair:['head'],expression:['face'],nails:['fingernails'],makeup:['face'],footwear:['feet'],pose:[]}[category]||['torso']):resourceRegions(entry,parentItem,String(s.anchor||''),category),detail:s.detail===true,visible:s.visible!==false,source:entry.provenance});
 }return result;}
const previewCache=new Map();
export function referencePreview(entry){if(previewCache.has(entry?.id))return previewCache.get(entry.id);const r=entry?.reference;if(!r?.local_available||!r.local_file||!['upstream_person_free_audit_before_use','anonymous_pose_audit_before_use','reviewed_nonportrait_pattern_card'].includes(r.visual_review))return '';
 const path=String(r.local_file);if(!path.startsWith('resource_library/')||path.split('/').includes('..'))return '';const url=new URL('./'+path,import.meta.url).href;previewCache.set(entry.id,url);return url;}
