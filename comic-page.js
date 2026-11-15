/* AVS R2.2 comic page compositor: panels made by the configured image engine,
   dialogue added locally without asking the image engine to typeset Chinese. */
const safe=(s)=>String(s??'').replace(/[\u0000-\u001f]/g,' ').trim().slice(0,260);
async function bitmap(blob){if(typeof createImageBitmap==='function')return createImageBitmap(blob);
 const u=URL.createObjectURL(blob);try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('漫画画格图片无法解码'));img.src=u})}finally{URL.revokeObjectURL(u)}}
function wrap(ctx,txt,width,x,y,lineHeight,maxLines){let line='';const lines=[];
 for(const ch of [...safe(txt)]){const proposal=line+ch;if(ctx.measureText(proposal).width>width && line){lines.push(line);line=ch}else line=proposal;if(lines.length>=maxLines)break}
 if(line && lines.length<maxLines)lines.push(line);
 for(let i=0;i<lines.length;i++)ctx.fillText(lines[i],x,y+i*lineHeight);
 return lines.length;
}
export async function comicPageBlob(images,panels,names=new Map()){
 if(images.length<2)throw new Error('漫画拼页至少需要两格图像');
 const imagesDecoded=await Promise.all(images.map(bitmap));const W=980;const M=18;const panelImageH=960;const bubbleH=132;const panelH=panelImageH+bubbleH;const H=M*2+(panelH+M)*images.length;
 const canvas=document.createElement('canvas');canvas.width=W;canvas.height=H;const ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器不支持Canvas 2D，原始画格已保存在图库');
 ctx.fillStyle='#eef5fa';ctx.fillRect(0,0,W,H);
 for(let i=0;i<imagesDecoded.length;i++){
  const img=imagesDecoded[i],y=M+i*(panelH+M),pw=W-2*M;
  ctx.fillStyle='#fff';ctx.fillRect(M,y,pw,panelH);ctx.strokeStyle='#66879b';ctx.lineWidth=3;ctx.strokeRect(M+1,y+1,pw-2,panelH-2);
  const ratio=Math.min(pw/img.width,panelImageH/img.height);const dw=img.width*ratio,dh=img.height*ratio;
  ctx.fillStyle='#dceaf3';ctx.fillRect(M+2,y+2,pw-4,panelImageH);
  ctx.drawImage(img,M+(pw-dw)/2,y+(panelImageH-dh)/2,dw,dh);
  ctx.fillStyle='#fff';ctx.fillRect(M+3,y+panelImageH,pw-6,bubbleH-2);
  const cap=panels[i]||{};ctx.fillStyle='#224c66';ctx.font='bold 24px sans-serif';ctx.fillText(`第 ${i+1} 格`,M+18,y+panelImageH+31);
  ctx.fillStyle='#26495a';ctx.font='25px sans-serif';const speak=(cap.dialogue||[]).slice(0,2).map(d=>{const name=names.get(d.speaker_id)||d.speaker_id||'旁白';return `${name}：${safe(d.text)}`}).join('　');
  if(speak){const count=wrap(ctx,speak,pw-44,M+18,y+panelImageH+63,31,2);if(count>=2){} }
  else {ctx.font='20px sans-serif';ctx.fillStyle='#698496';wrap(ctx,cap.moment||'',pw-44,M+18,y+panelImageH+66,26,2)}
  if(typeof img.close==='function')img.close();
 }
 return await new Promise((resolve,reject)=>{canvas.toBlob(b=>b?resolve(b):reject(new Error('漫画合成图片为空')),'image/png')});
}
