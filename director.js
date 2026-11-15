/* AVS R2.2.0 scene director. Project-owned implementation of the documented
   character-anchor / region / cinematography contract. No third-party source copied. */
const str=(v,max=2000)=>String(v??'').trim().slice(0,max);
const arr=(v,max=24)=>Array.isArray(v)?v.slice(0,max):[];
const allowedZones=new Set(['left','center','right','upper-left','upper-right','lower-left','lower-right','other']);
const allowedDepth=new Set(['foreground','midground','background']);
const allowedScales=new Set(['extreme_wide','wide','medium_wide','medium','medium_close','close_up','extreme_close_up']);
const allowedAngles=new Set(['low_angle','eye_level','elevated','high_angle','top_down']);
const allowedDOF=new Set(['deep','moderate','shallow','illustrative_layering','none']);
const guardedList=(items,max=12)=>arr(items,max).map(x=>str(x,240)).filter(Boolean);
const uniq=(v)=>[...new Set(v.filter(Boolean))];
export function hashScene(text){let h=2166136261;for(const char of String(text||'')){h^=char.charCodeAt(0);h=Math.imul(h,16777619)}return (h>>>0).toString(16).padStart(8,'0')}
export function archiveSources(packets){return packets.map((raw,i)=>{
 let o;try{o=JSON.parse(raw)}catch{o={name:`角色${i+1}`,raw:String(raw||'')}}
 return {id:str(o.character_id||`unknown-${i}`,120),name:str(o.name||`角色${i+1}`,150),anchor:str(JSON.stringify(o).slice(0,4300),4300),hasFormalId:!!o.character_id};
}).filter(x=>x.id && x.id!=='undefined').slice(0,12)}
export function styleSnapshot(settings){const lock=settings?.styleLock;
 if(lock?.positive && lock?.styleId && lock.revision>=1)return Object.freeze({id:str(lock.styleId,150),revision:lock.revision,positive:str(lock.positive,4000),negative:str(lock.negative,2400),locked:true});
 // Legacy selected style is not silently considered a confirmed lock.
 const old=(settings?.styles||[]).find(x=>x.id===settings?.chosenStyle);
 return Object.freeze({id:old?.id||'default',revision:0,positive:str(old?.analysis?.tags||old?.tags?.join?.(', ')||'clean expressive anime lineart, refined shading',1600),negative:'',locked:false});
}
export function createStyleLock(entry,previous){const positive=str(entry?.positive,4000),negative=str(entry?.negative,2400);
 if(!positive)throw new Error('画风正面提示词不能为空；原锁定画风未改变');
 if(!entry?.styleId)throw new Error('缺少画风来源ID，无法锁定');
 return {styleId:str(entry.styleId,150),revision:(Number(previous?.revision)||0)+1,positive,negative,updatedAt:new Date().toISOString()};
}
export function baselineDirector(ctx,packets,mode,settings){const cast=archiveSources(packets);let members=cast;
 if(mode==='single' && cast.length>1)members=cast.slice(0,1);
 const count=members.length;const zones=count===1?['center']:count===2?['left','right']:['left','center','right','upper-left','upper-right','lower-left','lower-right'];
 const camera=settings?.director||{};
 const box={schema_version:'avs-director-exec-1',mode,source:{chatId:str(ctx.id,200),messageIndex:ctx.index,sourceHash:hashScene(ctx.text)},
 scene:{environment:'',weather_time:'',objects:[],atmosphere:'',moment:str(ctx.text,2300),supports:[],occlusions:[],material_response:[]},
 cast:members.map((x,i)=>({id:x.id,name:x.name,zone:zones[i%zones.length],depth:'midground',facing:'toward the interaction',expression:'',gaze:'',pose:'',action:'',visible_physiology:[],wardrobe_motion:''})),
 interactions:[],effects:[],negative_risks:[],
 cameraPolicy:{shotScaleManual:!!camera.shotScale&&camera.shotScale!=='auto',angleManual:!!camera.elevation&&camera.elevation!=='auto',depthManual:!!camera.depthOfField&&camera.depthOfField!=='auto'},
 camera:{shot_scale:camera.shotScale==='auto'?(count>2?'medium_wide':'medium'):camera.shotScale||'medium_wide',elevation:camera.elevation==='auto'?'eye_level':camera.elevation||'eye_level',azimuth:'front_quarter',viewpoint:'in front of the active scene',projection:'natural perspective',composition:'readable character grouping with natural depth and clear interactions',visual_path:'from main faces toward the action and the key prop',focus:'faces and interacting hands',depth_of_field:camera.depthOfField==='auto'?(count>1?'deep':'moderate'):camera.depthOfField||'moderate',lighting:'scene-motivated lighting; plausible highlight and shadow direction',mood:'',light_sources:[],focus_targets:members.map(x=>x.id),foreground:[],background:[],axis_policy:'preserve_screen_direction'},
 panels:mode==='comic'?[{order:1,moment:'establish the scene and the characters before the main action',subjects:members.map(c=>c.id),shot_scale:'medium_wide',dialogue:[],continuity:''},{order:2,moment:'show the next distinct beat, continuing the same action and character state',subjects:members.map(c=>c.id),shot_scale:'medium',dialogue:[],continuity:'preserve positions, costume and object ownership from panel 1'}]:[]};
 return box;
}
const MODEL_SYSTEM=`You are the AVS ACGN visual STORYBOARD DIRECTOR, not a free-form prompt writer. Return ONE strict JSON object and no markdown. Do not output any style tags, positive prompt or negative prompt. The authoritative AVS character archive is read-only and the visual style is locked externally. Do not invent or change hair color, body proportions, clothing items, known relationships, or established items. You may plan temporary visible expressions, camera, perspective, motivated lighting, pose, interactions, physiology (visible signs only), physics of support/contact/occlusion, special effects, and comic continuity where justified by the provided scene. Every character id must exactly match provided IDs. Never confuse actor and target. Only use visible on-scene people. Avoid forcing the scene into a lineup photograph; direct a coherent story moment. Avoid generic cinematic clichés or unsupported precise camera measurements. For comics split the timeline into separate adjacent moments; speech must use quoted/clearly supported dialogue, not made up facts. If an element is uncertain leave it empty instead of asserting it.`;
export function directorRequest(base,packets,settings){const roster=archiveSources(packets).map(x=>({id:x.id,name:x.name,archive:x.anchor}));
 const instruction={
 scene:{environment:'visible place, optional',weather_time:'time/weather if evidenced',objects:['visible objects'],atmosphere:'scene-supported emotion',moment:'one drawable decisive instant',supports:['supported character/prop and contact point'],occlusions:['what covers what'],material_response:['fabric or surface response to force/weather']},
 cast:[{id:'EXACT PROVIDED ID',zone:'left|center|right|upper-left|upper-right|lower-left|lower-right|other',depth:'foreground|midground|background',facing:'orientation',expression:'visible facial expression',gaze:'gaze target',pose:'body posture',action:'one instantaneous action',visible_physiology:['visible blush/sweat/breath when justified'],wardrobe_motion:'physical temporary movement of existing clothing, no new clothes'}],
 interactions:[{actor_id:'provided character ID',target_id:'provided character ID or exact scene object name',action:'visible interaction',contact:'specific contact, no invention',result:'physical visible effect'}],
 effects:[{source:'defined source',appearance:'observable VFX',direction:'direction and lighting effect'}],negative_risks:['specific visual synthesis pitfalls, not style and not character properties'],
 camera:{shot_scale:'medium|medium_wide|wide|close_up|medium_close|extreme_wide|extreme_close_up',elevation:'eye_level|low_angle|elevated|high_angle|top_down',azimuth:'front|front_quarter|side|back_quarter|back',viewpoint:'where observer is',projection:'natural/wide/compressed perspective',composition:'spatial arrangement and intentional negative space',visual_path:'guided view sequence',focus:'which character/prop in focus',depth_of_field:'deep|moderate|shallow|illustrative_layering|none',lighting:'source direction, shadow and bounce, motivated',mood:'emotional intention through framing and illumination',light_sources:[{source:'e.g. window',direction:'left to right',quality:'soft',shadow_logic:'soft consistent shadows'}],focus_targets:['provided character IDs'],foreground:['visible foreground planes'],background:['visible background planes'],axis_policy:'preserve_screen_direction|justified_axis_crossing'},
 panels:[{order:1,moment:'distinct beat',subjects:['provided character ID'],shot_scale:'medium',dialogue:[{speaker_id:'provided character ID',text:'supported Chinese dialogue'}],continuity:'what carries from previous panel'}]};
 return {system:MODEL_SYSTEM,user:JSON.stringify({task:'Return a partial scene/director plan using the schema outline; omit unclear details. NEVER include visual style fields or whole-image positive/negative strings.',mode:base.mode,story:String(base.scene.moment).slice(-6000),archive:roster,cinematographyOverrides:settings?.director||{},expectedPanelCount:base.panels.length,format:instruction})};
}
function jsonObject(raw){const s=str(raw,50000).replace(/<think>[\s\S]*?<\/think>/gi,'');try{return JSON.parse(s)}catch{}
 const match=s.match(/\{[\s\S]*\}/);if(!match)throw new Error('导演模型未返回JSON，已停止，未请求生图');try{return JSON.parse(match[0])}catch{throw new Error('导演模型JSON无效，已停止，未请求生图')}}
