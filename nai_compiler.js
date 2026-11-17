/* Independent AVS compiler. Token counts here are estimates, never an exact tokenizer. */
import {genderOf,visualSource} from './visual_facts.js';
import {normalizeResourceSelections,templateFor} from './visual_resources.js';
import {validateImagePrompt} from './prompt_compiler.js';
export const NAI_PROFILES=Object.freeze({
 nai4full:{model:'nai-diffusion-4-full',label:'Nai 4 Full',maxCharacters:6,officialApprox:512,scope:'base_plus_all_character_prompts',workingBudget:460},
 nai5full:{model:'nai-diffusion-5-full',label:'Nai 5 Full',maxCharacters:22,officialApprox:1471,scope:'base_prompt_effective_tokens',workingBudget:1250}
});
export function profileFor(image={}){if(image.engine==='novelai'){
 const p=Object.keys(NAI_PROFILES).find(k=>NAI_PROFILES[k].model===image.naiModel);
 if(!p)throw new Error('当前NovelAI模型没有本版编译配置，请明确选择Nai 4 Full或Nai 5 Full；不会改用其他模型');return p;
 }const p=image.promptProfile||'none';if(!['none',...Object.keys(NAI_PROFILES)].includes(p))throw new Error('提示词型号配置无效');return p;}
export function estimateTokens(value){const parts=String(value||'').match(/[\p{L}\p{N}_]+|[^\s]/gu)||[];
 return parts.reduce((n,p)=>n+(/[\u3400-\u9fff\u3040-\u30ff]/u.test(p)?[...p].length*2:Math.max(1,Math.ceil(p.length/3.5))),0);}
const string=(v,n=500)=>String(v??'').trim().slice(0,n);
const english=(v,label)=>{const s=string(v,1600);if(/[\u3400-\u9fff\u3040-\u30ff]/u.test(s))throw new Error(`${label}尚未编译成英文，请启用提示词API重新编译；不会把中文档案直接塞进Nai`);return s;};
const regions=new Set(['head','face','torso','arms','hands','fingernails','legs','feet','toenails']);
export function frameRegions(scale,focus=''){if(['extreme_close_up','close_up'].includes(scale)){
 if(/fingernail|manicure|nail art|指甲|美甲/i.test(focus))return ['hands','fingernails'];
 if(/feet|footwear|shoe|鞋|足部/i.test(focus))return ['feet','toenails'];return ['head','face'];}
 if(scale==='medium_close')return ['head','face','torso'];
 if(['medium','medium_wide'].includes(scale))return ['head','face','torso','arms','hands','fingernails',...(scale==='medium_wide'?['legs']:[])];return Array.from(regions);}
export function itemRegions(item){const slot=(item.slot||'').toLowerCase();if(/鞋|footwear|feet/.test(slot))return ['feet'];if(/袜|hosiery|bottom|下装|腿|legs/.test(slot))return ['legs'];if(/发饰|额饰|耳饰|面饰|head|ears/.test(slot))return ['head'];if(/指饰|手饰|手套|hands|fingers/.test(slot))return ['hands'];return ['torso'];}
function hiddenNails(source){return (source?.items||[]).some(i=>i.wear_state==='worn'&&/手套|gloves/i.test(i.name+' '+i.fact)&&!/露指|无指|透明|fingerless|transparent|sheer/i.test(i.name+' '+i.fact));}
export function normalizeVisual(raw,base,packets){if(!raw)return null;if(typeof raw!=='object'||Array.isArray(raw))throw new Error('分层视觉提示词必须是对象');
 const sources=packets.map(visualSource),known=new Map(sources.map(x=>[x.id,x]));const ids=new Set(base.cast.map(c=>c.id)),seen=new Set();
 const actors=(Array.isArray(raw.characters)?raw.characters:[]).map(c=>{if(!ids.has(c.id)||seen.has(c.id))throw new Error('分层提示词包含未知或重复角色ID');seen.add(c.id);
  const source=known.get(c.id),items=new Map((source?.items||[]).map(i=>[i.item_id,i]));const visual={id:c.id,identity:string(c.identity,650),outfit:[],expression:string(c.expression,160),pose:string(c.pose,220),gaze:string(c.gaze,100),
   visible_regions:Array.isArray(c.visible_regions)?c.visible_regions.filter(x=>regions.has(x)):frameRegions(base.camera.shot_scale,base.camera.focus)};
  const usedItems=new Set();for(const i of (Array.isArray(c.outfit)?c.outfit:[]).slice(0,80)){const item=items.get(i.item_id);if(!item||usedItems.has(i.item_id))throw new Error('分层服装提示词引用未知或重复的物品ID');usedItems.add(i.item_id);
   const t=string(i.text,500);if(!['worn','partial'].includes(item.wear_state)&&/\bwear(?:ing|s)?\b|\bdressed in\b/i.test(t))throw new Error('提示词试图把未穿戴物品画回身上：'+item.name);
   visual.outfit.push({item_id:i.item_id,text:t,visible:i.visible!==false});}
  const ch=base.cast.find(x=>x.id===c.id);visual.resources=normalizeResourceSelections(c.resources,base.resourceContext,source,{...ch,evidenceStory:base.storyForDirector||base.scene.moment});return visual;});
 for(const c of base.cast)if(!seen.has(c.id))throw new Error('分层提示词缺少角色：'+c.name);
 const scene=(Array.isArray(raw.scene)?raw.scene:[]).slice(0,14).map(x=>string(x,400)).filter(Boolean);
 return {scene,characters:actors};}
