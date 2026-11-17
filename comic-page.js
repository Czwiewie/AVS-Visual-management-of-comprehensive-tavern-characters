/* Panels are generated independently; supported Chinese speech is lettered locally.
 * No director notes are printed as invented narration; no silent two-line clipping. */
const safe=s=>String(s??'').replace(/[\u0000-\u001f]/g,' ').trim();
async function bitmap(blob){if(typeof createImageBitmap==='function')return createImageBitmap(blob);const u=URL.createObjectURL(blob);try{return await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('漫画画格无法解码'));img.src=u})}finally{URL.revokeObjectURL(u)}}
export function wrapComicText(ctx,text,width){const lines=[];let current='';for(const ch of [...safe(text)]){const next=current+ch;if(ctx.measureText(next).width>width&&current){lines.push(current);current=ch}else current=next;}if(current)lines.push(current);return lines;}
export async function comicPageBlob(images,panels,names=new Map()){
 if(images.length<2||images.length>6||images.length!==panels.length)throw new Error('漫画需要2～6个对应的画格');
 const W=980,M=18,pw=W-2*M,imageH=960,lineH=32;const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d');if(!ctx)throw new Error('浏览器没有Canvas 2D，无法拼页');
 ctx.font='25px sans-serif';const rows=panels.map(p=>(p.dialogue||[]).map(d=>{const content=(names.get(d.speaker_id)||'旁白')+'：'+safe(d.text);const lines=wrapComicText(ctx,content,pw-84);return {lines,height:lines.length*lineH+34};}));
 const heights=rows.map(dialogues=>imageH+dialogues.reduce((sum,d)=>sum+d.height+12,0)+(dialogues.length?18:0));
 const H=2*M+heights.reduce((sum,h)=>sum+h+M,0);if(H>20000)throw new Error('本页对白过长，请减少格数或拆分正文后生成');
 canvas.width=W;canvas.height=H;ctx.fillStyle='#fff';ctx.fillRect(0,0,W,H);
 const decoded=await Promise.all(images.map(bitmap));let y=M;
 try{for(let i=0;i<decoded.length;i++){
  const img=decoded[i];ctx.fillStyle='#fff';ctx.fillRect(M,y,pw,heights[i]);const ratio=Math.min(pw/img.width,imageH/img.height),dw=img.width*ratio,dh=img.height*ratio;
  ctx.drawImage(img,M+(pw-dw)/2,y+(imageH-dh)/2,dw,dh);ctx.strokeStyle='#202225';ctx.lineWidth=3;ctx.strokeRect(M,y,pw,heights[i]);
  let by=y+imageH+12;ctx.font='25px sans-serif';for(const dialogue of rows[i]){
   ctx.fillStyle='#fff';ctx.strokeStyle='#222';ctx.lineWidth=2;ctx.beginPath();if(typeof ctx.roundRect==='function')ctx.roundRect(M+18,by,pw-36,dialogue.height,24);else ctx.rect(M+18,by,pw-36,dialogue.height);ctx.fill();ctx.stroke();
   ctx.fillStyle='#17191c';dialogue.lines.forEach((line,n)=>ctx.fillText(line,M+40,by+30+n*lineH));by+=dialogue.height+12;
  }y+=heights[i]+M;
 }}finally{for(const img of decoded)img.close?.();}
 return await new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('漫画排版结果为空')),'image/png'));
}