export function normalizeDirector(raw,base){const incoming=typeof raw==='string'?jsonObject(raw):raw;
 if(!incoming||typeof incoming!=='object'||Array.isArray(incoming))throw new Error('导演计划必须是JSON对象');
 if(incoming.positive||incoming.negative||incoming.style||incoming.style_positive||incoming.style_negative||incoming.style_lock_ref){throw new Error('导演模型试图改写画风或最终提示词，已拒绝此响应');}
 const next=structuredClone(base);const roster=new Map(next.cast.map(c=>[c.id,c]));const ids=new Set(roster.keys());
 const incomingIds=new Set();
 for(const c of arr(incoming.cast,30)){
  const id=str(c?.id||c?.character_id,120);if(!ids.has(id))throw new Error(`导演模型引用了未在正式角色选择中的人物ID：${id||'空'}`);
  if(incomingIds.has(id))throw new Error('导演计划重复引用角色：'+id);incomingIds.add(id);
  const target=roster.get(id);for(const k of ['facing','expression','gaze','pose','action','wardrobe_motion'])if(c[k]!==undefined)target[k]=str(c[k],240);
  if(allowedZones.has(c.zone))target.zone=c.zone;if(allowedDepth.has(c.depth))target.depth=c.depth;
  target.visible_physiology=guardedList(c.visible_physiology,4);
 }
 for(const k of ['environment','weather_time','atmosphere','moment'])if(incoming.scene?.[k]!==undefined)next.scene[k]=str(incoming.scene[k],1000);
 if(incoming.scene?.objects!==undefined)next.scene.objects=guardedList(incoming.scene.objects,24);
 for(const f of ['supports','occlusions','material_response'])if(incoming.scene?.[f]!==undefined)next.scene[f]=guardedList(incoming.scene[f],12);
 const objects=new Set(next.scene.objects.map(x=>x.toLowerCase()));
 next.interactions=arr(incoming.interactions,20).map(i=>({actor_id:str(i.actor_id,120),target_id:str(i.target_id,120),action:str(i.action,240),contact:str(i.contact,240),result:str(i.result,240)})).filter(i=>i.actor_id||i.target_id);
 for(const i of next.interactions){if(!ids.has(i.actor_id))throw new Error('导演互动引用未知动作发起者：'+i.actor_id);if(i.target_id&&!ids.has(i.target_id)&&!objects.has(i.target_id.toLowerCase()))throw new Error('导演互动引用未知目标：'+i.target_id)}
 next.effects=arr(incoming.effects,10).map(x=>({source:str(x.source,120),appearance:str(x.appearance,180),direction:str(x.direction,180)})).filter(x=>x.source);
 next.negative_risks=guardedList(incoming.negative_risks,12).filter(x=>!/(?:^|[, ])(?:solo|no people|no text|no dialogue|multiple panels)(?:$|[, ])/i.test(x));
 const camera=next.camera;for(const k of ['viewpoint','projection','composition','visual_path','focus','lighting','mood'])if(incoming.camera?.[k]!==undefined)camera[k]=str(incoming.camera[k],320);
 if(allowedScales.has(incoming.camera?.shot_scale)&&!base.cameraPolicy?.shotScaleManual)camera.shot_scale=incoming.camera.shot_scale;
 if(allowedAngles.has(incoming.camera?.elevation)&&!base.cameraPolicy?.angleManual)camera.elevation=incoming.camera.elevation;
 if(['front','front_quarter','side','back_quarter','back'].includes(incoming.camera?.azimuth))camera.azimuth=incoming.camera.azimuth;
 if(allowedDOF.has(incoming.camera?.depth_of_field)&&!base.cameraPolicy?.depthManual)camera.depth_of_field=incoming.camera.depth_of_field;
 if(incoming.camera?.light_sources!==undefined)camera.light_sources=arr(incoming.camera.light_sources,6).map(l=>({source:str(l.source,100),direction:str(l.direction,100),quality:str(l.quality,100),shadow_logic:str(l.shadow_logic,160)})).filter(l=>l.source);
 if(incoming.camera?.focus_targets!==undefined){camera.focus_targets=arr(incoming.camera.focus_targets,8).map(x=>str(x,120));for(const id of camera.focus_targets)if(!ids.has(id)&&!objects.has(id.toLowerCase()))throw new Error('摄影焦点引用未知对象：'+id)}
 for(const k of ['foreground','background'])if(incoming.camera?.[k]!==undefined)camera[k]=guardedList(incoming.camera[k],10);
 if(['preserve_screen_direction','justified_axis_crossing'].includes(incoming.camera?.axis_policy))camera.axis_policy=incoming.camera.axis_policy;
 if(base.mode==='comic' && incoming.panels!==undefined){
   const panels=arr(incoming.panels,base.panels.length);
   if(panels.length!==base.panels.length)throw new Error(`漫画导演应返回${base.panels.length}格，实际${panels.length}格`);
   const orders=new Set();for(const p of panels){const order=Number(p.order);if(!Number.isInteger(order)||order<1||order>base.panels.length||orders.has(order))throw new Error('漫画分镜序号错误或重复');orders.add(order);
    const dst=next.panels[order-1];for(const k of ['moment','continuity'])if(p[k]!==undefined)dst[k]=str(p[k],550);if(allowedScales.has(p.shot_scale))dst.shot_scale=p.shot_scale;
    if(p.subjects!==undefined){dst.subjects=arr(p.subjects,12).map(x=>str(x,120));for(const id of dst.subjects)if(!ids.has(id))throw new Error('漫画格引用未知角色：'+id)}
    dst.dialogue=arr(p.dialogue,6).map(d=>({speaker_id:str(d.speaker_id,120),text:str(d.text,120)})).filter(d=>d.text);for(const d of dst.dialogue)if(d.speaker_id&&!ids.has(d.speaker_id))throw new Error('漫画对白说话人ID无效：'+d.speaker_id);
   }
 }
 return next;
}
const zones={left:'at the left of the frame',center:'at the center',right:'at the right of the frame','upper-left':'upper left','upper-right':'upper right','lower-left':'lower left','lower-right':'lower right',other:'at a scene-appropriate position'};
const scales={extreme_wide:'extreme wide establishing shot',wide:'wide shot',medium_wide:'medium-wide group shot',medium:'medium shot',medium_close:'medium close-up',close_up:'close-up',extreme_close_up:'extreme close-up'};
const angles={low_angle:'low-angle view',eye_level:'eye-level view',elevated:'slightly elevated view',high_angle:'high-angle view',top_down:'top-down view'};
const dof={deep:'deep focus, all essential subjects readable',moderate:'moderate depth of field, clear primary subjects',shallow:'shallow depth of field focused on the intended subject',illustrative_layering:'illustrated foreground/midground/background layers',none:'uniformly crisp focus'};
const compact=(items)=>uniq(items.map(x=>str(x,8000)).filter(Boolean)).join(', ');
function charPrompt(ch,reference){return compact([
   `${reference.name} [character_id=${reference.id}]: authoritative AVS visual identity and CURRENT clothing (do not alter or invent): ${reference.anchor}`,
   zones[ch.zone],`${ch.depth} plane`,ch.facing,ch.pose,ch.action,ch.expression,ch.gaze,...ch.visible_physiology,ch.wardrobe_motion
 ]);}
