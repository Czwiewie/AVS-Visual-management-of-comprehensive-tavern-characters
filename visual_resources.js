import {RESOURCE_CATALOG} from './data/visual_catalog.js';
import {MODE_TEMPLATES} from './data/mode_templates.js';
import {visualSource} from './visual_facts.js';
const norm=x=>String(x??'').normalize('NFKC').toLowerCase().replace(/_/g,' ').replace(/\s+/g,' ').trim();
export const CATEGORY_LABELS={hair:'发型',makeup:'妆容',expression:'表情',pose:'动作',clothing:'服饰',footwear:'鞋履',accessory:'配饰',nails:'美甲',material:'材质',look_bundle:'搭配组合',ornament:'装饰',signature:'整体特征'};
export const TEMPLATE_IDS={portrait:'character_portrait',pov:'observer_view_illustration',single:'live_scene_illustration',group:'live_scene_illustration',comic:'prose_to_comic'};
// Retrieval bridges, not translations of canonical facts. Each hit remains a candidate.
const BRIDGES=[['红色','red'],['黑色','black'],['白色','white'],['蓝色','blue'],['银色','silver'],['金色','gold'],['马尾','ponytail'],['双马尾','twin tails'],['高马尾','high ponytail'],['低马尾','low ponytail'],['长发','long hair'],['短发','short hair'],['直发','straight hair'],['卷发','curly hair'],['波浪','wavy'],['刘海','bangs'],['编发','braid'],['发辫','braid'],['盘发','updo'],['发髻','bun'],['姬发','hime'],['黑发','black hair'],['银发','silver hair'],['金发','blonde hair'],['白发','white hair'],['微笑','smile'],['笑容','smile'],['羞','blush'],['脸红','blush'],['惊讶','surprised'],['皱眉','frown'],['哭','crying'],['流泪','tears'],['严肃','serious'],['眨眼','wink'],['站','standing'],['坐','sitting'],['跪','kneeling'],['跑','running'],['行走','walking'],['回头','looking back'],['牵手','holding hands'],['拥抱','hugging'],['伸手','reaching'],['交叉双臂','arms crossed'],['礼裙','evening dress'],['长裙','long dress'],['连衣裙','dress'],['百褶裙','pleated skirt'],['衬衫','shirt'],['衬衣','blouse'],['制服','uniform'],['西装','suit'],['大衣','coat'],['外套','jacket'],['披风','cape'],['毛衣','sweater'],['高领','turtleneck'],['裤','pants'],['牛仔','denim'],['高跟','high heels'],['靴','boots'],['鞋','shoes'],['丝袜','stockings'],['手套','gloves'],['耳环','earrings'],['耳坠','earrings'],['颈链','necklace'],['项链','necklace'],['颈环','choker'],['手镯','bracelet'],['戒指','ring'],['胸针','brooch'],['发簪','hairpin'],['发夹','hair clip'],['蝴蝶结','bow'],['珍珠','pearl'],['蕾丝','lace'],['刺绣','embroidery'],['金边','gold trim'],['丝绸','silk'],['皮革','leather'],['天鹅绒','velvet'],['美甲','nail'],['指甲','nail'],['红色甲','red nails'],['法式','french'],['珠光','pearlescent'],['亮面','glossy'],['磨砂','matte'],['金属','metallic'],['花纹','pattern']];
export const resourceEntries=RESOURCE_CATALOG.entries;
export const resourceById=new Map(resourceEntries.map(e=>[e.id,e]));
function expanded(query){const q=norm(query);return [q,...BRIDGES.filter(([zh])=>q.includes(zh)).map(([,en])=>en)].filter(Boolean);}
export function searchResources(query,{category='',limit=30}={}){const terms=expanded(query);if(!terms.length)return [];
 return resourceEntries.filter(e=>!category||e.category===category).map(e=>{const fields=[e.label,e.description,...(e.aliases_zh||[])].map(norm);let score=0;
  for(const term of terms)for(const field of fields){if(term===field)score=Math.max(score,100);else if(field.includes(term))score=Math.max(score,60);else if(term.includes(field)&&field.length>=4)score=Math.max(score,45);else {const words=term.match(/[a-z]{3,}/g)||[];const hit=words.filter(w=>new RegExp(`\\b${w}\\b`,'i').test(field)).length;if(hit)score=Math.max(score,Math.min(25,hit*4));}}
  return {e,score};}).filter(x=>x.score>0).sort((a,b)=>b.score-a.score||a.e.id.localeCompare(b.e.id)).slice(0,Math.min(100,limit)).map(x=>x.e);}
