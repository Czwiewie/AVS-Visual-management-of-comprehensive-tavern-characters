/* AVS R2.3: voluntary, per-card fandom discovery. Only advisory, never writes AVS archives.
   Reuses the configured text model; Wikimedia search establishes an independently
   observed series title. No Pixiv copying, no guessed character-image references. */
import {visionChat,fetchTimeout} from './engines.js';

const clean=(v,n=250)=>String(v??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,n);
const keyFor=(c)=>{const id=c?.characterId??c?.character_id??c?.groupId;return id===undefined||id===null?'':String(id)};
export function cardContext(c){
 const id=keyFor(c);const card=c?.characters?.[c?.characterId]||c?.characters?.find?.(v=>String(v?.id)===id)||null;
 if(!card)return {id,source:'',fingerprint:'',name:''};
 const a=card?.data||card;
 const desc=[card.name,a.name,a.description,a.scenario,a.first_mes,a.mes_example,a.personality,card.description,card.scenario].filter(Boolean).map(x=>clean(x,3500)).join('\n').slice(0,10000);
 let h=2166136261;for(const ch of desc){h^=ch.charCodeAt(0);h=Math.imul(h,16777619)}
 return {id,source:desc,fingerprint:(h>>>0).toString(16),name:clean(card.name||a.name,100)};
}
const parseJSON=(v)=>{const text=String(v||'').replace(/<think>[\s\S]*?<\/think>/gi,'');const match=text.match(/\{[\s\S]*\}/);if(!match)throw new Error('作品识别模型未返回JSON');return JSON.parse(match[0])};
export function fanEnabled(settings,card){return !!(card.id&&settings?.fanCards?.[card.id]?.enabled)};
export function fanSummary(settings,card){const x=settings?.fanCards?.[card.id];return x?.enabled?{enabled:true,work:x.work||'',medium:x.medium||'',status:x.status||'waiting',url:x.url||'',characters:x.characters||[]}:null;}
async function verifyWork(work,signal){
 if(!work)return null;
 const url='https://zh.wikipedia.org/w/api.php?action=query&list=search&format=json&utf8=1&origin=*&srlimit=5&srsearch='+encodeURIComponent(work);
 const normalized=s=>String(s||'').replace(/[\s《》「」『』:：・·\-]/g,'').toLowerCase();
 const goal=normalized(work);
 try{
  const res=await fetchTimeout(url,{credentials:'omit',signal},17000);
  if(res.ok){const j=await res.json(),list=j?.query?.search||[];
   const exact=list.find(x=>{const title=normalized(x.title);return title===goal||title.startsWith(goal+'(')||title.startsWith(goal+'（')});
   if(exact)return {title:clean(exact.title,130),url:'https://zh.wikipedia.org/wiki/'+encodeURIComponent(exact.title.replace(/ /g,'_'))};
  }
 }catch(e){/* Query failure: try another public encyclopedia source. */}
 // Public Wikidata entity catalogue provides simplified Chinese labels for some works.
 const api='https://www.wikidata.org/w/api.php?action=wbsearchentities&search='+encodeURIComponent(work)+'&language=zh-cn&limit=7&format=json&origin=*';
 const r=await fetchTimeout(api,{credentials:'omit',signal},16000);
 if(!r.ok)return null;const data=await r.json();const hits=Array.isArray(data.search)?data.search:[];
 const matched=hits.find(x=>normalized(x.label)===goal||normalized(x.match?.text)===goal);
 return matched&&/^Q\d+$/.test(String(matched.id))?{title:clean(matched.label,130),url:'https://www.wikidata.org/wiki/'+matched.id}:null;
}
export async function discoverFanCard(context,settings,signal){
 const card=cardContext(context);if(!fanEnabled(settings,card)||!card.source)return null;
 const existing=settings.fanCards[card.id];
 if(existing?.fingerprint===card.fingerprint && existing?.status==='verified')return existing;
 if(!settings.prompt?.useMain && !(settings.prompt?.key&&settings.prompt?.model)){existing.status='needs_vision_model';return existing;}
 const current=Date.now();if(existing?.fingerprint===card.fingerprint&&existing?.attemptedAt&&current-existing.attemptedAt<6*3600e3)return existing;
 const stamp=String(card.fingerprint);
 // Mark before network work, avoiding duplicate calls from UI refresh and prompt compilation.
 existing.fingerprint=stamp;existing.attemptedAt=current;existing.status='checking';
 const system='你是ACGN作品来源检索规划器。仅识别角色卡已有的作品线索，不要捏造作品名。输出JSON：{"work":"作品的常见官方中文名或日文原名","medium":"anime|game|manga|novel|unknown","confidence":"high|medium|low","characters":[{"name":"卡内已出现角色","sourceCharacter":"可确定的原作名字或空字符串"}],"evidence":"角色卡中支持判断的极短原句"}。不能确认时work为空。不要推断魔改名称就是原作人物。';
 try{
  const early=(Array.isArray(context?.chat)?context.chat:[]).slice(0,5).map(x=>clean(x?.mes||x?.message,420)).filter(Boolean).join('\n');
  const prompt=`只使用这份角色卡介绍、背景、开场与已有剧情线索。\n角色卡：${card.source}\n剧情早期线索：${early}`;
  let raw;
  if(settings.prompt?.useMain){if(typeof context?.generateRaw!=='function')throw new Error('SillyTavern主API不支持来源识别');raw=await context.generateRaw({systemPrompt:system,prompt});}
  else raw=await visionChat(settings.prompt,system,prompt,null,signal);
  const parsed=parseJSON(raw),work=clean(parsed.work,100),confidence=clean(parsed.confidence,12);
  if(!work||confidence==='low')throw new Error('文本证据不足，未确认所属作品');
  const matched=await verifyWork(work,signal).catch(()=>null);
  if(!matched)throw new Error('作品名称未通过公开百科标题核验');
  existing.work=matched.title;existing.medium=clean(parsed.medium,30);existing.url=matched.url;
  existing.evidence=clean(parsed.evidence,170);
  existing.characters=(Array.isArray(parsed.characters)?parsed.characters:[]).slice(0,24).map(v=>({name:clean(v?.name,80),sourceCharacter:clean(v?.sourceCharacter,80)})).filter(x=>x.name);
  existing.status='verified';existing.verifiedAt=Date.now();existing.error='';
 }catch(err){existing.status='unverified';existing.error=clean(err?.message||err,180);existing.work='';existing.url='';existing.characters=[];}
 return existing;
}
export function fanReferenceForPrompt(settings,context){
 const card=cardContext(context),v=settings?.fanCards?.[card.id];
 if(!v?.enabled||v.status!=='verified'||!v.work||v.fingerprint!==card.fingerprint)return '';
 const characters=(v.characters||[]).map(x=>`${x.name}${x.sourceCharacter&&x.name!==x.sourceCharacter?`（可能对应${x.sourceCharacter}，仅在姓名和文本事实吻合时采用）`:''}`).join('、');
 return `同人角色卡背景：用户已启用同人识别。公开百科已核对作品名称「${v.work}」（${v.medium||'unknown'}），出处 ${v.url}。以下角色名仅作检索线索，不可视为已核验原作外貌：${characters||'未确认角色映射'}。绘图中优先继承AVS正式档案；若角色与原作人物身份能从明确证据核实，可使用已知原作视觉锚点；不擅自换装/改写正式59项。不能把其他角色或随机Pixiv同人插画当作身份参考。`;
}
