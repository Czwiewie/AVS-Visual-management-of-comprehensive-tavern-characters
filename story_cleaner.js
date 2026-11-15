/* AVS R2.5 story-only reader. We classify the AI reply before any scene/director request.
 * Never modify the SillyTavern message or the V4.1.10 dossier; this is a read-only projection.
 * The parser is conservative: only explicitly marked auxiliary blocks are excluded.
 */
const asText=v=>String(v??'');
const norm=v=>asText(v).replace(/\r\n?/g,'\n').replace(/\u200b/g,'');
const mainHeader=/^\s*(?:#{1,6}\s*|\*\*\s*)?(?:[【\[〔](?:正文|主线正文|主线剧情|故事正文|叙事正文|剧情正文|本篇正文|当前剧情|正文开始)[】\]〕]|(?:正文|主线剧情|故事正文)\s*[:：])\s*(?:\*\*)?\s*(.*)$/i;
const auxHeader=/^\s*(?:#{1,6}\s*|\*\*\s*)?(?:[【\[〔](?:重要记忆区|记忆区|记忆摘要|角色记忆|长期记忆|系统记忆|人物记忆|记忆记录|记忆标签|状态栏|人物状态|角色状态|状态记录|状态面板|属性面板|属性栏|世界书|系统说明|系统提示|作者注|作者有话说|幕后说明|规则注释|选项栏|选项区|选项|可选行动|互动选项|待选分支|平行事件|平行剧情|平行视角|额外独立剧情|角色额外独立剧情|支线事件|支线剧情|回顾|事件摘要|非正文)[】\]〕]|[【〔][^】〕\n]{1,35}(?:的记忆区|记忆摘要)[】〕]|(?:重要记忆区|记忆区|记忆摘要|选项栏|平行事件|额外独立剧情|状态栏|系统提示|作者注)\s*[:：])\s*(?:\*\*)?\s*(.*)$/i;
const optionLine=/^\s*(?:(?:>|＞)\s*)?(?:[-*+]\s*)?(?:\*\*\s*)?(?:[\[【(（]\s*)?(?:选项|行动选项|分支选项|choice|option)\s*(?:[一二三四五六七八九十百\dA-Fa-f]|[①②③④⑤⑥⑦⑧⑨⑩])\s*(?:[\]】)）]\s*)?\s*[:：.、)）-]/i;
const inlineAux=/[【〔](?:重要记忆区|角色记忆|记忆区|状态栏|选项栏|可选行动|平行事件|额外独立剧情|角色额外独立剧情|支线事件|作者注|系统说明|记忆摘要)[】〕]/;
const markdownImage=/!\[[^\]]*\]\([^)]*\)/g;
const removeMarkup=s=>s
 .replace(/<!--[\s\S]*?-->/g,' ')
 .replace(/<(?:think|thinking|analysis|details|script|style|svg|pre|avs_memory|memory)(?:\s[^>]*)?>[\s\S]*?<\/(?:think|thinking|analysis|details|script|style|svg|pre|avs_memory|memory)>/gi,'\n')
 .replace(/<(?:think|thinking|analysis|details|avs_memory|memory)(?:\s[^>]*)?>[\s\S]*$/gi,'\n')
 .replace(/\[AVS[^\]\n]*\]/gi,' ')
 .replace(markdownImage,' ')
 .replace(/<[^>]+>/g,' ');
const meaningful=x=>/[\p{L}\p{N}]/u.test(x)&&!/^[-—*_#=~\s]+$/.test(x);
export function cleanStory(raw,{maxLength=9000}={}){
 let t=removeMarkup(norm(raw));const kept=[],removed=[];let state='main',fenced=false;
 for(const original of t.split('\n')){
   let line=original.trim();
   if(/^\s*(```|~~~)/.test(line)){fenced=!fenced;removed.push('代码围栏');continue}
   if(fenced){removed.push('代码区');continue}
   if(!line){if(state==='main'&&kept.length&&kept[kept.length-1]!=='')kept.push('');continue}
   const isMain=line.match(mainHeader);
   if(isMain){state='main';line=(isMain[1]||'').trim();if(!line)continue}
   else{
     const aux=line.match(auxHeader);
     if(aux){state='aux';removed.push('辅助标题');continue}
     const marker=line.match(inlineAux);
     if(marker){const before=line.slice(0,marker.index).trim();if(before&&state==='main'&&meaningful(before))kept.push(before);state='aux';removed.push('行内辅助块');continue}
     if(optionLine.test(line)){state='options';removed.push('选项');continue}
     if(state!=='main'){removed.push(state==='options'?'选项续行':'辅助内容');continue}
   }
   // Standalone ST system markers do not describe an on-screen event.
   if(/^\s*(?:\{\s*"(?:character_id|canon|current|identity)"|\[AVS|\/\/(?:system|memory))/.test(line)) {removed.push('系统数据');continue}
   if(meaningful(line))kept.push(line);
 }
 let story=kept.join('\n').replace(/\n{3,}/g,'\n\n').trim();
 if(story.length>maxLength){
  const tail=story.slice(-maxLength);
  const boundary=tail.search(/\n\n|\n/);
  story=(boundary>0&&boundary<400?tail.slice(boundary).trim():tail.trim());
 }
 const paragraphs=story.split(/\n{1,2}/).map(x=>x.trim()).filter(meaningful);
 const moment=(paragraphs.slice(-3).join(' ').slice(-780)||'').trim();
 return {text:story,valid:!!story,moment,removedCount:removed.length,removedKinds:[...new Set(removed)],paragraphCount:paragraphs.length,source:'latest_ai_reply_main_story'};
}
export const cleanText=raw=>cleanStory(raw,{maxLength:12500}).text;
export function assertCleanStory(text){const x=cleanStory(text);if(!x.valid)throw new Error('最新AI回复只有记忆区、选项或辅助信息，没有可用于生图的主线正文；已停止生图，不会猜测未发生的画面');return x;}
export function assertNoAuxiliaryLeak(...fragments){const s=fragments.map(asText).join('\n');if(/【\s*(?:重要记忆区|记忆区|选项|平行事件|额外独立剧情|状态栏)/.test(s)||/(?:^|\n)\s*(?:>\s*)?选项[一二三四五六七八九十\d]+\s*[:：]/m.test(s))throw new Error('导演输出仍包含记忆/选项/平行事件信息，已拒绝污染的生图提示词');return true;}
