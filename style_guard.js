/* R2.3 transferable-style-only lint: advisory semantic rules; not perfect separation.
   Reject obvious subject/wardrobe/scene token leakage rather than silently locking it. */
const forbidden=/(?:\b(?:1girl|2girls|1boy|multiple girls|solo female|long hair|short hair|ponytail|twintails|blonde hair|silver hair|blue eyes|red eyes|dress|school uniform|skirt|thighhighs|boots|sword|sitting|standing|kneeling|walking|running|holding hands|garden|tree|flower petals|street|classroom|bedroom|cat ears|fox tail|large breasts|small breasts|hourglass figure|full body|close-up portrait)\b|(?:银发|金发|蓝眼|红瞳|双马尾|长头发|短发|连衣裙|制服|丝袜|高跟鞋|教室|树下|花海|坐着|站立|跪姿|胸部尺寸|半身像|特写镜头))/i;
const riskNeg=/(?:\b(?:no girls|without people|no boys|no clothes|no hair|no sunlight|no trees|no glasses|no weapons|no objects|no night|no city|no flowers|no green eyes)\b|没有人物|不出现角色|没有服装|不出现树)/i;
export function auditStyle(analysis){
 const positive=String(analysis?.positive||'').trim(),negative=String(analysis?.negative||'').trim();
 if(!positive||positive.length<18)throw new Error('画风解析过于简短，未可靠提取可迁移的视觉风格；保留旧画风');
 const positives=positive.split(/[,;，；\n]+/).map(x=>x.trim()).filter(Boolean);
 const negatives=negative.split(/[,;，；\n]+/).map(x=>x.trim()).filter(Boolean);
 const leaked=[...positives.filter(x=>forbidden.test(x)),...negatives.filter(x=>forbidden.test(x)||riskNeg.test(x))];
 if(leaked.length)throw new Error('解析结果混入了参考图的角色、服装、姿势或场景内容（'+leaked.slice(0,3).join('、').slice(0,115)+'），拒绝覆盖当前画风');
 return {positive:positives.join(', ').slice(0,2200),negative:negatives.join(', ').slice(0,1200)};
}
