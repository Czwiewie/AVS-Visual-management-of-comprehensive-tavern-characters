import {resourceEntries,resourceById,searchResources,referencePreview} from './visual_resources.js';
import {LIBRARY_MANIFEST} from './resource_library/manifest.js';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export {LIBRARY_MANIFEST};
const POSE_ANGLES = {front:'正面', diag:'斜侧', side:'侧面', high:'俯视', low:'仰视'};
const WARDROBE_SERIES = {'春':'春装', '夏':'夏装', '秋':'秋装', '冬':'冬装', 'パーティ':'宴会装', '水着':'泳装', 'ランジェリー':'内搭', 'セクシー':'风格款', design:'通用成衣术语'};
const byGroup = new Map();
for (const entry of resourceEntries) {
 if (entry.category !== 'pose' || !entry.pose_group_id || !POSE_ANGLES[entry.angle_id]) continue;
 if (!byGroup.has(entry.pose_group_id)) byGroup.set(entry.pose_group_id, new Map());
 byGroup.get(entry.pose_group_id).set(entry.angle_id, entry);
}

export function browseOptions(ui, favorites=[]) {
 return {
  category:ui.resourceCategory||'hair', query:ui.resourceQuery||'', page:ui.resourcePage||0,
  imagesOnly:!!ui.resourceImagesOnly, favoritesOnly:!!ui.resourceFavoritesOnly, favorites,
  poseAngle:ui.resourcePoseAngle||'', poseViews:ui.resourcePoseViews, wardrobe:ui.resourceWardrobe||''
 };
}

export function browseResources({category='hair',query='',page=0,pageSize=24,imagesOnly=false,favoritesOnly=false,favorites=[],poseAngle='',poseViews=new Map(),wardrobe=''}={}){
 let rows=query?searchResources(query,{category,limit:100000}):resourceEntries.filter(e=>!category||e.category===category);
 const available=e=>(!imagesOnly||referencePreview(e))&&(!favoritesOnly||favorites.includes(e.id));
 rows=rows.filter(available);
 if(category==='clothing'&&WARDROBE_SERIES[wardrobe]) {
  const series=wardrobe==='design'?'common_design_term':'complete_anime_costume_'+wardrobe;
  rows=rows.filter(e=>e.subcategory===series);
 }
 if(category==='pose') {
  const groups=new Map();
  for(const row of rows) {
   const group=row.pose_group_id, indexed=byGroup.get(group);
   if(!indexed) { if(!poseAngle)groups.set(row.id,row); continue; }
   if(groups.has(group))continue;
   const views=Object.keys(POSE_ANGLES).map(angle=>indexed.get(angle)).filter(e=>e&&available(e));
   const wanted=poseAngle||poseViews.get(group)||(query?row.angle_id:'front');
   const selected=views.find(e=>e.angle_id===wanted)||(!poseAngle?views[0]:null);
   if(selected)groups.set(group,{...selected,poseViews:poseAngle?[]:views.map(e=>e.angle_id)});
  }
  rows=[...groups.values()];
 }
 if(!query)rows.sort((a,b)=>Number(!referencePreview(a))-Number(!referencePreview(b))||String(a.label_zh||a.label).localeCompare(String(b.label_zh||b.label),'zh-CN'));
 const pages=Math.max(1,Math.ceil(rows.length/pageSize)),current=Math.max(0,Math.min(pages-1,Number(page)||0));
 return {total:rows.length,page:current,pages,rows:rows.slice(current*pageSize,(current+1)*pageSize),pageSize};
}
export function toggleResourcePick(picks,id,character_id='auto') {
 const entry=resourceById.get(id);
 if(!entry)throw new Error('素材已失效');
 const already=picks.some(p=>p.resource_id===id&&p.character_id===character_id);
 const kept=picks.filter(p=>p.resource_id!==id&&(p.character_id!==character_id||!entry.pose_group_id||
  resourceById.get(p.resource_id)?.pose_group_id!==entry.pose_group_id));
 if(already)return kept;
 if(kept.length>=16)throw new Error('本次最多选择16项参考，请先移除不需要的项目');
 return [...kept,{resource_id:id,character_id}];
}
const selectOptions=(values,current)=>Object.entries(values).map(([v,label])=>`<option value="${esc(v)}" ${v===current?'selected':''}>${esc(label)}</option>`).join('');
const viewPicker=e=>e.poseViews?.length>1
 ? `<label class="field"><span>本姿势机位</span><select data-resource-view="${esc(e.pose_group_id)}">${selectOptions(Object.fromEntries(e.poseViews.map(v=>[v,POSE_ANGLES[v]])),e.angle_id)}</select></label>`:'';
