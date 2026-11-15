export function sanitizeUrl(base){const u=new URL(String(base||''));if(!['http:','https:'].includes(u.protocol))throw new Error('仅支持HTTP/HTTPS服务地址');return u.href.replace(/\/+$/,'')}
function authHeader(key){return key?{'Authorization':`Bearer ${key.trim()}`}:{}}
export async function fetchTimeout(url,options={},ms=125000){const ac=new AbortController();const timer=setTimeout(()=>ac.abort('timeout'),ms);const incoming=options.signal;
 const onAbort=()=>ac.abort(incoming.reason||'user');if(incoming){if(incoming.aborted)onAbort();else incoming.addEventListener('abort',onAbort,{once:true})}
 try{return await fetch(url,{...options,signal:ac.signal})}catch(e){if(ac.signal.aborted&&incoming?.aborted)throw new Error('已取消当前任务');if(ac.signal.aborted)throw new Error('连接超时，请检查服务商响应或调整线路');if(e instanceof TypeError)throw new Error('浏览器直连失败：检查地址、网络、CORS跨域权限及HTTPS混合内容限制。'+e.message);throw e}
 finally{clearTimeout(timer);incoming?.removeEventListener('abort',onAbort)}}
async function needOK(r){if(r.ok)return r;const t=(await r.text().catch(()=>''));let msg=t.slice(0,420);try{const j=JSON.parse(t);msg=j.error?.message||j.message||j.error||msg}catch{}throw new Error(`服务商 HTTP ${r.status}：${String(msg).slice(0,380)}`)}
export async function models(base,key,signal){
 const endpoint=`${sanitizeUrl(base)}/models`;
 const r=await needOK(await fetchTimeout(endpoint,{headers:{...authHeader(key),'Accept':'application/json'},signal},35000));
 const text=(await r.text()).trim();
 if(text.startsWith('<'))throw new Error('模型列表接口返回HTML网页，不是JSON。请确认基础URL以正确的小写/v1结尾；最终URL：'+r.url.slice(0,180));
 let json;try{json=JSON.parse(text)}catch{throw new Error('模型列表接口返回了无法解析的JSON：'+endpoint)}
 let list=Array.isArray(json)?json:(json.data||json.models||json.result?.data||json.result?.models||[]);
 if(list&&typeof list==='object'&&!Array.isArray(list))list=Object.values(list);
 if(!Array.isArray(list))throw new Error('模型列表JSON不包含data/models数组：请核对服务商是否兼容GET /models');
 const ids=list.map(x=>typeof x==='string'?x:(x?.id||x?.name||x?.model||x?.model_id)).filter(v=>typeof v==='string'&&v.trim()).map(x=>x.trim());
 const dedup=[...new Set(ids)];return dedup.sort((a,b)=>a.localeCompare(b,'zh-CN',{numeric:true,sensitivity:'base'}));
}
export async function visionChat(settings,system,text,imageData,signal){
 const base=sanitizeUrl(settings.base);if(!settings.key&&!settings.useMain)throw new Error('尚未设置提示词API密钥');
 if(!settings.model)throw new Error('尚未选择提示词模型');
 const content=[{type:'text',text:String(text).slice(0,16500)}];if(imageData)content.push({type:'image_url',image_url:{url:imageData}});
 const body={model:settings.model,messages:[{role:'system',content:system},{role:'user',content}],temperature:Number(settings.temperature)||0.6};
 const r=await needOK(await fetchTimeout(`${base}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',...authHeader(settings.key)},body:JSON.stringify(body),signal},135000));
 const j=await r.json();const m=j.choices?.[0]?.message?.content;return typeof m==='string'?m:Array.isArray(m)?m.map(v=>v.text||'').join(''):JSON.stringify(m||'');
}
export async function openaiImage(settings,prompt,negative,signal){const base=sanitizeUrl(settings.base);if(!settings.model)throw new Error('尚未填写生图模型');
 // OpenAI-compatible image generation has no portable native negative_prompt field.
 // Convert scene/style negatives to plain language, never pretend a native negative field was used.
 const requestPrompt=String(negative||'').trim()?`${prompt}\n\nVisual exclusions (avoid these results): ${String(negative).slice(0,3200)}`:prompt;
 const body={model:settings.model,prompt:requestPrompt,n:1,size:settings.size};const r=await needOK(await fetchTimeout(`${base}/images/generations`,{method:'POST',headers:{'Content-Type':'application/json',...authHeader(settings.key)},body:JSON.stringify(body),signal},190000));
 const j=await r.json(),v=j.data?.[0]||j.images?.[0]||j.output?.[0];if(!v)throw new Error('图像API没有返回图片数据');
 if(v.b64_json||v.b64||v.image_base64)return base64Blob(v.b64_json||v.b64||v.image_base64);
 const link=v.url||v.image_url;if(link){const q=await needOK(await fetchTimeout(link,{signal},75000));return await q.blob()}
 throw new Error('服务商返回了未知图片字段，无法解析');}
export function base64Blob(str,type='image/png'){const base=String(str||'').split(',').pop();const bytes=atob(base),array=new Uint8Array(bytes.length);for(let i=0;i<bytes.length;i++)array[i]=bytes.charCodeAt(i);return new Blob([array],{type})}
export function blobToDataURL(blob){return new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=()=>rej(r.error);r.readAsDataURL(blob)})}
export async function listCheckpoints(base,signal){const r=await needOK(await fetchTimeout(`${sanitizeUrl(base)}/object_info/CheckpointLoaderSimple`,{signal},30000));const x=await r.json();return x.CheckpointLoaderSimple?.input?.required?.ckpt_name?.[0]||[]}
const sizeFor=(size)=>{const [w,h]=String(size||'1024x1536').split('x').map(Number);return [w||1024,h||1536]};
export function comfyDefault(prompt,negative,image){const [w,h]=sizeFor(image.size);if(!image.checkpoint)throw new Error('ComfyUI尚未选择Checkpoint模型');return {
 '1':{class_type:'CheckpointLoaderSimple',inputs:{ckpt_name:image.checkpoint}},
 '2':{class_type:'CLIPTextEncode',inputs:{text:prompt,clip:['1',1]}},
 '3':{class_type:'CLIPTextEncode',inputs:{text:negative,clip:['1',1]}},
 '4':{class_type:'EmptyLatentImage',inputs:{width:w,height:h,batch_size:1}},
 '5':{class_type:'KSampler',inputs:{seed:Math.floor(Math.random()*2147483647),steps:Number(image.steps)||28,cfg:Number(image.cfg)||6.5,sampler_name:'euler',scheduler:'normal',denoise:1,model:['1',0],positive:['2',0],negative:['3',0],latent_image:['4',0]}},
 '6':{class_type:'VAEDecode',inputs:{samples:['5',0],vae:['1',2]}},
 '7':{class_type:'SaveImage',inputs:{filename_prefix:'AVS_R2',images:['6',0]}}
};}
export function applyWorkflow(text,prompt,negative,image){let workflow;try{workflow=JSON.parse(text)}catch{throw new Error('ComfyUI工作流JSON无法解析')}
 const [w,h]=sizeFor(image.size);const seed=Math.floor(Math.random()*2147483647);
 const replacements={'{{PROMPT}}':prompt,'{{NEGATIVE}}':negative,'{{WIDTH}}':w,'{{HEIGHT}}':h,'{{SEED}}':seed,'{{CKPT}}':image.checkpoint};
 const apply=x=>{if(typeof x==='string'){if(replacements[x]!==undefined)return replacements[x];let t=x;for(const [k,v] of Object.entries(replacements))t=t.replaceAll(k,String(v));return t}if(Array.isArray(x))return x.map(apply);if(x&&typeof x==='object')return Object.fromEntries(Object.entries(x).map(([k,v])=>[k,apply(v)]));return x};return apply(workflow)}
const nap=(ms)=>new Promise(r=>setTimeout(r,ms));
export async function comfyImage(settings,prompt,negative,signal,progress=()=>{}){const base=sanitizeUrl(settings.comfyBase),wf=settings.workflow?.trim()?applyWorkflow(settings.workflow,prompt,negative,settings):comfyDefault(prompt,negative,settings);
 const r=await needOK(await fetchTimeout(`${base}/prompt`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt:wf,client_id:'avs-r2-visual'}),signal},42000));const j=await r.json(),id=j.prompt_id;if(!id)throw new Error('ComfyUI未返回prompt_id：'+JSON.stringify(j).slice(0,270));progress('ComfyUI已接收任务 '+id.slice(0,8));
 const until=Date.now()+240000;while(Date.now()<until){if(signal?.aborted)throw new Error('已停止等待ComfyUI图片（服务器端任务可能继续执行）');await nap(1650);let h;
 try{const q=await needOK(await fetchTimeout(`${base}/history/${encodeURIComponent(id)}`,{signal},16000));h=await q.json()}catch(e){progress('正在等待ComfyUI返回历史…');continue}
 const item=h[id];if(!item)continue;if(item.status?.status_str==='error')throw new Error('ComfyUI执行失败，请检查工作流节点。'+JSON.stringify(item.status.messages||'').slice(0,220));
 for(const node of Object.values(item.outputs||{})){const img=node.images?.[0];if(img?.filename){const u=`${base}/view?filename=${encodeURIComponent(img.filename)}&subfolder=${encodeURIComponent(img.subfolder||'')}&type=${encodeURIComponent(img.type||'output')}&preview=jpeg;92`;const ir=await needOK(await fetchTimeout(u,{signal},40000));return await ir.blob()}}
 }
 throw new Error('ComfyUI任务超时；未重新提交任务，避免重复扣费。');}
async function zipFirstImage(data){
 const bytes=new Uint8Array(data),view=new DataView(data);let eocd=-1;
 // Read ZIP central directory (including entries that use a data descriptor).
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--){if(view.getUint32(i,true)===0x06054b50){eocd=i;break}}
 if(eocd<0)throw new Error('NovelAI响应不是有效ZIP压缩包');
 const total=view.getUint16(eocd+10,true),central=view.getUint32(eocd+16,true);
 if(total>500)throw new Error('NovelAI ZIP文件数量异常');
 let off=central;
 for(let idx=0;idx<total;idx++){
  if(off+46>bytes.length||view.getUint32(off,true)!==0x02014b50)throw new Error('NovelAI ZIP中央目录损坏');
  const method=view.getUint16(off+10,true),compressed=view.getUint32(off+20,true),namelen=view.getUint16(off+28,true),extra=view.getUint16(off+30,true),comment=view.getUint16(off+32,true),local=view.getUint32(off+42,true);
  const name=new TextDecoder().decode(bytes.slice(off+46,off+46+namelen));off+=46+namelen+extra+comment;
  if(!/\.(png|jpe?g|webp)$/i.test(name))continue;
  if(local+30>bytes.length||view.getUint32(local,true)!==0x04034b50)throw new Error('NovelAI图片文件入口损坏');
  const start=local+30+view.getUint16(local+26,true)+view.getUint16(local+28,true);
  if(start+compressed>bytes.length)throw new Error('NovelAI图片ZIP数据截断');
  let out=bytes.slice(start,start+compressed);
  if(method===8){if(!('DecompressionStream'in globalThis))throw new Error('浏览器不支持ZIP解压');const stream=new Blob([out]).stream().pipeThrough(new DecompressionStream('deflate-raw'));out=new Uint8Array(await new Response(stream).arrayBuffer())}
  else if(method!==0)throw new Error('不支持的NovelAI ZIP压缩算法');
  return new Blob([out],{type:/\.jpe?g$/i.test(name)?'image/jpeg':/\.webp$/i.test(name)?'image/webp':'image/png'});
 }
 throw new Error('NovelAI压缩包中没有可识别的图片');
}
export async function novelaiImage(settings,prompt,negative,signal){if(!settings.key)throw new Error('NovelAI需要Persistent API Token');const [w,h]=sizeFor(settings.size),model=settings.naiModel||'nai-diffusion-5-full';const pars={params_version:model.includes('-5-')?4:3,width:w,height:h,scale:5,sampler:'k_euler_ancestral',steps:28,n_samples:1,qualityToggle:false,ucPreset:4,sm:false,sm_dyn:false,dynamic_thresholding:false,controlnet_strength:1,legacy:false,add_original_image:true,uncond_scale:1,noise_schedule:'karras',negative_prompt:negative,v4_prompt:{caption:{base_caption:prompt,char_captions:[]},use_coords:false,use_order:true},v4_negative_prompt:{caption:{base_caption:negative,char_captions:[]},legacy_uc:false}};
 const r=await needOK(await fetchTimeout('https://image.novelai.net/ai/generate-image',{method:'POST',headers:{...authHeader(settings.key),'Content-Type':'application/json'},body:JSON.stringify({input:prompt,model,action:'generate',parameters:pars}),signal},190000));return await zipFirstImage(await r.arrayBuffer())}
export async function generateImage(settings,prompt,negative,signal,progress){if(settings.engine==='comfy')return comfyImage(settings,prompt,negative,signal,progress);if(settings.engine==='novelai')return novelaiImage(settings,prompt,negative,signal);return openaiImage(settings,prompt,negative,signal)}
export function pixivProxy(url){if(!url||!url.startsWith('https://i.pximg.net/'))return '';return `https://wsrv.nl/?url=${encodeURIComponent(url)}&w=440&output=webp`}
