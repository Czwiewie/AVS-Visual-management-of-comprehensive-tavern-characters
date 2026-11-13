import {visionChat} from './engines.js';
export const MATERIALS={
 发型:[['高马尾','high ponytail, flowing hair'],['低马尾','low ponytail'],['双马尾','twin tails'],['姬发式','hime cut, straight bangs'],['侧编发','side braid'],['长卷发','long wavy hair'],['披肩直发','silky straight shoulder-length hair'],['盘发','elegant updo']],
 表情:[['清浅微笑','gentle smile, soft eyes'],['羞涩','shy smile, subtle blush'],['自信','confident look'],['惊讶','surprised expression'],['忧思','pensive gaze'],['俏皮','playful wink'],['凝视','intense gaze']],
 外貌:[['精致五官','delicate facial features'],['清澈眼眸','clear expressive eyes'],['冷艳气质','cool elegant beauty'],['温婉气质','graceful gentle beauty'],['灵动神情','lively eyes and expression'],['立体轮廓','refined facial contours']],
 服饰:[['现代礼裙','elegant modern dress'],['幻想制服','fantasy uniform with intricate trims'],['旅行便装','stylish travel outfit'],['华丽长裙','ornate long flowing gown'],['轻甲','elegant lightweight fantasy armor'],['学院风','academy-style clothing'],['礼服','formal evening wear']],
 配饰:[['发饰','delicate hair ornament'],['珍珠耳坠','pearl earrings'],['颈链','fine necklace'],['薄纱披肩','sheer elegant shawl'],['宝石胸针','gemstone brooch'],['蝴蝶结','ribbon accessory'],['手镯','bracelet']]
};
const s=v=>String(v??'');
export const esc=v=>s(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const cleanText=x=>s(x).replace(/<think>[\s\S]*?<\/think>/gi,'').replace(/<details[^>]*>[\s\S]*?<\/details>/gi,'').replace(/<[^>]+>/g,' ').replace(/\[AVS[^\]]*\]/g,' ').replace(/\s{4,}/g,'\n').trim().slice(-12500);
export function stContext(){try{let w=globalThis;for(let i=0;i<8;i++){try{if(w.SillyTavern?.getContext)return w.SillyTavern.getContext()}catch(_){}if(w.parent===w)break;w=w.parent;}return null}catch{return null}}
export function contextInfo(){const c=stContext();if(!c)return {id:null,text:'',index:-1,context:null};const chat=Array.isArray(c.chat)?c.chat:[];const index=chat.findLastIndex(m=>!m.is_user&&!m.is_system&&s(m.mes||m.message).trim());const card=c.characterId??c.groupId??'none';const cid=c.chatId??c.chat_metadata?.chat_id??c.chat_metadata?.file_name??c.getCurrentChatId?.()??'unknown';return {id:`${card}::${cid}`,text:index>=0?cleanText(chat[index].mes||chat[index].message):'',index,context:c};}
export function coreBridge(){let w=globalThis;try{for(let i=0;i<8;i++){const b=w.__AVS_V4_BRIDGE__;if(b?.version==='4.1.10'&&typeof b.fullInspector==='function')return b;if(w.parent===w)break;w=w.parent;}}catch(_){}return null}
export async function archiveView(){const b=coreBridge();if(!b)return {error:'V4.1.10角色档案尚未就绪：请确认原版Core正在运行',characters:[],runtime:null,details:{}};
 try{const v=await b.fullInspector();const characters=(v.characters||[]).filter(x=>!x.blocked);return {characters,runtime:v.runtime||{},details:{},error:'',bridge:b}}catch(e){return {error:'读取V4.1.10只读档案失败：'+String(e.message||e),characters:[],runtime:null,details:{}}}}
export async function chosenCharacterPacket(arc,selectedIds){if(!arc.bridge)return [];
 const chars=arc.characters.filter(c=>selectedIds.includes(c.character_id));const output=[];
 for(const c of chars.slice(0,6)){try{const v=await arc.bridge.fullInspector(c.character_id),ch=v.selected;if(!ch)continue;
 const short={character_id:ch.character_id,name:ch.name,identity:ch.identity,canon:ch.canon,current:ch.current,current_snapshot:ch.current_snapshot,visual59:ch.visual59?{groups:ch.visual59.groups}:undefined};
 output.push(JSON.stringify(short).slice(0,8500));}catch(e){output.push(`${c.name}: 只读资料暂不可用 ${String(e.message||e).slice(0,180)}`)}}return output;}