function guardSyntax(value,profile){if(value.includes('|'))throw new Error('独立角色提示词中不能混入竖线分隔符');
 if(profile==='nai4full'){
  if(/(?:^|[\s,])-\d+(?:\.\d+)?\s*::/.test(value))throw new Error('Nai 4 Full不支持负数权重，请手动修改锁定画风或提示词');
  if(/\bmasterpiece\b|\b(?:low|medium|high|ultra) complexity\b|\balpha transparency\b/i.test(value))throw new Error('提示词含不适用于Nai 4 Full的标签，请修改后重试；不会切换型号');}
 validateImagePrompt(value,'');}
const join=items=>items.filter(Boolean).join(', ');
function assemble(fragments){const base=[],characters=new Map();for(const f of fragments){const list=f.actor?(characters.get(f.actor)||[]):base;if(!list.some(x=>x.text.toLowerCase()===f.text.toLowerCase()))list.push(f);if(f.actor)characters.set(f.actor,list);}return {base,characters};}
function cost(fragments){const a=assemble(fragments);return {base:estimateTokens(join(a.base.map(x=>x.text))),characters:Array.from(a.characters.values()).reduce((n,v)=>n+estimateTokens(join(v.map(x=>x.text))),0)};}
function fragmentsFor(plan,packets,style,settings,subset=plan.cast,shot=plan.camera.shot_scale,moment=''){
 const sources=packets.map(visualSource),fragments=[],omitted=[];let seq=0;
 const add=(category,text,priority=4,actor=null,required=false,source_ref=null)=>{if(text)fragments.push({id:'f'+(++seq),category,text,priority,actor,required,source_ref});};
 const genderCounts={female:0,male:0,other:0,unknown:0};for(const ch of subset)genderCounts[genderOf(sources.find(x=>x.id===ch.id)?.raw||{})]++;
 const counts=Object.entries(genderCounts).map(([g,n])=>n&&g!=='unknown'?`${n}${g==='female'?(n===1?'girl':'girls'):g==='male'?(n===1?'boy':'boys'):(n===1?'other':'others')}`:'').filter(Boolean);
 if(genderCounts.unknown)counts.push(`${genderCounts.unknown} person${genderCounts.unknown===1?'':'s'} of unspecified gender`);
 add('subjects',join(counts),0,null,true,'role_registry');add('style',String(style.positive||''),0,null,true,{id:style.id,revision:style.revision,locked:style.locked});
 const form=plan.mode==='portrait'?'character key visual':plan.mode==='comic'?'manga panel':plan.mode==='pov'?'pov':'story illustration';add('format',form,1,null,true);
 const scale={full_body:'full body',medium:'medium shot',medium_wide:'cowboy shot',medium_close:'upper body',wide:'wide shot',close_up:'close-up',extreme_close_up:'extreme close-up',extreme_wide:'extreme wide shot'}[shot]||'medium shot';add('camera',scale,2,null,true);
 if(plan.mode==='pov')add('observer',english(plan.observer?.camera,'观察者机位'),0,null,true,'observer');
 if(plan.visual?.scene?.length)for(const s of plan.visual.scene)add('scene',english(s,'场景'),3,null,false,'director');
 else for(const s of [plan.scene.environment,plan.scene.weather_time,plan.scene.moment,plan.camera.lighting])add('scene',english(s,'场景'),3,null,false,'source_scene');
 if(moment)add('panel_moment',english(moment,'漫画分镜'),1,null,true,'panel');
 else if(plan.mode!=='portrait')add('event',english(plan.scene.moment,'画面事件'),1,null,true,'source_scene');
 const elevation={eye_level:'eye-level view',low_angle:'from below',elevated:'slightly elevated view',high_angle:'from above',top_down:'top-down view'}[plan.camera.elevation];
 add('camera_elevation',elevation,2,null,!!plan.cameraPolicy?.angleManual,'camera');
 for(const occlusion of (plan.scene.occlusions||[]).slice(0,3))add('occlusion',english(occlusion,'遮挡关系'),2,null,false,'director');
 for(const contact of (plan.scene.supports||[]).slice(0,3))add('support',english(contact,'接触支撑关系'),2,null,false,'director');
 for(const ch of subset){const source=sources.find(x=>x.id===ch.id),raw=source?.raw||{},v=plan.visual?.characters.find(x=>x.id===ch.id);const gender=genderOf(raw);
  add('gender',{female:'girl',male:'boy',other:'other',unknown:'person of unspecified gender'}[gender],0,ch.id,true,'known_gender');
  const identity=v?.identity||raw.render_identity||[raw.canon?.physical_design?.natural_hair?.color,raw.canon?.physical_design?.natural_hair?.length,raw.canon?.physical_design?.face?.eyes].filter(Boolean).join(', ');
  if(!identity&&JSON.stringify(raw.visual59||raw.canon||{}).length>5)throw new Error('提示词API未提供角色的英文外貌锚点：'+ch.name);
  add('identity',english(identity,'人物外貌'),0,ch.id,true,'formal_identity');
  const visible=new Set(frameRegions(shot,plan.camera.focus).filter(r=>!v?.visible_regions?.length||v.visible_regions.includes(r)));
  const gloves=hiddenNails(source);if(gloves)visible.delete('fingernails');
  const renderItems=v?.outfit||[];
  for(const item of source?.items||[]){const render=renderItems.find(x=>x.item_id===item.item_id);const inFrame=itemRegions(item).some(r=>visible.has(r));
   if(!inFrame||render?.visible===false){omitted.push({character_id:ch.id,item_id:item.item_id,reason:'outside_frame_or_occluded'});continue;}
   if(item.wear_state!=='worn'&&!(item.wear_state==='partial'&&item.members?.some(m=>m.wear_state==='worn'))&&!/手|臂|held|holding|arm|hand/i.test(item.location||'')){omitted.push({character_id:ch.id,item_id:item.item_id,reason:'not_worn_or_visibility_unknown'});continue;}
   const t=render?.text||item.name;if(!t)continue;add('outfit',english(t,'当前服饰与状态'),0,ch.id,true,item.item_id);
  }
  add('action',english(v?.pose||[ch.pose,ch.action].filter(Boolean).join(', '),'动作'),1,ch.id,!!(v?.pose||ch.pose||ch.action),'director');
  add('expression',english(v?.expression||ch.expression,'表情'),2,ch.id,false,'director');add('gaze',english(v?.gaze||ch.gaze,'目光'),3,ch.id,false,'director');
  const position={left:'on the left',right:'on the right',center:'in the center','upper-left':'upper left','upper-right':'upper right','lower-left':'lower left','lower-right':'lower right'}[ch.zone];add('position',position,2,ch.id,false,'director');
  for(const r of v?.resources||[]){let reason='';if(!r.visible||r.regions.length&&!r.regions.some(x=>visible.has(x)))reason='outside_frame';if(r.category==='nails'&&gloves)reason='nails_hidden_by_gloves';if(r.detail&&!['close_up','extreme_close_up'].includes(shot))reason='detail_too_small';
   if(reason){omitted.push({character_id:ch.id,resource_id:r.resource_id,reason});continue;}add(r.category,english(r.text,'素材片段'),['expression','pose'].includes(r.category)?2:4,ch.id,false,r);}
 }
 return {fragments,omitted,genderCounts};}