export function templateFor(mode){return MODE_TEMPLATES.find(t=>t.id===TEMPLATE_IDS[mode])||MODE_TEMPLATES.find(t=>t.id===TEMPLATE_IDS.single);}
const compact=e=>({resource_id:e.id,category:e.category,label:e.label,text:e.description,regions:e.regions||[],needs_parent:['material','ornament'].includes(e.category),needs_scope_split:!!e.requires_scope_split,source:e.source_id});
export function retrieveForPlan(plan,packets,settings){const template=templateFor(plan.mode);const sources=packets.map(visualSource);let remaining=52;
 const actors=plan.cast.map(ch=>{const source=sources.find(x=>x.id===ch.id);const raw=source?.raw||{};
  const flat=x=>typeof x==='string'?x:Array.isArray(x)?x.map(flat).join(' '):x&&typeof x==='object'?Object.values(x).map(flat).join(' '):'';
  const beauty=raw.visual59?.beauty||{},fields=re=>Object.entries(beauty).filter(([key])=>re.test(key)).map(([,v])=>v);
  const items=raw.items||[];const queries={hair:flat([fields(/发/),raw.canon?.physical_design?.natural_hair,raw.current?.hair]),nails:flat([fields(/美甲|指甲/),raw.current?.manicure]),makeup:flat([fields(/妆|唇|眉/),raw.current?.makeup]),footwear:flat([raw.visual59?.clothing?.['高跟鞋'],items.filter(i=>/鞋|footwear|feet|boots/i.test(i.slot+' '+i.name))]),clothing:flat([raw.visual59?.clothing,raw.current?.outfit,items.filter(i=>!/饰|accessory|jewelry/i.test(i.slot))]),accessory:flat([raw.visual59?.accessories,raw.current?.accessories,items.filter(i=>/饰|accessory|jewelry/i.test(i.slot))]),ornament:flat([raw.visual59?.clothing,raw.visual59?.accessories,items]),material:flat(items)};
  const dynamics=[ch.pose,ch.action,ch.expression,plan.scene.moment,plan.scene.atmosphere].join(' ');
  const ranked=[];const seen=new Set();const cats=['hair','clothing','footwear','accessory','ornament','makeup','nails','expression','pose','material'];
  const allowance=Math.min(16,Math.max(2,Math.floor(52/Math.max(1,plan.cast.length))));
  for(let pass=0;pass<2;pass++)for(const cat of cats){if(settings.resources?.enabled===false)break;const query=['expression','pose'].includes(cat)?dynamics:queries[cat];
   for(const e of searchResources(query,{category:cat,limit:2}).slice(pass,pass+1)){if(seen.has(e.id)||ranked.length>=allowance||remaining<=0)continue;ranked.push(compact(e));seen.add(e.id);remaining--;}}
  return {id:ch.id,gender:source?.gender||'unknown',candidates:ranked};});
 const supportingCandidates=settings.resources?.enabled===false?[]:searchResources(plan.storyForDirector||plan.scene.moment,{limit:40}).filter(e=>!['look_bundle','signature'].includes(e.category)).slice(0,12).map(compact);
 return {supportingCandidates,catalog_size:resourceEntries.length,enabled:settings.resources?.enabled!==false,template:{id:template.id,goal:template.goal,layers:template.layers.map(l=>({id:l.id,category:l.name_zh,destination:l.destination,retention:l.retention}))},actors,
  rule:'候选不是事实。仅选择有档案或本幕证据的条目，逐角色编译英文短片段；不得因为库中出现某物就为人物换装。材质/装饰须绑定既有物品ID和附着位置。隐藏的美甲和画外鞋履只保留在元数据。不要复制整个库或类别标题到最终提示词。'};}
export function normalizeResourceSelections(incoming,context,source,actor){const allowed=new Set(context?.actors?.find(x=>x.id===actor.id)?.candidates.map(x=>x.resource_id)||[]);const items=new Map((source?.items||[]).map(x=>[x.item_id,x]));const result=[];
 for(const s of (Array.isArray(incoming)?incoming:[]).slice(0,16)){const entry=resourceById.get(s?.resource_id);if(!entry||!allowed.has(entry.id))throw new Error('提示词API选择了未检索到的素材：'+String(s?.resource_id));
  if(['look_bundle','signature'].includes(entry.category))throw new Error('复合搭配必须先拆分为具体发型、服饰等类别后使用');
  const evidence=String(s.evidence||'').trim();if(!evidence||!JSON.stringify(source?.raw||{}).includes(evidence)&&!String(actor.evidenceStory||'').includes(evidence))throw new Error('素材片段缺少可核对的原文证据：'+entry.label);
  const parent=String(s.parent_item_id||'');if(['clothing','footwear','accessory','material','ornament'].includes(entry.category)&&!items.has(parent))throw new Error('服饰/装饰素材未绑定角色当前物品：'+entry.label);
  if(entry.category==='ornament'&&!String(s.anchor||'').trim())throw new Error('装饰素材缺少附着位置：'+entry.label);
  const value=String(s.text||'').trim();if(!value||value.length>250)throw new Error('素材片段为空或过长：'+entry.label);
  const parentItem=items.get(parent);if(s.visible!==false&&parentItem&&parentItem.wear_state!=='worn'&&parentItem.wear_state!=='partial'&&!/held|holding|folded|forearm|hand|removed|off.body|on.*(?:chair|floor|table)/i.test(value))throw new Error('未穿戴素材缺少持物或放置关系：'+entry.label);
  if(s.visible!==false&&parentItem?.wear_state==='partial'&&!/one|left|right|partially|single/i.test(value))throw new Error('部分穿戴素材缺少左右或数量关系：'+entry.label);
  if(entry.category==='nails'&&!/nail|polish|manicure/i.test(value))throw new Error('美甲色彩缺少指甲作用域：'+entry.label);
  if(['expression','pose'].includes(entry.category)&&result.some(r=>r.category===entry.category))throw new Error('同一人物只能采用一个合并后的表情/姿势素材片段');
  result.push({resource_id:entry.id,category:entry.category,text:value,evidence,parent_item_id:parent||null,anchor:String(s.anchor||''),regions:entry.regions||[],detail:s.detail===true,visible:s.visible!==false,source:entry.provenance});
 }return result;}
export function referencePreview(entry){const r=entry.reference;if(r?.visual_review!=='approved_as_category_reference')return '';
 const paths={'hairstyle_01.jpg':'hairstyle_01.jpg','nails_01.jpg':'nails_01.jpg','accessory_30.jpg':'accessory_30.jpg','expression_01.jpg':'expression_01.jpg','outfit_top_08.jpg':'outfit_top_08.jpg','pose_00.jpg':'pose_00.jpg'};
 const path=r.local_file?.split('/').at(-1);return paths[path]?new URL('./previews/'+paths[path],import.meta.url).href:'';}
