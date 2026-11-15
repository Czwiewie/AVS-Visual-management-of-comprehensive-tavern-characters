/* R2.3: prepare user-uploaded reference photos for vision models.
   Originals remain in IndexedDB; transmission uses canvas-derived pixels, not metadata. */
export async function prepareStylePixels(blob,maxSide=1600){
 if(!blob||!String(blob.type).startsWith('image/'))throw new Error('参考图不是有效图片文件');
 const image=await createImageBitmap(blob).catch(()=>{throw new Error('浏览器无法解码该图片，请换PNG/JPEG/WebP格式')});
 try{
  const factor=Math.min(1,maxSide/Math.max(image.width,image.height));const width=Math.max(1,Math.round(image.width*factor)),height=Math.max(1,Math.round(image.height*factor));
  const canvas=document.createElement('canvas');canvas.width=width;canvas.height=height;
  const ctx=canvas.getContext('2d');if(!ctx)throw new Error('无法初始化参考图缩放Canvas');
  ctx.fillStyle='#fff';ctx.fillRect(0,0,width,height);ctx.drawImage(image,0,0,width,height);
  const compressed=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));
  if(!compressed||!compressed.size)throw new Error('参考图压缩失败');
  if(compressed.size>6*1024*1024)throw new Error('参考图像素数据过大，无法安全发送');
  return compressed;
 }finally{image.close?.()}
}