export function compileNai(plan,packets,settings,style,subset=plan.cast,shot=plan.camera.shot_scale,moment=''){
 const profile=profileFor(settings.image),p=NAI_PROFILES[profile];if(!p)throw new Error('缺少明确的Nai型号');if(subset.length>p.maxCharacters)throw new Error(`${p.label}最多支持${p.maxCharacters}个独立角色，本次${subset.length}个；请缩小画面范围`);
 const data=fragmentsFor(plan,packets,style,settings,subset,shot,moment);for(const f of data.fragments)guardSyntax(f.text,profile);
 let kept=data.fragments.filter(f=>f.required);const dropped=[];
 const fits=list=>{const c=cost(list);return profile==='nai4full'?c.base+c.characters<=p.workingBudget:c.base<=p.workingBudget&&c.characters<=Math.max(700,subset.length*380);};
 if(!fits(kept))throw new Error(`${p.label}估算预算不足以保留锁定画风、人物身份和当前服饰。请缩短画风/英文身份描述或减少同场人物；未截断事实，也未请求生图`);
 for(const f of data.fragments.filter(f=>!f.required).sort((a,b)=>a.priority-b.priority)){if(fits([...kept,f]))kept.push(f);else dropped.push({id:f.id,category:f.category,actor:f.actor,reason:'estimated_budget'});}
 // Restore semantic layer order after retention; never imply that layers are Nai weights.
 kept.sort((a,b)=>Number(a.id.slice(1))-Number(b.id.slice(1)));const assembled=assemble(kept),base=join(assembled.base.map(x=>x.text));
 const characters=subset.map(ch=>({id:ch.id,prompt:join((assembled.characters.get(ch.id)||[]).map(x=>x.text)),negative:'',center:{x:ch.zone?.includes('left')||ch.zone==='left'?0.2:ch.zone?.includes('right')||ch.zone==='right'?0.8:0.5,y:ch.zone?.startsWith('upper')?0.2:ch.zone?.startsWith('lower')?0.8:0.5}}));
 const negative=join([style.negative,settings.image?.negative]);guardSyntax(negative,profile);if(estimateTokens(negative)>460)throw new Error('负面提示词超出本版保守估算预算，请手动缩短；不会截断锁定负面画风');
 const c=cost(kept);const warnings=[];if(/\b(?:solo|\d+girls?|\d+boys?|no text)\b/i.test(style.positive||'')&&subset.length>1)warnings.push('锁定画风含人数或文字条件；已保留原文，请核对是否与本幕冲突');
 return {positive:[base,...characters.map(x=>x.prompt)].join(' | '),negative,nai:{profile,base,characters,negative},
  resourceReport:{template:templateFor(plan.mode).id,catalogSize:2483,selected:kept.filter(x=>x.source_ref?.resource_id),fragments:kept,omitted:[...data.omitted,...dropped],warnings,
   budget:{method:'AVS conservative heuristic, NOT actual model tokenizer',exact:false,baseEstimated:c.base,charactersEstimated:c.characters,negativeEstimated:estimateTokens(negative),officialApprox:p.officialApprox,officialScope:p.scope,workingBaseOrShared:p.workingBudget}}};
}
export function manualNai(positive,negative,image){const profile=profileFor(image),p=NAI_PROFILES[profile];if(!p)return null;const [base,...slots]=String(positive||'').split('|').map(x=>x.trim());
 if(!base||slots.some(x=>!x))throw new Error('手动提示词包含空白全局或角色片段');if(slots.length>p.maxCharacters)throw new Error('手动提示词超出所选Nai的独立角色数量');
 for(const s of [base,...slots,String(negative||'')])guardSyntax(s,profile);
 const b=estimateTokens(base),c=slots.reduce((n,s)=>n+estimateTokens(s),0);if((profile==='nai4full'?b+c:b)>p.workingBudget||estimateTokens(negative)>460)throw new Error('手动提示词超过所选型号的保守估算预算，请缩短后重试');
 return {profile,base,negative:String(negative||''),characters:slots.map((prompt,i)=>({id:'manual-'+i,prompt,negative:'',center:{x:0.5,y:0.5}}))};}