export function compileDirector(plan,packets,settings,styleRef){const source=archiveSources(packets);const refs=new Map(source.map(x=>[x.id,x]));
 const allowed=new Set(refs.keys());for(const c of plan.cast)if(!allowed.has(c.id))throw new Error('角色档案引用校验失败：'+c.id);
 const scene=plan.scene,cam=plan.camera,characters=plan.cast.map(c=>charPrompt(c,refs.get(c.id)));
 const light=compact([cam.lighting,...cam.light_sources.map(l=>`motivated source ${l.source} from ${l.direction}, ${l.quality}, ${l.shadow_logic}`),cam.mood]);
 const camera=compact([scales[cam.shot_scale]||cam.shot_scale,angles[cam.elevation]||cam.elevation,cam.azimuth+' camera azimuth',cam.viewpoint,cam.projection,cam.composition,cam.visual_path,cam.focus,dof[cam.depth_of_field],...cam.focus_targets.map(id=>'focus anchor '+id),...cam.foreground.map(x=>'foreground '+x),...cam.background.map(x=>'background '+x),cam.axis_policy,light]);
 const interactions=plan.interactions.map(i=>`${i.actor_id} ${i.action} ${i.target_id}, ${i.contact}, ${i.result}`);
 const effects=plan.effects.map(e=>`${e.appearance} from ${e.source}, direction ${e.direction}`);
 const base=compact([plan.mode==='comic'?'ACGN manga storyboard illustration':plan.mode==='group'?`ACGN story-driven group illustration of ${plan.cast.length} named characters`:'ACGN story illustration',
   styleRef.positive,scene.environment,scene.weather_time,scene.atmosphere,scene.moment,...scene.objects.map(x=>'scene object: '+x),...scene.supports,...scene.occlusions,...scene.material_response,camera,
   ...characters,...interactions,...effects,
   'coherent spatial perspective, physically plausible contact and weight support, consistent shadows, readable faces and action']);
 const baseNegative=compact([styleRef.negative,settings?.image?.negative||'',plan.cast.length>1?'missing cast, duplicated cast, swapped identity, merged bodies, incorrect shared clothing, cropped key faces, conflicting gaze':'duplicated subject, malformed limbs',...plan.negative_risks]);
 const panels=plan.mode==='comic'?plan.panels.map(p=>{
  const selected=new Set(p.subjects);const people=plan.cast.filter(c=>selected.has(c.id)).map(c=>charPrompt(c,refs.get(c.id)));
  const positive=compact(['manga panel '+p.order,styleRef.positive,scene.environment,scene.weather_time,
    p.moment,scales[p.shot_scale]||scales[cam.shot_scale],angles[cam.elevation],cam.composition,cam.lighting,...cam.light_sources.map(l=>l.source+' light from '+l.direction),dof[cam.depth_of_field],cam.axis_policy,...people,...interactions.filter(i=>selected.has(i.actor_id)),p.continuity,
    'one coherent story beat, character and prop continuity, safe space for Chinese dialogue added in post-production']);
  return {order:p.order,positive,negative:compact([baseNegative,'gibberish letters, accidental pseudo-text, duplicated speech bubbles']),dialogue:p.dialogue,subjects:p.subjects,shot:p.shot_scale,moment:p.moment};
 }):[];
 return {positive:base,negative:baseNegative,panels,plan,source:'AVS R2.2结构化导演 + 本地编译',styleRevision:styleRef.revision,styleId:styleRef.id,note:`镜头：${scales[cam.shot_scale]||cam.shot_scale} · 景深：${cam.depth_of_field} · ${plan.cast.length}名角色`};
}