const categoryFilters=state=>state.category==='pose'
 ? `<label class="field"><span>筛选机位</span><select data-resource-angle>${selectOptions({'':'全部机位 · 每个姿势一张卡',...POSE_ANGLES},state.poseAngle)}</select></label>`
 : state.category==='clothing'
 ? `<label class="field"><span>成衣系列</span><select data-resource-wardrobe>${selectOptions({'':'全部系列',...WARDROBE_SERIES},state.wardrobe)}</select></label>`:'';
export function resourceRows(rows,picks=[],favorites=[],actor='auto'){return rows.map(e=>{const image=referencePreview(e),selected=picks.some(p=>p.resource_id===e.id&&p.character_id===actor),source=e.provenance?.upstream_reference||e.provenance||{};return `<article class="resource-entry" data-resource-id="${esc(e.id)}">${image?`<button type="button" class="resource-photo" data-act="resource-preview:${esc(e.id)}"><img src="${esc(image)}" alt="${esc(e.label_zh||e.label)}分类示例" loading="lazy"/></button>`:'<span class="resource-text-badge">文字条目</span>'}<b>${esc(e.label_zh||e.label)}</b>${viewPicker(e)}<span class="small">${esc(e.label)}</span><p class="resource-tags">${esc((e.nai_tags||[]).join(', ')||e.description)}</p><p class="small">${esc(e.category_zh||e.category)} · ${image?'有本地参考图':'按文字编译'}${e.requires_parent_item?' · 服饰/装饰需关联当前物品':''}</p><div class="row"><button class="btn ${selected?'selected':''}" data-act="resource-pick:${esc(e.id)}">${selected?'已加入本次参考 ✓':'加入本次参考'}</button><button class="btn flat" data-act="resource-favorite:${esc(e.id)}">${favorites.includes(e.id)?'★ 已收藏':'☆ 收藏'}</button></div><details><summary>来源与使用范围</summary><p class="small">${esc((source.repository||e.source_id)+(source.author?' · '+source.author:''))}${source.url?` · <a href="${esc(source.url)}" target="_blank" rel="noopener noreferrer">查看来源</a>`:''}</p><p class="small">${esc(e.reference?.review_note||'文字候选，需要结合本幕事实和角色归属编译。')}</p></details></article>`;}).join('')||'<p class="small">没有匹配项。可以清除关键词或筛选条件。</p>';}
export function resourceBrowser(ui,settings,characters=[]){const favorites=settings.resources.favorites||[],state=browseOptions(ui,favorites);const result=browseResources(state);ui.resourcePage=result.page;
 const picks=ui.resourcePicks||[],actor=ui.resourceActorId||'auto';
 return `<h2>分类素材仓库</h2><p class="small">${LIBRARY_MANIFEST.record_count}条分类记录 · ${LIBRARY_MANIFEST.unique_local_images}张不同的本地图片 · 无人衣装、匿名姿势与独立纹样；其余分类如实提供文字术语。</p><div class="resource-categories">${LIBRARY_MANIFEST.categories.map(c=>`<button type="button" class="mode ${state.category===c.id?'selected':''}" data-act="resource-category:${c.id}">${esc(c.label_zh)}<small>${c.count}条 · ${c.with_images}条带图</small></button>`).join('')}</div><label class="field"><span>搜索当前分类（支持中英文）</span><input data-resource-query value="${esc(state.query)}" placeholder="如：高马尾、微笑、蕾丝、red nails"/></label>${categoryFilters(state)}<div class="row"><label class="check"><input type="checkbox" data-resource-filter="images" ${state.imagesOnly?'checked':''}/>仅看有图</label><label class="check"><input type="checkbox" data-resource-filter="favorites" ${state.favoritesOnly?'checked':''}/>只看收藏</label></div><label class="field"><span>本次参考用于哪名人物</span><select data-resource-actor><option value="auto" ${actor==='auto'?'selected':''}>由提示词API匹配本幕人物</option>${characters.map(c=>`<option value="${esc(c.character_id)}" ${actor===c.character_id?'selected':''}>${esc(c.name)}</option>`).join('')}</select></label><p class="small">加入的条目会优先交给提示词API。它们不能自动覆盖正式外貌或当前穿搭；冲突、遮挡或预算不足的条目会列出未采用原因。</p><div class="row">${picks.length?`<button class="btn flat" data-act="resource-clear">清空本次参考（${picks.length}项）</button>`:''}<button class="btn" data-act="goto:home">返回创作</button></div><details><summary>本次参考清单（${picks.length}项）</summary>${picks.map(p=>`<p class="small">${esc(resourceById.get(p.resource_id)?.label_zh||p.resource_id)} · ${esc(characters.find(c=>c.character_id===p.character_id)?.name||'自动匹配')} <button class="btn flat" data-act="resource-remove:${esc(p.resource_id)}">移除</button></p>`).join('')||'<p class="small">尚未手动加入；自动检索仍可根据本幕运行。</p>'}</details><label class="check"><input type="checkbox" data-check="resources.enabled" ${settings.resources.enabled?'checked':''}/>自动检索素材词库</label><label class="check"><input type="checkbox" data-check="resources.visionEnabled" ${settings.resources.visionEnabled&&!settings.prompt.useMain?'checked':''} ${settings.prompt.useMain?'disabled':''}/>允许独立提示词API读取所选参考图片（模型需支持图片）</label><p class="small">${settings.prompt.useMain?'当前使用主API，本版按文字标签引用素材；多图识读请使用支持图片的独立提示词API。':'开启识图后，每次最多提供4张本地示例图，检查通过后只提取对应类别。带文字的纹样卡在库内供浏览，编译时使用其文字记录。'} Nai不会自行打开仓库网址。</p><div class="resource-pagination"><button class="btn flat" data-act="resource-page:${result.page-1}" ${result.page===0?'disabled':''}>上一页</button><span>第${result.page+1}/${result.pages}页 · 共${result.total}条</span><button class="btn flat" data-act="resource-page:${result.page+1}" ${result.page>=result.pages-1?'disabled':''}>下一页</button></div><div class="resource-grid" data-resource-results>${resourceRows(result.rows,picks,favorites,actor)}</div>`;}
export function resourcePreview(id,picks=[],actor='auto'){const e=resourceById.get(id),image=e&&referencePreview(e);if(!e||!image)return '';return `<div class="lightbox" role="dialog" aria-modal="true" aria-label="素材图片预览"><div class="light-card"><button class="btn" data-act="resource-preview-close">← 返回素材仓库</button><h3>${esc(e.label_zh||e.label)}</h3><img src="${esc(image)}" alt="${esc(e.label_zh||e.label)}参考图"/><p>${esc((e.nai_tags||[]).join(', ')||e.description)}</p><p class="small">${esc(e.reference.review_note)}</p><div class="row"><button class="btn" data-act="resource-pick:${esc(e.id)}">${picks.some(p=>p.resource_id===id&&p.character_id===actor)?'已加入本次参考 ✓':'加入本次参考'}</button></div></div></div>`;}
