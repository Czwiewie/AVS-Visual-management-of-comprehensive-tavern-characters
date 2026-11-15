import {lexiconForScene,libraryCandidates} from './assets.js';
import {visionChat} from './engines.js';
import {baselineDirector,directorRequest,normalizeDirector,compileDirector,styleSnapshot} from './director.js';
import {fanReferenceForPrompt} from './fan_canon.js';
import {cleanStory,cleanText as cleanNarrative,assertCleanStory} from './story_cleaner.js';
import {resolveMode} from './mode_resolver.js';
export const MATERIALS={
 发型:[['高马尾','high ponytail, flowing hair'],['低马尾','low ponytail'],['双马尾','twin tails'],['姬发式','hime cut, straight bangs'],['侧编发','side braid'],['长卷发','long wavy hair'],['披肩直发','silky straight shoulder-length hair'],['盘发','elegant updo']],
 表情:[['清浅微笑','gentle smile, soft eyes'],['羞涩','shy smile, subtle blush'],['自信','confident look'],['惊讶','surprised expression'],['忧思','pensive gaze'],['俏皮','playful wink'],['凝视','intense gaze']],
 外貌:[['精致五官','delicate facial features'],['清澈眼眸','clear expressive eyes'],['冷艳气质','cool elegant beauty'],['温婉气质','graceful gentle beauty'],['灵动神情','lively eyes and expression'],['立体轮廓','refined facial contours']],
 服饰:[['现代礼裙','elegant modern dress'],['幻想制服','fantasy uniform with intricate trims'],['旅行便装','stylish travel outfit'],['华丽长裙','ornate long flowing gown'],['轻甲','elegant lightweight fantasy armor'],['学院风','academy-style clothing'],['礼服','formal evening wear']],
 配饰:[['发饰','delicate hair ornament'],['珍珠耳坠','pearl earrings'],['颈链','fine necklace'],['薄纱披肩','sheer elegant shawl'],['宝石胸针','gemstone brooch'],['蝴蝶结','ribbon accessory'],['手镯','bracelet']]
};
const s=v=>String(v??'');
export const esc=v=>s(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const cleanText=cleanNarrative;
export function stContext(){try{let w=globalThis;for(let i=0;i<8;i++){try{if(w.SillyTavern?.getContext)return w.SillyTavern.getContext()}catch(_){}if(w.parent===w)break;w=w.parent;}return null}catch{return null}}
export function contextInfo(){const c=stContext();if(!c)return {id:null,text:'',index:-1,context:null};const chat=Array.isArray(c.chat)?c.chat:[];const index=chat.findLastIndex(m=>!m.is_user&&!m.is_system&&s(m.mes||m.message).trim());const card=c.characterId??c.groupId??'none';const cid=c.chatId??c.chat_metadata?.chat_id??c.chat_metadata?.file_name??c.getCurrentChatId?.()??'unknown';const cleaned=index>=0?cleanStory(chat[index].mes||chat[index].message):cleanStory('');return {id:`${card}::${cid}`,text:cleaned.text,cleaning:cleaned,index,context:c};}
export function coreBridge(){let w=globalThis;try{for(let i=0;i<8;i++){const b=w.__AVS_V4_BRIDGE__;if(b?.version==='4.1.10'&&typeof b.fullInspector==='function')return b;if(w.parent===w)break;w=w.parent;}}catch(_){}return null}
export async function archiveView(){const b=coreBridge();if(!b)return {error:'V4.1.10角色档案尚未就绪：请确认原版Core正在运行',characters:[],runtime:null,details:{}};
 try{const v=await b.fullInspector();const characters=(v.characters||[]).filter(x=>!x.blocked);return {characters,runtime:v.runtime||{},details:{},error:'',bridge:b}}catch(e){return {error:'读取V4.1.10只读档案失败：'+String(e.message||e),characters:[],runtime:null,details:{}}}}
export async function chosenCharacterPacket(arc,selectedIds){if(!arc.bridge)return [];
 const chars=arc.characters.filter(c=>selectedIds.includes(c.character_id));if(chars.length>12)throw new Error('本版单个画面最多规划12个正式角色，请缩小当前选择；不会静默丢掉其他角色');const output=[];
 for(const c of chars){try{const v=await arc.bridge.fullInspector(c.character_id),ch=v.selected;if(!ch)continue;
 // Keep complete JSON syntax, but take only visible, current, relevant facts.
 // V4.1.10 formal archive remains completely unchanged; this is a READ-ONLY packet projection.
 const unpack=v=>{if(typeof v==='string'){try{return JSON.parse(v)}catch{return {}}}return v&&typeof v==='object'?v:{}};
 const text=(v,max=190)=>String(v??'').trim().slice(0,max);
 const pick=(obj,fields,max=190)=>Object.fromEntries(fields.map(k=>[k,typeof obj?.[k]==='string'||typeof obj?.[k]==='number'?text(obj[k],max):undefined]).filter(x=>x[1]));
 const asset=o=>{if(!o)return null;if(Array.isArray(o))return o.slice(0,8).map(asset).filter(Boolean);
  if(typeof o==='string')return {name:text(o)};
  if(typeof o==='object')return {name:text(o.name||o.design?.description||'',170)};
  return null};
 const full=unpack(ch.current),appearance=ch.canon?.physical_design||{},slots=full.outfit?.slots||{};
 const outfitSlots=Object.fromEntries(Object.entries(slots).map(([k,v])=>[k,asset(v)]).filter(([,v])=>v&&(!Array.isArray(v)||v.length)));
 const slimCurrent={activity:{detail:text(full.activity?.detail,240)},hair:pick(full.hair,['current_style','condition','interaction'],140),
  makeup:asset(full.makeup),manicure:asset(full.manicure),outfit:{ensemble:asset(full.outfit?.ensemble),slots:outfitSlots},
  accessories:asset(full.accessories),pose:text(full.pose,220),expression:text(full.expression,170),dress_state:text(full.dress_state,80)};
 const physical={appearance:pick(appearance.appearance,['overall','skin_tone','skin_texture'],240),
  face:pick(appearance.face,['face_shape','brows','eyes','iris','pupils','nose','lips'],160),
  natural_hair:pick(appearance.natural_hair,['color','length','texture','volume'],150),
  body:pick(appearance.body,['height','overall_proportion','body_type','shoulders','clavicle','bust','waist','abdomen','pelvis','hips','buttocks','thighs','calves'],170),
  species_features:appearance.species_features};
 const short={character_id:ch.character_id,name:ch.name,
  identity:{name:ch.identity?.name,species:ch.identity?.species,body_type:ch.identity?.body_type,
   visual_age:ch.identity?.visual_age,current_identity_background:text(ch.identity?.current_identity_background,200)},
  canon:{physical_design:physical},current:slimCurrent};
 let serialized=JSON.stringify(short);
 if(serialized.length>13500){short.canon.physical_design.appearance.overall=text(short.canon.physical_design.appearance.overall,130);serialized=JSON.stringify(short)}
 if(serialized.length>15000)throw new Error('角色档案中的视觉字段过大，请检查是否存在重复或异常数据');

 output.push(serialized);
 }catch(e){throw new Error('读取角色 '+String(c.name||c.character_id)+' 的正式档案失败：'+String(e.message||e).slice(0,180))}}
 return output;}
export function archiveGate(arc,ctx){if(arc.error)return arc.error;if(!ctx.context)return 'SillyTavern聊天上下文未就绪，请先进入一个角色聊天';if(ctx.index<0)return '当前聊天没有已完成的AI回复';if(!ctx.text?.trim())return '最新回复只有记忆/选项/辅助文本，没有可用主线画面。已阻止生图';
 if(arc.runtime?.requires_sync||arc.runtime?.rebuild_required)return '角色档案正在等待时间线修复；请先通过原版AVS处理后再生图';
 if(arc.runtime?.health&&['ERROR','BLOCKED'].includes(arc.runtime.health))return '角色档案状态异常：'+arc.runtime.health;
 const floor=Number(arc.runtime?.last_processed_message_id);if(arc.characters.length&&Number.isFinite(floor)&&floor<ctx.index)return `最新AI楼层#${ctx.index}尚未完成独立API视觉同步（档案已同步至#${floor}）`;
 return '';}
export function buildLocalPrompt(ctx,charPackets,settings,style,mode='single'){
 const selected=(settings.materials||[]).map(x=>x.split('::')).map(([type,key])=>MATERIALS[type]?.find(v=>v[0]===key)?.[1]).filter(Boolean);
 const vocabulary=lexiconForScene(ctx.text,charPackets);
 const visualStyle=style?.analysis?.tags||style?.tags?.join(', ')||'crisp expressive anime lineart, nuanced cel shading, intricate costume rendering, cinematic light and composition';
 const target=mode==='comic'?'manga panel, cinematic shot, dynamic storytelling, clear composition':'high-quality modern ACGN key visual, detailed illustration';
 const story=cleanText(ctx.text).slice(-3700);
 const chars=charPackets.join('\n').slice(0,10000);
 const positive=[target,'masterpiece, best quality, polished modern anime illustration, expressive eyes, refined coherent character design',
 `visual style: ${visualStyle}`,...selected,`Character continuity reference (do not contradict): ${chars||'no registered character in this scene'}`,`Latest scene: ${story}`,vocabulary?`Relevant background visual vocabulary (only use when explicitly supported by scene, preserve character canon): ${vocabulary}`:'','coherent spatial relations, plausible interactions, consistent wardrobe, accurate hands'].join(', ');
 return {positive,negative:settings.image.negative||'lowres, watermark, poorly drawn hands, extra fingers',source:'本地规则编译（未使用提示词模型）'};}
const SYSTEM='你是一名优秀的ACGN商业插画画面导演。根据剧情与正式AVS档案产生可直接送往图像模型的精美提示词。正式档案的事实与当前服装为最高优先级；不要凭空换装，不要强行填补59项所有字段。缺失的非关键细节允许艺术创作。画面空间、动作、互动须自洽。画风只迁移一般视觉特征，不临摹具体作品。只输出JSON对象，字段positive(英文或适用图像模型的提示词)、negative(英文负面标签)、note(不超过80字中文说明)。不要Markdown代码块。';
export async function compileWithAI(ctx,packets,settings,style,mode,signal){const raw=JSON.stringify({mode,story:ctx.text.slice(-9000),characters:packets,visualStyle:style?.analysis||style?.tags||[],materials:(settings.materials||[]).map(x=>x.split('::')).map(([type,key])=>MATERIALS[type]?.find(v=>v[0]===key)).filter(Boolean),visualVocabulary:lexiconForScene(ctx.text,packets),candidateTags:libraryCandidates(ctx.text,55),vocabularyRule:'素材词典只是备选艺术语言；不能改变正式角色档案中的外貌、服饰、物品或无依据添加新动作。',quality:'modern premium anime game illustration'}) ;
 let output;
 if(settings.prompt.useMain){const c=stContext();if(typeof c?.generateRaw!=='function')throw new Error('当前SillyTavern主API不支持generateRaw，请在提示词设置中改用独立API');output=await c.generateRaw({systemPrompt:SYSTEM,prompt:raw});}
 else output=await visionChat(settings.prompt,SYSTEM,raw,null,signal);
 const match=s(output).match(/\{[\s\S]*\}/);if(!match)throw new Error('提示词模型未返回JSON');let obj;try{obj=JSON.parse(match[0])}catch{throw new Error('提示词模型返回的JSON不合法')};if(!s(obj.positive).trim())throw new Error('提示词模型没有返回有效正向提示词');return {positive:s(obj.positive).trim(),negative:s(obj.negative||settings.image.negative).trim(),note:s(obj.note||''),source:'AI画面导演'};}
export function normalizeAnalysis(reply){const match=s(reply).match(/\{[\s\S]*\}/);if(!match)throw new Error('模型没有返回JSON');const a=JSON.parse(match[0]);return {description:s(a.description).slice(0,600),tags:s(a.tags).slice(0,1200),positive:s(a.positive||a.tags).slice(0,2000),negative:s(a.negative).slice(0,1200),palette:s(a.palette).slice(0,300),lighting:s(a.lighting).slice(0,300),composition:s(a.composition).slice(0,300)}}

// R2.2: The prompt model plans a scene, never directly owns final prompts or a style lock.
export async function compileDirectedPrompt(ctx,packets,settings,mode,signal){
 assertCleanStory(ctx.text);
 const requested=resolveMode(mode,packets.length);
 const baseline=baselineDirector(ctx,packets,requested.mode,settings);const lockedAtStart=styleSnapshot(settings);
 let plan=baseline;
 if(settings.prompt.useMain || settings.prompt.key){
   const req=directorRequest(baseline,packets,settings,fanReferenceForPrompt(settings,ctx.context));let raw;
   if(settings.prompt.useMain){const c=stContext();if(typeof c?.generateRaw!=='function')throw new Error('主API未提供generateRaw，不能执行导演规划');
     raw=await c.generateRaw({systemPrompt:req.system,prompt:req.user});
   }else raw=await visionChat(settings.prompt,req.system,req.user,null,signal);
   plan=normalizeDirector(raw,baseline);
 }
 const lockedNow=styleSnapshot(settings);if(lockedNow.revision!==lockedAtStart.revision||lockedNow.id!==lockedAtStart.id)throw new Error('规划期间玩家切换或清除了画风，请重新编译，避免旧任务覆盖新画风');
 return compileDirector(plan,packets,settings,lockedAtStart);
}
