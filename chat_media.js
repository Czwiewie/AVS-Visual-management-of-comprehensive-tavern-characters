import {cleanStory} from './story_cleaner.js';
import {blobToDataURL,fetchTimeout} from './engines.js';
export function assertBoundSource(binding,getInfo,hash){const info=getInfo(),message=info.context?.chat?.[binding.messageIndex];
 if(info.id!==binding.chatId||!message||message.is_user||message.is_system||hash(cleanStory(message.mes||message.message||'').text)!==binding.sourceHash)throw new Error('原聊天或绑定AI回复已变化，请返回原聊天且恢复原楼层后再保存；不会插入其他回复');
 return {info,message};}
export async function attachGalleryImage(item,getInfo,hash,apiUrl){let {info,message}=assertBoundSource(item,getInfo,hash);
 if(message.extra?.avs_visual_media_ids?.includes(item.id))return {alreadyAttached:true};
 if(typeof info.context?.saveChat!=='function'||typeof info.context?.getRequestHeaders!=='function')throw new Error('当前SillyTavern没有提供聊天保存/请求头接口；图片仍已保存在图库，可下载');
 const base64=String(await blobToDataURL(item.blob)).split(',')[1];const format=item.blob.type.includes('jpeg')?'jpg':item.blob.type.includes('webp')?'webp':'png';
 const response=await fetchTimeout(apiUrl,{method:'POST',headers:info.context.getRequestHeaders(),body:JSON.stringify({image:base64,format,ch_name:'AVS',filename:item.id})},60000);
 if(!response.ok)throw new Error('SillyTavern图片保存失败 HTTP '+response.status+'；图库图片已保留');const data=await response.json();
 if(typeof data.path!=='string'||!data.path||/^\w+:/i.test(data.path))throw new Error('SillyTavern图片接口未返回安全的本地路径');
 ({info,message}=assertBoundSource(item,getInfo,hash));
 const extra=message.extra||{};const media=Array.isArray(extra.media)?extra.media.slice():[];
 if(!media.length&&typeof extra.image==='string'&&extra.image)media.push({url:extra.image,type:'image',source:'generated'});
 media.push({url:data.path,type:'image',title:'AVS视觉工坊',source:'generated',avs_visual_id:item.id});
 const previous=message.extra;message.extra={...extra,media,media_display:extra.media_display||'gallery',media_index:media.length-1,inline_image:extra.inline_image??false,avs_visual_media_ids:[...(extra.avs_visual_media_ids||[]),item.id]};
 try{assertBoundSource(item,getInfo,hash);await info.context.saveChat();}catch(e){message.extra=previous;throw e;}
 try{if(typeof info.context.updateMessageBlock==='function')await info.context.updateMessageBlock(item.messageIndex,message);}catch(e){console.warn('[AVS] 图片附件已保存，当前消息重绘失败',e);}
 return {path:data.path};}
