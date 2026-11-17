/* AVS implementation of the MessagePack wire format. No SDK dependency. */
export function decodeMessagePack(bytes){let p=0,nodes=0;const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength),td=new TextDecoder();
 const need=n=>{if(n<0||p+n>bytes.length)throw new Error('NovelAI消息数据截断');};
 const readNumber=(n,fn)=>{need(n);const v=view[fn](p,false);p+=n;return v;};
 const raw=n=>{need(n);const v=bytes.slice(p,p+n);p+=n;return v;};
 const array=(n,d)=>{if(n>100000)throw new Error('NovelAI消息数组过大');return Array.from({length:n},()=>read(d+1));};
 const map=(n,d)=>{if(n>10000)throw new Error('NovelAI消息对象过大');const o=Object.create(null);for(let i=0;i<n;i++){const key=read(d+1);if(typeof key!=='string')throw new Error('NovelAI消息对象键无效');o[key]=read(d+1);}return o;};
 function read(depth=0){if(depth>30||++nodes>200000)throw new Error('NovelAI消息结构异常');need(1);const b=bytes[p++];if(b<128)return b;if(b>=224)return b-256;if(b>=160&&b<=191)return td.decode(raw(b-160));if(b>=144&&b<=159)return array(b-144,depth);if(b>=128&&b<=143)return map(b-128,depth);
  switch(b){case 192:return null;case 194:return false;case 195:return true;
   case 196:return raw(readNumber(1,'getUint8'));case 197:return raw(readNumber(2,'getUint16'));case 198:return raw(readNumber(4,'getUint32'));
   case 202:return readNumber(4,'getFloat32');case 203:return readNumber(8,'getFloat64');
   case 204:return readNumber(1,'getUint8');case 205:return readNumber(2,'getUint16');case 206:return readNumber(4,'getUint32');case 207:{const v=readNumber(8,'getBigUint64');return Number(v);}
   case 208:return readNumber(1,'getInt8');case 209:return readNumber(2,'getInt16');case 210:return readNumber(4,'getInt32');case 211:return Number(readNumber(8,'getBigInt64'));
   case 217:return td.decode(raw(readNumber(1,'getUint8')));case 218:return td.decode(raw(readNumber(2,'getUint16')));case 219:return td.decode(raw(readNumber(4,'getUint32')));
   case 220:return array(readNumber(2,'getUint16'),depth);case 221:return array(readNumber(4,'getUint32'),depth);case 222:return map(readNumber(2,'getUint16'),depth);case 223:return map(readNumber(4,'getUint32'),depth);
   default:throw new Error('NovelAI消息包含不支持的MessagePack类型：'+b);}}
 const result=read();if(p!==bytes.length)throw new Error('NovelAI消息含多余数据');return result;}
export function imageBytesBlob(value){let bytes=value;if(typeof value==='string'){const clean=value.replace(/^data:image\/[^;]+;base64,/,''),s=atob(clean);bytes=Uint8Array.from(s,c=>c.charCodeAt(0));}else if(Array.isArray(value))bytes=new Uint8Array(value);
 if(!(bytes instanceof Uint8Array)||bytes.length<12)throw new Error('NovelAI最终图片数据为空');
 const type=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71?'image/png':bytes[0]===255&&bytes[1]===216?'image/jpeg':new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP'?'image/webp':'';
 if(!type)throw new Error('NovelAI最终响应没有可识别的图片签名');return new Blob([bytes],{type});}
export async function readNaiStream(response,signal,progress=()=>{}){if(!response.body)throw new Error('NovelAI未返回图像流');const reader=response.body.getReader();let pending=new Uint8Array(0),final=null,total=0;
 try{while(true){if(signal?.aborted)throw new Error('用户取消或NovelAI响应超时');const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>100*1024*1024)throw new Error('NovelAI图像流过大');
   const next=new Uint8Array(pending.length+value.length);next.set(pending);next.set(value,pending.length);pending=next;
   while(pending.length>=4){const n=new DataView(pending.buffer,pending.byteOffset,4).getUint32(0,false);if(n<1||n>64*1024*1024)throw new Error('NovelAI图像流消息长度无效');if(pending.length<4+n)break;
    const event=decodeMessagePack(pending.subarray(4,4+n));pending=pending.slice(4+n);
    if(event.error||event.event_type==='error')throw new Error('NovelAI图像流错误：'+String(event.error||event.message||'unknown').slice(0,240));
    if(event.event_type==='intermediate')progress('NovelAI正在采样 · 步骤 '+String(event.step_ix??''));
    if(event.event_type==='final')final=imageBytesBlob(event.image);
   }}
  if(pending.length)throw new Error('NovelAI图像流未完整结束');if(!final)throw new Error('NovelAI未返回最终图像，未采用中间预览图');return final;
 }finally{try{await reader.cancel()}catch{}reader.releaseLock();}}