export function archiveGate(arc,ctx){if(arc.error)return arc.error;if(!ctx.context)return 'SillyTavern聊天上下文未就绪，请先进入一个角色聊天';if(ctx.index<0)return '当前聊天没有已完成的AI回复';
 if(arc.runtime?.requires_sync||arc.runtime?.rebuild_required)return '角色档案正在等待时间线修复；请先通过原版AVS处理后再生图';
 if(arc.runtime?.health&&['ERROR','BLOCKED'].includes(arc.runtime.health))return '角色档案状态异常：'+arc.runtime.health;
 const floor=Number(arc.runtime?.last_processed_message_id);if(arc.characters.length&&Number.isFinite(floor)&&floor<ctx.index)return `最新AI楼层#${ctx.index}尚未完成独立API视觉同步（档案已同步至#${floor}）`;
 return '';}
export function buildLocalPrompt(ctx,charPackets,settings,style,mode='single'){
 const selected=(settings.materials||[]).map(x=>x.split('::')).map(([type,key])=>MATERIALS[type]?.find(v=>v[0]===key)?.[1]).filter(Boolean);
 const visualStyle=style?.analysis?.tags||style?.tags?.join(', ')||'crisp expressive anime lineart, nuanced cel shading, intricate costume rendering, cinematic light and composition';
 const target=mode==='comic'?'manga panel, cinematic shot, dynamic storytelling, clear composition':'high-quality modern ACGN key visual, detailed illustration';
 const story=cleanText(ctx.text).slice(-3700);
 const chars=charPackets.join('\n').slice(0,10000);
 const positive=[target,'masterpiece, best quality, polished modern anime illustration, expressive eyes, refined coherent character design',
 `visual style: ${visualStyle}`,...selected,`Character continuity reference (do not contradict): ${chars||'no registered character in this scene'}`,`Latest scene: ${story}`,'coherent spatial relations, plausible interactions, consistent wardrobe, accurate hands'].join(', ');
 return {positive,negative:settings.image.negative||'lowres, watermark, poorly drawn hands, extra fingers',source:'本地规则编译（未使用提示词模型）'};}
const SYSTEM='你是一名优秀的ACGN商业插画画面导演。根据剧情与正式AVS档案产生可直接送往图像模型的精美提示词。正式档案的事实与当前服装为最高优先级；不要凭空换装，不要强行填补59项所有字段。缺失的非关键细节允许艺术创作。画面空间、动作、互动须自洽。画风只迁移一般视觉特征，不临摹具体作品。只输出JSON对象，字段positive(英文或适用图像模型的提示词)、negative(英文负面标签)、note(不超过80字中文说明)。不要Markdown代码块。';
export async function compileWithAI(ctx,packets,settings,style,mode,signal){const raw=JSON.stringify({mode,story:ctx.text.slice(-9000),characters:packets,visualStyle:style?.analysis||style?.tags||[],materials:(settings.materials||[]).map(x=>x.split('::')).map(([type,key])=>MATERIALS[type]?.find(v=>v[0]===key)).filter(Boolean),quality:'modern 2023+ premium anime game illustration'}) ;
 let output;
 if(settings.prompt.useMain){const c=stContext();if(typeof c?.generateRaw!=='function')throw new Error('当前SillyTavern主API不支持generateRaw，请在提示词设置中改用独立API');output=await c.generateRaw({systemPrompt:SYSTEM,prompt:raw});}
 else output=await visionChat(settings.prompt,SYSTEM,raw,null,signal);
 const match=s(output).match(/\{[\s\S]*\}/);if(!match)throw new Error('提示词模型未返回JSON');let obj;try{obj=JSON.parse(match[0])}catch{throw new Error('提示词模型返回的JSON不合法')};if(!s(obj.positive).trim())throw new Error('提示词模型没有返回有效正向提示词');return {positive:s(obj.positive).trim(),negative:s(obj.negative||settings.image.negative).trim(),note:s(obj.note||''),source:'AI画面导演'};}
export function normalizeAnalysis(reply){const match=s(reply).match(/\{[\s\S]*\}/);if(!match)throw new Error('模型没有返回JSON');const a=JSON.parse(match[0]);return {description:s(a.description).slice(0,600),tags:s(a.tags).slice(0,1200),palette:s(a.palette).slice(0,300),lighting:s(a.lighting).slice(0,300),composition:s(a.composition).slice(0,300)}}
