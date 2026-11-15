import {settingsRead,settingsWrite,dbPut,dbGet,dbAll,dbDelete,makeId,loadTasks,saveTasks} from './storage.js';
import {models,listCheckpoints,generateImage,pixivProxy,blobToDataURL,visionChat,fetchTimeout} from './engines.js';
import {MATERIALS,esc,contextInfo,archiveView,archiveGate,chosenCharacterPacket,compileDirectedPrompt,normalizeAnalysis} from './logic.js';
import {hashScene,styleSnapshot,createStyleLock} from './director.js';
import {comicPageBlob} from './comic-page.js';
import {warmAssetLibrary,assetStatus} from './assets.js';
import {loadMonthlyRanking} from './pixiv_sync.js';
import {cardContext,fanEnabled,fanSummary,discoverFanCard} from './fan_canon.js';
import {auditStyle} from './style_guard.js';
import {prepareStylePixels} from './style_image.js';

const VERSION='R2.3.0',KEY='__AVS_VISUAL_WORKSHOP_R2__';
// AVS V4.1.10 mounts the mascot in SillyTavern's visible main document.
// An extension module may be executed in a helper iframe: do not use its
// potentially zero-height document as the full-screen overlay host.
function resolveVisibleHost(){
  const candidates=[];
  try{
    let w=globalThis;
    for(let i=0;i<8;i++){
      try{
        const d=w.document;
        if(d?.body){
          const mascot=!!d.getElementById('avs-mascot-v4-root');
          const st=!!(d.getElementById('send_textarea')||d.getElementById('extensionsMenu'));
          const h=Math.max(Number(w.visualViewport?.height)||0, Number(w.innerHeight)||0, Number(d.documentElement?.clientHeight)||0);
          candidates.push({w,mascot,st,h,depth:i});
        }
      }catch(_){/* a cross-origin parent is not accessible */}
      if(w.parent===w)break;
      try{w=w.parent}catch(_){break}
    }
  }catch(_){}
  candidates.sort((a,b)=>Number(b.mascot)-Number(a.mascot)||Number(b.st)-Number(a.st)||Number(b.h>160)-Number(a.h>160)||b.depth-a.depth);
  return candidates.find(x=>x.h>160&&(x.mascot||x.st))?.w || candidates.find(x=>x.h>160)?.w || globalThis;
}
const HOST_WINDOW=resolveVisibleHost();
if(HOST_WINDOW[KEY]?.version===VERSION && HOST_WINDOW[KEY]?.repair?.()){
 console.info('[AVS R2]',VERSION,'已有实例，宿主检查完成');
}else{
 // All UI mounting, hit testing and event dispatch use the same window as the mascot.
 const window=HOST_WINDOW,document=HOST_WINDOW.document;
 const s=settingsRead(),ui={page:'home',oldPage:'home',settingsTab:'prompt',busy:'',notice:'',error:'',selected:[],archive:null,chat:contextInfo(),tasks:[],gallery:[],galleryUrls:new Map(),styleMediaUrls:new Map(),prompt:'',negative:s.image.negative||'',promptSource:'',mode:'single',rankingBusy:false,previewId:'',pixivStatus:'',models:{prompt:[],image:[],checkpoint:[]},modelPicker:'',modelSearch:'',modelView:'all',pendingFile:'',directorPlan:null,directorNote:'',styleDraft:null};
 let shell,surface,shadow,content,picker,aborter,refreshToken=0,workRunning=false,autolast='',priorMascotVisibility=null,visibilityGuard=null,lastMountError='',intentOpen=false;
 const workUrl=new URL('./style.css',import.meta.url).href;
 function persist(){settingsWrite(s)}
 function tell(t,error=false){ui.notice=String(t);ui.error=error?String(t):'';console[error?'warn':'info']('[AVS R2]',t);render()}
 const activeStyle=()=>s.styles.find(x=>x.id===(s.styleLock?.styleId||s.chosenStyle))||null;
 const selections=()=>ui.selected;
 function archiveName(){return ui.archive?.error||`正式档案 ${ui.archive?.characters?.length||0} 名 · ${ui.archive?.runtime?.health||'等待'} · 楼层 ${ui.archive?.runtime?.last_processed_message_id??'—'}`}
 const pathVal=(p)=>p.split('.').reduce((v,k)=>v?.[k],s);
 function changePath(path,value){const a=path.split('.');let obj=s;for(let i=0;i<a.length-1;i++){obj=obj[a[i]]||(obj[a[i]]={})}obj[a.at(-1)]=value;persist()}
 const btn=(t,act,css='')=>`<button type="button" class="btn ${css}" data-act="${esc(act)}">${t}</button>`;
 const field=(label,path,opts={})=>{const value=pathVal(path)??'',ph=opts.placeholder||'',type=opts.type||'text';return `<label class="field"><span>${esc(label)}</span>${type==='textarea'?`<textarea data-bind="${esc(path)}" placeholder="${esc(ph)}" rows="${opts.rows||5}">${esc(value)}</textarea>`:`<input data-bind="${esc(path)}" type="${type==='password'?'password':'text'}" value="${esc(value)}" placeholder="${esc(ph)}" ${type==='password'?'autocomplete="off"':''}/>`}</label>`};
 const pick=(label,path,choices)=>`<label class="field"><span>${esc(label)}</span><select data-bind="${esc(path)}">${choices.map(([value,text])=>`<option value="${esc(value)}" ${pathVal(path)===value?'selected':''}>${esc(text)}</option>`).join('')}</select></label>`;
 const notice=()=>ui.notice?`<div class="notice ${ui.error?'danger':''}" role="status">${esc(ui.notice)}</div>`:'';
 function header(){return `<header class="top"><button class="head-btn" data-act="back" aria-label="返回">← 返回</button><div class="heading"><strong>AVS · 视觉工坊</strong><small>${VERSION} · V4.1.10档案只读</small></div><button class="head-btn" data-act="close">关闭</button></header>`}
 function footer(){const items=[['home','创作'],['style','画风'],['characters','角色'],['gallery','图库'],['settings','设置']];return `<nav class="bottom" aria-label="视觉工坊导航">${items.map(([id,t])=>`<button data-act="goto:${id}" class="${ui.page===id?'on':''}">${t}</button>`).join('')}</nav>`}
 function card(content,cl=''){return `<section class="card ${cl}">${content}</section>`}
 function home(){const latest=ui.chat.text;const block=archiveGate(ui.archive||{},ui.chat);const configured=s.image.engine==='comfy'?!!s.image.checkpoint||!!s.image.workflow:s.image.engine==='novelai'?!!s.image.key:!!s.image.model;
 return `${card(`<div class="eyebrow">当前剧情</div><h2>从最后一幕开始创作</h2><p class="muted">${latest?esc(latest.slice(-230)):'进入角色聊天并完成一次AI回复后即可开始。'}</p><div class="status ${block?'warn':''}">${block?'注意：'+esc(block):'角色档案与当前剧情已可读取'}</div>`)}
 ${card(`<h3>生成模式</h3><div class="twos">${[['single','单幅插画'],['group','群像插画'],['comic','两格漫画']].map(([x,t])=>`<button class="mode ${ui.mode===x?'selected':''}" data-act="mode:${x}">${t}</button>`).join('')}</div><p class="small">当前画风：${esc(s.styleLock?(activeStyle()?.label||s.styleLock.styleId)+'（已锁定）':'默认/旧版临时画风')}　· 角色 ${ui.selected.length} 名</p><div class="row">${btn('一键编译并生成','make','primary')}${btn('仅编译提示词','compile')}</div>${ui.busy?`<div class="progress"><span class="spinner"></span>${esc(ui.busy)}　${btn('取消','abort','flat')}</div>`:''}${!configured?'<p class="hint">首次使用需在设置中连接一个生图模型。配置后，普通玩家无需再填写提示词。</p>':''}`)}
 ${card(`<h3>摄影导演（可选）</h3><p class="small">根据剧情自动决定透视、构图、景深、焦点和光影；人工设置优先，摄影参数不改写正式角色档案或锁定画风。</p>${pick('镜头景别','director.shotScale',[['auto','自动决定'],['wide','远景/全景'],['medium_wide','多人中全景'],['medium','中景'],['medium_close','中近景'],['close_up','特写']])}${pick('机位高度','director.elevation',[['auto','自动决定'],['eye_level','平视'],['low_angle','仰拍'],['elevated','略高机位'],['high_angle','俯拍'],['top_down','顶视']])}${pick('景深','director.depthOfField',[['auto','自动决定'],['deep','深景深（群像推荐）'],['moderate','适度景深'],['shallow','浅景深'],['illustrative_layering','插画层次']])}${ui.directorPlan?`<details><summary>查看本次导演计划</summary><p class="small">${esc(ui.directorNote)}</p><pre class="director-json">${esc(JSON.stringify(ui.directorPlan,null,2).slice(0,8500))}</pre></details>`:'<p class="small">完成一次提示词编译后可查看导演规划与摄影决策。</p>'}`)}
 ${card(`<h3>高级提示词（可选）</h3><label class="field"><span>正向提示词</span><textarea data-draft="positive" rows="5" placeholder="一键编译后将显示在这里，亦可自行修改">${esc(ui.prompt)}</textarea></label><label class="field"><span>负向提示词</span><textarea data-draft="negative" rows="2">${esc(ui.negative)}</textarea></label><p class="small">${esc(ui.promptSource)}</p><div class="row">${btn('使用现有提示词生成','direct')}${btn('复制提示词','copy-prompt')}</div>`)}
 ${card(`<h3>数据状态</h3><p class="small">${esc(archiveName())}</p><p class="small">最新AI楼层：${ui.chat.index>=0?'#'+ui.chat.index:'无'} · 生图API：${esc(s.image.engine)}</p>${btn('刷新档案状态','refresh','flat')}`)} `;}
 function style(){const items=s.pixiv.items||[];const styl=s.styles||[];return `${card(`<h2>画风与收藏</h2><p>一键使用参考图：选择Pixiv月榜作品或上传本地图片，视觉模型自动提取纯画风正负词并锁定。识图失败时，旧画风保持不变。</p><div class="row">${btn('读取月榜前50','ranking','primary')}${btn('上传并直接使用画风','upload-style')}${btn('数据源设置','pixiv-config')}</div><div class="status">${s.pixiv.updated?'榜单更新时间：'+esc(s.pixiv.updated):'尚未取得完整月榜；不显示虚构榜单'} · ${items.length}/50</div>`)}
 <h3 class="section-title">Pixiv月度插画榜</h3>${items.length?`<div class="artgrid">${items.map(x=>`<article class="art"><div class="artimg">${thumb(x.thumbnail)?`<img src="${esc(thumb(x.thumbnail))}" loading="lazy" alt="${esc(x.title)}" onerror="this.style.display='none'"/><span class="thumb-fallback">缩略图受来源限制时，可打开原作查看</span>`:'<span>无缩略图</span>'}</div><div class="artbody"><b>#${x.rank}　${esc(x.title)}</b><small>${esc(x.artist)}</small><div class="actions"><button data-act="pixivuse:${esc(x.id)}">使用该图片画风</button><button data-act="choosepixiv:${esc(x.id)}">收藏</button><a href="${esc(x.url)}" rel="noopener noreferrer" target="_blank">原作</a></div></div></article>`).join('')}</div>`:card(`<p class="muted">当前尚无真实月榜数据。请在GitHub仓库Actions运行同步任务。${ui.pixivStatus?`<br/><strong>当前状态：</strong>${esc(ui.pixivStatus)}`:''}</p>`)}
 <h3 class="section-title">我的画风收藏</h3>${styl.length?`<div class="stylelist">${styl.map(x=>`<article class="saved ${s.chosenStyle===x.id?'chosen':''}"><div class="saved-content">${ui.styleMediaUrls.get(x.id)?`<img class="style-thumb" src="${esc(ui.styleMediaUrls.get(x.id))}" alt="画风参考图" loading="lazy"/>`:x.thumbnail?`<img class="style-thumb" src="${esc(thumb(x.thumbnail))}" alt="画风参考图" loading="lazy"/>`:''}<div><strong>${esc(x.label)}</strong><small>${esc(x.analysis?.description||x.analysis?.tags||x.source||'')}</small></div></div><div class="row">${btn('使用该图片画风','styleuse:'+x.id)}${btn('AI解析','analyze-style:'+x.id,'flat')}${btn('删除','styledelete:'+x.id,'flat')}</div></article>`).join('')}</div>`:card(`<p class="muted">还没有收藏。可以先选月榜作品，或上传你自己的画风参考图。</p>`)}
 ${card(`<h3>当前画风提示词（独立锁定）</h3><p class="small">只有点击“使用该图片画风”并成功解析，或手动编辑并保存，才会更新锁定正负词。角色/剧情导演只读，不得覆盖。</p><div class="status">${s.styleLock?.styleId?`已锁定 · 版本 ${s.styleLock.revision} · 来源：${esc(activeStyle()?.label||s.styleLock.styleId)}`:'未锁定：使用默认画风或上版临时画风'}</div><label class="field"><span>画风正面提示词</span><textarea data-style-draft="positive" rows="3">${esc(ui.styleDraft?.positive??s.styleLock?.positive??'')}</textarea></label><label class="field"><span>画风负面提示词</span><textarea data-style-draft="negative" rows="3">${esc(ui.styleDraft?.negative??s.styleLock?.negative??'')}</textarea></label><div class="row">${btn('保存手动修改','style-lock-save')}${btn('清除当前画风锁定','style-lock-clear','flat')}</div>`)}
 ${card(`<h3>视觉设计</h3><p class="small">发型、服饰、配饰、表情、姿势、构图和物品词典由后台自动检索，并参与提示词编译；不要求逐项手选，不会更改V4.1.10正式档案。</p>`) }`;}
 const thumb=(url)=>s.pixiv.proxy?pixivProxy(url)||url:url;
 function characters(){const chars=ui.archive?.characters||[],cardInfo=cardContext(ui.chat.context),active=fanEnabled(s,cardInfo);
 return `${card(`<h2>角色卡作品识别</h2><p>仅需决定当前角色卡是否属于同人作品。启用后后台识别卡片介绍、剧情中的动画或游戏出处，并长效保存；不显示复杂检索过程，不改写V4.1.10正式档案。</p><div class="twos"><button class="mode ${active?'selected':''}" data-act="fan-set:yes">同人角色卡</button><button class="mode ${!active?'selected':''}" data-act="fan-set:no">非同人角色卡</button></div><p class="small">识别属于辅助生图信息；未查实出处或角色对应关系时，不会猜测原作外貌。</p><div class="status">${esc(archiveName())}</div>`)}${chars.length?chars.map(ch=>card(`<div class="chrow"><label class="check"><input type="checkbox" data-char="${esc(ch.character_id)}" ${ui.selected.includes(ch.character_id)?'checked':''}/><strong>${esc(ch.name)}</strong></label><small>${ch.active?'当前场景':'已登记'} · ${esc(ch.activity||'')}</small></div>`)).join(''):card('<p class="muted">请先使用原V4.1.10独立API完成角色档案，再生图。</p>')}`;
 }
 function gallery(){const works=ui.gallery.filter(x=>x.chatId===ui.chat.id);return `${card(`<h2>本聊天图库</h2><p class="small">共${works.length}张 · 图片保存在浏览器IndexedDB中，删除前请先下载重要作品。</p>${btn('刷新图库','gallery-refresh','flat')}`)}${works.length?`<div class="artgrid">${works.map(x=>`<article class="art"><button class="image-btn" data-act="preview:${esc(x.id)}"><img src="${esc(ui.galleryUrls.get(x.id)||'')}" alt="已生成插画" /></button><div class="artbody"><small>${new Date(x.createdAt).toLocaleString()} · ${esc(x.engine)}</small><div class="actions">${btn('放大','preview:'+x.id)}${btn('保存','download:'+x.id)}${btn('删除','delete:'+x.id,'flat')}</div></div></article>`).join('')}</div>`:card('<p class="muted">暂无图片。生成成功后会自动保存到这里。</p>')}`;}
 function settings(){const tab=ui.settingsTab;return `${card(`<h2>API与生成设置</h2><div class="twos">${[['prompt','提示词API'],['image','生图引擎'],['pixiv','Pixiv月榜']].map(([id,t])=>`<button class="mode ${tab===id?'selected':''}" data-act="stab:${id}">${t}</button>`).join('')}</div>`)}
 ${tab==='prompt'?card(`<h3>画面导演模型</h3><label class="check"><input type="checkbox" data-check="prompt.useMain" ${s.prompt.useMain?'checked':''}/>使用SillyTavern主API生成提示词</label>${s.prompt.useMain?'<p class="hint">调用酒馆当前主API的 generateRaw，不额外填写模型密钥。仅用于编译画面提示词，不修改正文。</p>':`${field('OpenAI兼容接口基础地址','prompt.base',{placeholder:'https://api.openai.com/v1'})}${field('独立API Key','prompt.key',{type:'password'})}${field('模型名称','prompt.model',{placeholder:'点击获取模型列表'})}${btn('获取可用模型列表','models-prompt','flat')}`}<p class="small">不使用提示词API时，仍可采用本地编译，但精细场景理解与风格解析需要视觉模型。</p>`):''}
 ${tab==='image'?card(`<h3>生图引擎</h3>${pick('选择引擎','image.engine',[['openai','OpenAI兼容图像API'],['comfy','ComfyUI浏览器直连'],['novelai','NovelAI官方图像API']])}${s.image.engine==='comfy'?`${field('ComfyUI服务地址','image.comfyBase',{placeholder:'http://电脑局域网IP:8188'})}${field('Checkpoint文件名','image.checkpoint')}${btn('读取ComfyUI模型列表','checkpoints','flat')}${field('高级：API工作流JSON（可选）','image.workflow',{type:'textarea',rows:6,placeholder:'留空使用标准Checkpoint工作流；可用占位符 {{PROMPT}}、{{NEGATIVE}}、{{WIDTH}}、{{HEIGHT}}、{{SEED}}、{{CKPT}}'})}`:s.image.engine==='novelai'?`${field('NovelAI Persistent Token','image.key',{type:'password'})}${pick('NovelAI模型','image.naiModel',[['nai-diffusion-5-full','NovelAI Diffusion V5 Full'],['nai-diffusion-4-5-full','NovelAI Diffusion V4.5 Full']])}`:`${field('基础地址','image.base')}${field('生图API Key','image.key',{type:'password'})}${field('图像模型','image.model')}${btn('获取可用模型列表','models-image','flat')}`}${pick('画幅尺寸','image.size',[['1024x1536','竖版 1024×1536'],['1536x1024','横版 1536×1024'],['1024x1024','方形 1024×1024'],['832x1216','竖版 832×1216'],['1216x832','横版 1216×832']])}${field('负面提示词','image.negative',{type:'textarea',rows:3})}${btn('测试引擎连通性','test-image','flat')}`):''}
 ${tab==='pixiv'?card(`<h3>Pixiv真实月榜 · GitHub代码同步</h3><p>取消第三方榜单API Key。由你的GitHub仓库Actions定时读取Pixiv公开月度排行榜，只在数据真实、排名完整时更新50条元数据。若Pixiv限制访问，同步会失败并保留上次数据，不会生成假榜。</p>${field('你的扩展GitHub仓库地址（可选，远程自动读取）','pixiv.githubRepo',{placeholder:'https://github.com/用户名/avs-visual-workshop'})}<p class="hint">可留空读取当前扩展内的同步快照；填写后将优先从仓库main分支读取最新榜单，不需要填写密钥。首次同步需到GitHub → Actions运行一次。</p><label class="check"><input type="checkbox" data-check="pixiv.proxy" ${s.pixiv.proxy?'checked':''}/>允许第三方缓存代理尝试显示Pixiv缩略图（可随时关闭）</label><p class="hint">缩略图可能受Pixiv防盗链限制；代理有可用性和隐私风险，只发送公开图片地址，不发送聊天和角色资料。</p>${btn('读取已同步的月榜前50','ranking','primary')}<p class="small">月榜更新时间：${esc(s.pixiv.updated||'尚未成功同步')} · 当前可用：${(s.pixiv.items||[]).length}/50</p>`):''}
 ${card(`<h3>自动创作</h3><label class="check"><input type="checkbox" data-check="auto" ${s.auto?'checked':''}/>在AI回复完毕且V4.1.10同步完成后自动配图</label><p class="hint">自动模式会触发API计费；检测到聊天变更或档案未同步则不会提交生图。每次只处理一个有效回复。</p><div class="row">${btn('导出非密钥配置','backup','flat')}${btn('查看诊断','diagnostics','flat')}</div>`)} `;}
 function diagnostics(){return `${card(`<h2>诊断与安全</h2><p class="small">扩展：${VERSION} · 页面：${esc(location.href)}<br/>SillyTavern：${ui.chat.context?'可读取聊天':'未取得聊天'}<br/>V4.1.10桥接：${ui.archive?.bridge?'就绪':'未就绪'}<br/>档案：${esc(archiveName())}<br/>图库：${ui.gallery.length}条<br/>任务：${ui.tasks.length}条<br/>同人后台识别：${esc(fanSummary(s,cardContext(ui.chat.context))?.status||'未开启')} ${esc(fanSummary(s,cardContext(ui.chat.context))?.work||'')}</p><p>此扩展不改写角色档案，也不自动修改聊天正文。若浏览器阻止跨域连接，请处理浏览器/服务商的CORS设置；AVS不会额外安装Termux服务器插件。</p>${btn('刷新诊断','refresh','flat')}`)}${card(`<h3>最近任务</h3>${ui.tasks.slice(0,20).map(t=>`<div class="task"><b>${esc(t.status)}</b> · ${esc(t.mode)} · ${esc(new Date(t.time).toLocaleString())}<small>${esc(t.message||'')}</small></div>`).join('')||'暂无任务'}`)}`;}
 function preview(){const item=ui.gallery.find(x=>x.id===ui.previewId);return item?`<div class="lightbox"><div class="light-card"><button class="btn" data-act="preview-close">← 返回图库</button><img src="${esc(ui.galleryUrls.get(item.id)||'')}" alt="生成图片"/><p class="small">${esc(item.prompt?.slice(0,1200)||'')}</p><div class="row">${btn('保存原图','download:'+item.id)}${btn('按原提示词重绘','regenerate:'+item.id)}</div></div></div>`:''}

  function modelRows(){
    const type=ui.modelPicker,list=ui.models[type]||[],q=ui.modelSearch.trim().toLowerCase(),favs=s.modelFavorites?.[type]||[];
    const filtered=(q?list.filter(m=>String(m).toLowerCase().includes(q)):list).filter(m=>ui.modelView!=='favorites'||favs.includes(m));
    if(!filtered.length)return '<p class="muted">没有匹配的模型，请尝试缩短搜索词。</p>';
    const current=type==='prompt'?s.prompt.model:type==='image'?s.image.model:s.image.checkpoint;
    return `<div class="model-count">找到 ${filtered.length} / ${list.length} 个模型 · 当前：${esc(current||'尚未选择')}（每次显示前400条，继续搜索可找到全部）</div>`+
      filtered.slice(0,400).map(m=>{const i=list.indexOf(m),selected=current===m;
        return `<div class="model-line"><button type="button" class="model-option ${selected?'selected':''}" data-act="model-index:${i}" title="${esc(m)}">${esc(m)}${selected?'　✓':''}</button><button type="button" class="model-star" data-act="model-fav:${i}" aria-label="收藏或取消收藏模型">${favs.includes(m)?'★':'☆'}</button></div>`}).join('');
  }
  function modelModal(){
    if(!ui.modelPicker)return '';
    const title=ui.modelPicker==='prompt'?'选择提示词模型':ui.modelPicker==='image'?'选择生图模型':'选择ComfyUI Checkpoint';
    return `<div class="model-overlay" role="dialog" aria-modal="true" aria-label="${title}">
      <div class="model-modal"><div class="model-head">
        <button class="head-btn" data-act="model-close">← 返回设置</button>
        <strong>${title}</strong><span class="model-total">${(ui.models[ui.modelPicker]||[]).length}个</span>
      </div><div class="model-search-wrap"><input class="model-search" data-model-search type="search" value="${esc(ui.modelSearch)}" placeholder="搜索模型名称（支持大量模型）" autocomplete="off"/></div>
      <div class="model-tabs"><button class="mode ${ui.modelView==='all'?'selected':''}" data-act="model-view:all">全部模型</button><button class="mode ${ui.modelView==='favorites'?'selected':''}" data-act="model-view:favorites">已收藏</button></div><div class="model-results" data-model-results>${modelRows()}</div>
      </div></div>`;
  }

 function render(){if(!content)return;let center='';try{center=ui.page==='home'?home():ui.page==='style'?style():ui.page==='characters'?characters():ui.page==='gallery'?gallery():ui.page==='settings'?settings():diagnostics()}catch(e){center=`<section class="card"><h3>界面渲染异常</h3><pre>${esc(e.stack||e)}</pre></section>`;console.error(e)}
 content.innerHTML=`${header()}<main class="main">${notice()}${center}</main>${footer()}${ui.previewId?preview():''}${modelModal()}`;
 }
 async function refresh(){const gen=++refreshToken;const last=contextInfo(),arc=await archiveView();if(gen!==refreshToken)return;const changed=last.id!==ui.chat.id;ui.chat=last;ui.archive=arc;
 if(changed){ui.selected=[];ui.tasks=loadTasks(last.id);ui.prompt='';ui.promptSource='';ui.directorPlan=null;ui.directorNote='';ui.previewId='';}
 const ids=arc.characters.filter(c=>c.active).map(x=>x.character_id);if(!ui.selected.length)ui.selected=ids.length?ids:arc.characters.slice(0,1).map(x=>x.character_id);
 try{await refreshGallery(gen)}catch(e){ui.notice='图库无法读取：'+String(e.message||e);ui.error=ui.notice}render();
  const cardInfo=cardContext(last.context);if(fanEnabled(s,cardInfo)){discoverFanCard(last.context,s).then(()=>persist()).catch(e=>console.warn('[AVS] 同人来源后台检索受阻',e));}}
 async function refreshGallery(gen=refreshToken){const all=(await dbAll('gallery')).sort((a,b)=>b.createdAt-a.createdAt);if(gen!==refreshToken)return;ui.gallery=all.slice(0,220);
 for(const item of ui.gallery){if(item.chatId===ui.chat.id&&!ui.galleryUrls.has(item.id)){ui.galleryUrls.set(item.id,URL.createObjectURL(item.blob))}}
 for(const [id,url] of ui.galleryUrls){if(!ui.gallery.find(x=>x.id===id&&x.chatId===ui.chat.id)){URL.revokeObjectURL(url);ui.galleryUrls.delete(id)}} }
 async function refreshStyleMedia(){for(const x of s.styles){if(!x.mediaId||ui.styleMediaUrls.has(x.id))continue;const blob=(await dbGet('media',x.mediaId))?.blob;if(blob)ui.styleMediaUrls.set(x.id,URL.createObjectURL(blob))}for(const [id,url] of ui.styleMediaUrls){if(!s.styles.find(x=>x.id===id)){URL.revokeObjectURL(url);ui.styleMediaUrls.delete(id)}}render()}
 let triedPixivAutoload=false;
 function show(page){ui.oldPage=ui.page;ui.page=page;ui.previewId='';ui.notice='';ui.error='';render();
   if(page==='style'&&!triedPixivAutoload&&!(s.pixiv.items||[]).length){
     triedPixivAutoload=true;
     loadMonthlyRanking(s.pixiv.githubRepo||'').then(snapshot=>{
       s.pixiv.items=snapshot.items;s.pixiv.updated=snapshot.updated;persist();
       if(ui.page==='style')render();
     }).catch(e=>{ui.pixivStatus=String(e.message||e);if(ui.page==='style')render()});
   }
 }
 // A real top-layer <dialog> is isolated from transformed or zero-height CSS
 // containing blocks. Never use 100%-height fixed <div> as the sole viewport host.
 const nextPaint=()=>new Promise(resolve=>{(window.requestAnimationFrame||((fn)=>setTimeout(fn,16)))(()=>resolve())});
 function viewportBox(){
   const vv=window.visualViewport;
   const innerW=Number(window.innerWidth)||0,innerH=Number(window.innerHeight)||0;
   const cw=Number(document.documentElement?.clientWidth)||0,ch=Number(document.documentElement?.clientHeight)||0;
   const vvw=Number(vv?.width)||0,vvh=Number(vv?.height)||0;
   // Prefer the visual viewport, but a zero-height iframe can never host the UI.
   const width=vvw>160?vvw:(innerW>160?innerW:cw);
   const height=vvh>160?vvh:(innerH>160?innerH:ch);
   return {width:Math.round(width),height:Math.round(height),left:Math.round(Number(vv?.offsetLeft)||0),top:Math.round(Number(vv?.offsetTop)||0),innerHeight:innerH,visualHeight:vvh,documentHeight:ch};
 }
 function syncViewport(){
   if(!shell||!content)return false;
   const vp=viewportBox();
   if(vp.width<200||vp.height<240)return false;
   const css={position:'fixed',inset:'auto',left:vp.left+'px',top:vp.top+'px',right:'auto',bottom:'auto',width:vp.width+'px',height:vp.height+'px',maxWidth:'none',maxHeight:'none',minWidth:'0',minHeight:'0',margin:'0',padding:'0',border:'0',borderRadius:'0',transform:'none',overflow:'hidden',boxSizing:'border-box',zIndex:'2147483646',background:'#f6fbfe',pointerEvents:'auto'};
   for(const [k,v] of Object.entries(css))shell.style.setProperty(k.replace(/[A-Z]/g,x=>'-'+x.toLowerCase()),v,'important');
   const surfaceStyle={position:'absolute',inset:'0',width:'100%',height:'100%',display:'block',minHeight:'0',pointerEvents:'auto'};
   for(const [k,v] of Object.entries(surfaceStyle))surface.style.setProperty(k.replace(/[A-Z]/g,x=>'-'+x.toLowerCase()),v,'important');
   const inside={position:'absolute',inset:'0',left:'0',top:'0',width:'100%',height:'100%',minHeight:'0',display:'flex',flexDirection:'column',overflow:'hidden',pointerEvents:'auto',background:'#f6fbfe',color:'#244b63',boxSizing:'border-box'};
   for(const [k,v] of Object.entries(inside))content.style.setProperty(k.replace(/[A-Z]/g,x=>'-'+x.toLowerCase()),v,'important');
   return true;
 }
 function repair(){
   if(!shell||!surface||!shadow||!content||!document.body)return false;
   if(shell.parentNode!==document.body)document.body.append(shell);
   if(surface.parentNode!==shell)shell.append(surface);
   // A detached native dialog loses its top-layer membership even if `open` remains set.
   if(intentOpen&&!shell.matches(':modal')){
     try{if(shell.open)shell.close();shell.style.setProperty('display','block','important');shell.showModal()}
     catch(e){lastMountError='DIALOG_REATTACH_FAILED: '+String(e.message||e);return false}
   }
   if(!content.isConnected||content.getRootNode()!==shadow)shadow.append(content);
   if(!shadow.querySelector('style[data-avs-critical]')){
     const critical=document.createElement('style');critical.dataset.avsCritical='true';
     critical.textContent=`:host{color:#244b63;font:14px/1.6 sans-serif}*,*::before,*::after{box-sizing:border-box}.app{display:flex;flex-direction:column;overflow:hidden;background:#f6fbfe;pointer-events:auto;color:#244b63}.top{display:flex;gap:8px;align-items:center;min-height:65px;padding:12px;background:white}.heading{flex:1;min-width:0}.heading strong,.heading small{display:block}.head-btn{min-height:42px;border:1px solid #abc8d8;background:white;border-radius:9px;padding:7px}.main{flex:1;min-height:0;overflow:auto;padding:14px}.bottom{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));background:white;padding:8px;gap:3px}.bottom button{min-width:0;min-height:45px}.card{background:white;border:1px solid #d1e4ed;border-radius:15px;padding:14px}`;
     shadow.prepend(critical);
   }
   return syncViewport();
 }
 function hasLiveUI(){
   return !!shell?.isConnected&&!!content?.isConnected&&content.getRootNode()===shadow
     &&!!content.querySelector('.top')&&!!content.querySelector('.bottom');
 }
 function layoutProbe(){
   const a=shell?.getBoundingClientRect(),b=content?.getBoundingClientRect();
   const vp=viewportBox();
   return {hostWidth:Math.round(a?.width||0),hostHeight:Math.round(a?.height||0),contentWidth:Math.round(b?.width||0),contentHeight:Math.round(b?.height||0),connected:hasLiveUI(),modal:!!shell?.matches?.(':modal'),hostDisplay:shell?window.getComputedStyle(shell).display:'missing',contentDisplay:content?window.getComputedStyle(content).display:'missing',viewport:vp,hostIsTop:window===window.top};
 }
 function visibleGeometry(){
   if(!hasLiveUI()||!shell.open||!shell.matches(':modal'))return false;
   const p=layoutProbe();
   return p.hostDisplay!=='none'&&p.contentDisplay!=='none'&&p.hostWidth>=200&&p.hostHeight>=240&&p.contentWidth>=200&&p.contentHeight>=240;
 }
 function frontMost(){
   if(!visibleGeometry())return false;
   const vp=viewportBox();
   const hit=document.elementFromPoint(vp.left+vp.width/2,vp.top+vp.height/2);
   return !!hit&&(hit===shell||shell.contains(hit)||hit.getRootNode?.()===shadow);
 }
 function restoreMascot(){
   const pet=document.querySelector('#avs-mascot-v4-root .pet');
   if(pet&&priorMascotVisibility!==null)pet.style.visibility=priorMascotVisibility;
   priorMascotVisibility=null;
 }
 function stopGuard(){if(visibilityGuard!==null){window.clearInterval(visibilityGuard);visibilityGuard=null}}
 function close(){
   intentOpen=false;stopGuard();
   if(shell){try{if(shell.open)shell.close()}catch(e){console.warn('[AVS R2] 原生模态关闭失败',e)}shell.style.setProperty('display','none','important');shell.setAttribute('aria-hidden','true')}
   restoreMascot();ui.previewId='';
 }
 async function open(){
   try{
     if(!repair())throw new Error('无法取得SillyTavern可见主页面：'+JSON.stringify(viewportBox()));
     ui.page='home';ui.previewId='';render();
     if(!hasLiveUI())throw new Error('工坊导航尚未创建');
     // The new modal enters the browser top layer before the old dialog closes.
     shell.style.setProperty('display','block','important');shell.setAttribute('aria-hidden','false');
     if(shell.open&&!shell.matches(':modal'))shell.close();
     if(!shell.open)shell.showModal();
     intentOpen=true;lastMountError='';
     await nextPaint();
     if(!visibleGeometry())throw new Error('新工坊宿主未能进入可见顶层：'+JSON.stringify(layoutProbe()));
     refresh().catch(e=>console.warn('[AVS R2] 档案刷新失败',e));
     refreshStyleMedia().catch(e=>console.warn('[AVS R2] 参考图读取失败',e));
     return {ok:true,phase:'prepared',version:VERSION};
   }catch(e){lastMountError=String(e?.stack||e);close();console.error('[AVS R2] PREPARE_FAILED',e);return {ok:false,code:'PREPARE_FAILED',error:String(e?.message||e)};}
 }
 async function verifyVisible(){
   try{
     if(!repair()||!hasLiveUI())throw new Error('视觉工坊节点已丢失');
     await nextPaint();
     if(!visibleGeometry())throw new Error('工坊未进入可见顶层：'+JSON.stringify(layoutProbe()));
     // Closing the old V4 dialog must not demote the new top-layer dialog.
     if(!frontMost())throw new Error('工坊被其他页面遮挡：'+JSON.stringify(layoutProbe()));
     return {ok:true,code:'VISIBLE',version:VERSION,layout:layoutProbe(),hitVisible:true};
   }catch(e){lastMountError=String(e?.stack||e);console.error('[AVS R2] VISIBLE_MOUNT_FAILED',e);return {ok:false,code:'VISIBLE_MOUNT_FAILED',error:String(e.message||e)};}
 }
 function activate(){
   if(!visibleGeometry()||!frontMost())throw new Error('界面尚不可见，不会隐藏AVS悬浮球：'+JSON.stringify(layoutProbe()));
   const pet=document.querySelector('#avs-mascot-v4-root .pet');
   if(pet){if(priorMascotVisibility===null)priorMascotVisibility=pet.style.visibility||'';pet.style.visibility='hidden'}
   stopGuard();
   visibilityGuard=window.setInterval(()=>{
     if(!intentOpen)return;
     if(!repair()||!visibleGeometry()||!frontMost()){
       lastMountError='VISUAL_HOST_UNAVAILABLE：视觉工坊显示异常，已恢复悬浮球';
       console.error('[AVS R2]',lastMountError,layoutProbe());
       close();
     }
   },1200);
   return {ok:true};
 }
 function setBusy(str){ui.busy=str;render()}
 function recordTask(job){ui.tasks.unshift(job);ui.tasks=ui.tasks.slice(0,60);saveTasks(ui.chat.id,ui.tasks)}
 function updateTask(job,status,message){job.status=status;job.message=message;saveTasks(job.chatId,ui.tasks);render()}
 async function waitForCore(signal){const latest=contextInfo(),deadline=Date.now()+125000;let arc=await archiveView();let gate=archiveGate(arc,latest);if(!gate)return {arc,ctx:latest};
 if(!gate.includes('尚未完成独立API视觉同步'))throw new Error(gate);
 while(Date.now()<deadline){if(signal.aborted)throw new Error('用户取消');setBusy('等待V4.1.10独立API完成正式角色档案…');await new Promise(r=>setTimeout(r,2200));arc=await archiveView();const now=contextInfo();if(now.id!==latest.id||now.index!==latest.index)throw new Error('生成期间聊天或AI回复发生变化，已安全停止');gate=archiveGate(arc,now);if(!gate)return {arc,ctx:now};if(!gate.includes('尚未完成'))throw new Error(gate)}
 throw new Error('V4.1.10独立API同步等待超时，请查看角色档案的日志；没有发送生图请求');}
 async function preparePrompt(arc,ctx,signal){const packets=await chosenCharacterPacket(arc,selections());setBusy('结构化画面导演正在整理剧情、档案和摄影镜头…');try{
 const cardInfo=cardContext(ctx.context);if(fanEnabled(s,cardInfo)){await discoverFanCard(ctx.context,s,signal);persist();}
 const result=await compileDirectedPrompt(ctx,packets,s,ui.mode,signal);
 ui.directorPlan=result.plan;ui.directorNote=result.note;return result;
 }catch(e){throw new Error('导演规划或编译失败：'+e.message+'。未发送图像请求；如模型不支持JSON，可关闭提示词API使用保守本地方案。')}}
 async function runTask(promptOnly=false,direct=false){if(workRunning){tell('已有生成任务正在执行，请勿重复提交',true);return}workRunning=true;aborter=new AbortController();const ctl=aborter.signal;
 const current=contextInfo();const job={id:makeId('task'),time:Date.now(),status:'运行中',message:'初始化',chatId:current.id,mode:ui.mode};recordTask(job);
 try{
 if(!promptOnly){const x=s.image;if(x.engine==='openai'&&!x.model)throw new Error('请先在设置中填写图像模型');if(x.engine==='novelai'&&!x.key)throw new Error('请先配置NovelAI令牌');if(x.engine==='comfy'&&!x.checkpoint&&!x.workflow)throw new Error('请先选择ComfyUI模型或导入工作流')}
 const {arc,ctx}=await waitForCore(ctl);if(current.id!==ctx.id||current.index!==ctx.index)throw new Error('聊天内容已变化，防止生成错楼层图片');
 let result;if(direct){if(!ui.prompt.trim())throw new Error('还没有提示词，请先点击“仅编译提示词”');result={positive:ui.prompt,negative:ui.negative,source:'手动提示词'}}else{result=await preparePrompt(arc,ctx,ctl);ui.prompt=result.positive;ui.negative=result.negative;ui.promptSource=result.source}
 if(promptOnly){updateTask(job,'已编译','提示词已生成，没有发送图像请求');tell('提示词编译完成，可直接点击“使用现有提示词生成”。');return}
 const targetParts=ui.mode==='comic'&&!direct&&result.panels?.length?result.panels:null;
 const num=targetParts?.length||1;
 const bindingHash=hashScene(ctx.text);
 const allPanelBlobs=[];
 for(let i=0;i<num;i++){
 if(ctl.aborted)throw new Error('用户取消');const latest=contextInfo();if(latest.id!==ctx.id||latest.index!==ctx.index||hashScene(latest.text)!==bindingHash)throw new Error('聊天或楼层内容已变化，停止写入错误楼层');
 const positive=targetParts?targetParts[i].positive:result.positive;
 const negative=targetParts?targetParts[i].negative:result.negative;
 setBusy(`正在请求图像引擎（${i+1}/${num}），请勿重复点击…`);
 const blob=await generateImage(s.image,positive,negative,ctl,msg=>{ui.busy=msg;render()});
 if(!(blob instanceof Blob)||!blob.size)throw new Error('生图接口返回空白图片');if(!blob.type.startsWith('image/'))throw new Error('返回内容不是图片：'+blob.type);
 const key=makeId('img');await dbPut('gallery',{id:key,chatId:ctx.id,messageIndex:ctx.index,sourceHash:bindingHash,createdAt:Date.now(),engine:s.image.engine,kind:targetParts?'comic_panel':'illustration',panelNo:targetParts?i+1:undefined,prompt:positive,negative,source:result.source,styleId:result.styleId,styleRevision:result.styleRevision,directorPlan:result.plan||null,blob});
 allPanelBlobs.push(blob);await refreshGallery();render();
 }
 if(targetParts && allPanelBlobs.length===targetParts.length){
 setBusy('正在将漫画画格和中文对白排成一页…');const nameMap=new Map((result.plan?.cast||[]).map(x=>[x.id,x.name]));
 try{const pageBlob=await comicPageBlob(allPanelBlobs,targetParts,nameMap);
 await dbPut('gallery',{id:makeId('comicpage'),chatId:ctx.id,messageIndex:ctx.index,sourceHash:bindingHash,kind:'comic_page',createdAt:Date.now(),engine:s.image.engine,prompt:result.positive,negative:result.negative,styleId:result.styleId,styleRevision:result.styleRevision,source:result.source,blob:pageBlob});await refreshGallery();
 }catch(err){tell('逐格图片已保存，但漫画拼页失败：'+String(err.message||err),true)}
 }
 updateTask(job,'成功',`图像已保存到对应聊天图库；任务目标 ${num} 张`);tell('图片生成并保存成功，已归入本聊天图库。');ui.page='gallery';render();
 }catch(e){const msg=String(e?.message||e);updateTask(job,ctl.aborted?'已取消':'失败',msg);tell(msg,true)}finally{workRunning=false;aborter=null;ui.busy='';render()}
 }
 async function fetchRanking(){if(ui.rankingBusy)return;ui.rankingBusy=true;aborter=new AbortController();setBusy('读取GitHub同步的Pixiv真实月榜快照…');
    try{const snapshot=await loadMonthlyRanking(s.pixiv.githubRepo||'',aborter.signal);
      s.pixiv.items=snapshot.items;s.pixiv.updated=snapshot.updated;persist();
      ui.page='style';tell(`已载入经过核验的月榜：${snapshot.count}件作品。实际图片缩略图仍受Pixiv防盗链限制。`);
    }catch(e){tell('月榜快照不可用：'+String(e.message||e),true)}
    finally{ui.rankingBusy=false;aborter=null;setBusy('')}
  }
  async function pickPixiv(id){const x=s.pixiv.items.find(x=>x.id===id);if(!x)return tell('找不到该Pixiv作品',true);const ref='pixiv:'+x.id;let style=s.styles.find(v=>v.id===ref);
   if(!style){style={id:ref,label:`#${x.rank} ${x.title}`,source:'Pixiv月榜',url:x.url,thumbnail:x.thumbnail,tags:x.tags,analysis:null};s.styles.unshift(style)}
   persist();tell('作品已收藏。选择收藏中的“使用该图片画风”才会解析并锁定，不影响当前画风');}
 async function uploadStyle(){picker.value='';ui.pendingFile='style';picker.click()}
 async function onPicked(){const file=picker.files?.[0];if(!file)return;if(!file.type.startsWith('image/'))return tell('只能上传图片文件',true);if(file.size>8*1024*1024)return tell('参考图过大，不能超过8MB',true);
 try{const id=makeId('style'),mediaId=makeId('media');await dbPut('media',{id:mediaId,name:file.name,blob:file});s.styles.unshift({id,label:file.name.replace(/\.[^.]*$/,'').slice(0,60)||'我的参考图',source:'本地图片',mediaId,analysis:null});ui.styleMediaUrls.set(id,URL.createObjectURL(file));persist();ui.page='style';render();await useStyle(id)}catch(e){tell('图片保存失败：'+e.message,true)}}
 async function analyzeStyle(id){const x=s.styles.find(v=>v.id===id);if(!x)return tell('找不到该画风条目',true);if(!s.prompt.key||s.prompt.useMain)return tell('图片画风自动解析需要一个支持图片输入的视觉模型，请在提示词API设置选择独立视觉模型；原画风保持不变。',true);
 aborter=new AbortController();setBusy('正在读取图像、分析线稿/上色/光影/构图…');try{let blob;
 if(x.mediaId){blob=(await dbGet('media',x.mediaId))?.blob}else if(x.thumbnail){const url=thumb(x.thumbnail);const r=await fetchTimeout(url,{signal:aborter.signal},45000);if(!r.ok)throw new Error('图片来源返回HTTP '+r.status);blob=await r.blob()}
 if(!blob||!blob.type.startsWith('image/'))throw new Error('无法获取图像像素，请确认源图片可下载或改用本地上传');if(blob.size>9*1024*1024)throw new Error('参考图超出视觉模型传输限制（9MB）');
 const data=await blobToDataURL(await prepareStylePixels(blob));
 const raw=await visionChat(s.prompt,'You are a professional ACGN style extractor. Return JSON with positive, negative, description, tags, palette, lighting. Extract only reusable line quality, stroke/brushwork, shading technique, generic color handling, rendering texture, stylization and light treatment. Do NOT identify or depict subjects, anatomy, clothes, hair or eye color, poses, location, camera angle, text, artists or specific copyrighted compositions. Negative must ONLY exclude rendering flaws, never people/objects/scene types. No subject tokens allowed in positive or negative.',`请先在内部辨别参考图里的具体人物、衣服、姿势和场景，但不要输出这些内容。只输出可以用于任意人物与场景的绘画风格正面/负面提示词。JSON字段positive、negative、description、tags、palette、lighting。禁止1girl、衣服、发色、具体道具、地点、摄影机位标签。`,data,aborter.signal);
 const analyzed=normalizeAnalysis(raw);const safe=auditStyle(analyzed);x.analysis={...analyzed,...safe};persist();tell('画风解析与主体信息审查通过，已保存独立正负提示词。');
 }catch(e){tell('画风解析失败：'+e.message,true)}finally{aborter=null;setBusy('')}}
 async function useStyle(id){const entry=s.styles.find(x=>x.id===id);if(!entry)return tell('未找到画风候选',true);
 if(!entry.analysis?.positive){await analyzeStyle(id);if(!entry.analysis?.positive)return tell('本次图片的视觉解析失败，原画风锁定保持不变。',true)}
 const next=createStyleLock({styleId:entry.id,positive:entry.analysis.positive,negative:entry.analysis.negative||''},s.styleLock);
 s.styleLock=next;s.chosenStyle=id;ui.styleDraft=null;persist();tell(`画风已锁定（版本${next.revision}），剧情导演不能覆盖正负提示词`);
 }
 function saveStyleDraft(){const old=s.styleLock||null;const d=ui.styleDraft||{positive:old?.positive||'',negative:old?.negative||''};
 s.styleLock=createStyleLock({styleId:old?.styleId||s.chosenStyle||'manual-style',positive:d.positive,negative:d.negative},old);ui.styleDraft=null;persist();tell(`手动画风提示词已保存并锁定（版本${s.styleLock.revision}）`)}
 function clearStyleLock(){if(!confirm('清除当前画风的正负提示词锁定？不会删除收藏，也不会改写角色档案。'))return;
 s.styleLock=null;s.chosenStyle=null;ui.styleDraft=null;persist();tell('当前画风锁定已清除，收藏仍然保留')}
 async function galleryDelete(id){const item=ui.gallery.find(x=>x.id===id);if(!item)return;if(!confirm('确定删除这张图片？此操作只影响AVS R2图库，不能撤销。'))return;try{await dbDelete('gallery',id);const url=ui.galleryUrls.get(id);if(url)URL.revokeObjectURL(url);ui.galleryUrls.delete(id);await refreshGallery();tell('已删除所选图片')}catch(e){tell('删除失败：'+e.message,true)}}
 async function download(id){const item=ui.gallery.find(x=>x.id===id);if(!item)return;const url=ui.galleryUrls.get(id)||URL.createObjectURL(item.blob);const a=document.createElement('a');a.href=url;a.download=`AVS_R2_${new Date(item.createdAt).toISOString().slice(0,10)}_${id}.${item.blob.type.includes('jpeg')?'jpg':'png'}`;document.body.append(a);a.click();a.remove();if(!ui.galleryUrls.has(id))setTimeout(()=>URL.revokeObjectURL(url),500)}
 async function connectivity(){try{setBusy('正在测试浏览器直连…');let items;
 if(s.image.engine==='comfy')items=await listCheckpoints(s.image.comfyBase);else if(s.image.engine==='novelai'){const r=await fetchTimeout('https://image.novelai.net/user/subscription',{headers:{Authorization:`Bearer ${s.image.key}`}},35000);if(!r.ok)throw new Error('NovelAI HTTP '+r.status);items=['NovelAI订阅响应正常']}else items=await models(s.image.base,s.image.key);
 tell(`引擎接口响应正常：${items.length}项；生成能力仍需实际图像任务验证。`)}catch(e){tell('连接测试失败：'+e.message,true)}finally{setBusy('')}}
 function saveConfigBackup(){const safe=structuredClone(s);safe.prompt.key='';safe.image.key='';safe.pixiv.apiKey='';const file=new Blob([JSON.stringify({version:VERSION,settings:safe,date:new Date().toISOString()},null,2)],{type:'application/json'});const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download='AVS_R2_settings_without_keys.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),800)}
 async function action(act){try{
 if(act==='close')return close();if(act==='back'){if(ui.previewId){ui.previewId='';return render()}return show(ui.page==='home'?'home':ui.oldPage==='settings'&&ui.page==='style'?'settings':'home')}
 if(act.startsWith('goto:'))return show(act.split(':')[1]);if(act.startsWith('mode:')){ui.mode=act.split(':')[1];return render()}
 if(act==='refresh')return refresh();if(act==='abort'){aborter?.abort('user');return}
 if(act==='make')return runTask(false,false);if(act==='compile')return runTask(true,false);if(act==='direct')return runTask(false,true);
 if(act==='copy-prompt'){await navigator.clipboard.writeText(ui.prompt);return tell('正向提示词已复制')}
 if(act==='ranking')return fetchRanking();if(act.startsWith('pixivuse:')){const id=act.slice(9);await pickPixiv(id);return useStyle('pixiv:'+id)}if(act==='upload-style')return uploadStyle();if(act==='pixiv-config'){ui.settingsTab='pixiv';return show('settings')}
 if(act.startsWith('choosepixiv:'))return pickPixiv(act.slice(12));if(act.startsWith('analyze:')){const id=act.slice(8);const ref='pixiv:'+id;
   const x=s.pixiv.items.find(v=>v.id===id);if(!x)return tell('没有找到作品',true);
   if(!s.styles.some(v=>v.id===ref))s.styles.unshift({id:ref,label:`#${x.rank} ${x.title}`,source:'Pixiv月榜',url:x.url,thumbnail:x.thumbnail,tags:x.tags,analysis:null});
   persist();return analyzeStyle(ref)}
 if(act.startsWith('analyze-style:'))return analyzeStyle(act.slice(14));
 if(act.startsWith('styleuse:'))return useStyle(act.slice(9));
 if(act==='style-lock-save')return saveStyleDraft();if(act==='style-lock-clear')return clearStyleLock();
 if(act.startsWith('styledelete:')){const id=act.slice(12);if(!confirm('确定删除这条私人画风收藏吗？'))return;const x=s.styles.find(v=>v.id===id);if(x?.mediaId)await dbDelete('media',x.mediaId);if(ui.styleMediaUrls.has(id)){URL.revokeObjectURL(ui.styleMediaUrls.get(id));ui.styleMediaUrls.delete(id)}s.styles=s.styles.filter(v=>v.id!==id);if(s.chosenStyle===id && !s.styleLock)s.chosenStyle=null;persist();return tell('已删除该画风')}
 if(act.startsWith('mat:')){const k=act.slice(4);s.materials=s.materials.includes(k)?s.materials.filter(x=>x!==k):[...s.materials,k];persist();return render()}
 if(act.startsWith('fan-set:')){const card=cardContext(ui.chat.context);if(!card.id)return tell('请先进入普通角色卡聊天',true);s.fanCards||={};const enabled=act.endsWith(':yes');const previous=s.fanCards[card.id]||{};s.fanCards[card.id]={...previous,enabled};persist();render();if(enabled){discoverFanCard(ui.chat.context,s).then(()=>persist()).catch(e=>console.warn('[AVS] 后台同人识别失败',e));}return}
 if(act==='gallery-refresh')return refreshGallery().then(render);
 if(act.startsWith('preview:')){ui.previewId=act.slice(8);return render()}if(act==='preview-close'){ui.previewId='';return render()}
 if(act.startsWith('download:'))return download(act.slice(9));if(act.startsWith('delete:'))return galleryDelete(act.slice(7));
 if(act.startsWith('regenerate:')){const x=ui.gallery.find(v=>v.id===act.slice(11));if(!x)return;ui.prompt=x.prompt;ui.negative=x.negative;ui.previewId='';ui.mode='single';show('home');return tell('已载入原始提示词，点击“使用现有提示词生成”重绘')}
 if(act.startsWith('stab:')){ui.settingsTab=act.slice(5);return render()}
 if(act==='models-prompt'||act==='models-image'){setBusy('获取模型列表…');const name=act.endsWith('prompt')?'prompt':'image',v=s[name];
    let list;try{list=await models(v.base,v.key)}catch(e){list=[...(ui.models[name]||[]),...(s.modelFavorites?.[name]||[]),s[name].model].filter(Boolean);if(!list.length)throw e;tell('实时刷新失败，仍可使用已选或收藏的模型：'+e.message,true)}
    ui.models[name]=[...new Set([s[name].model,...list].filter(Boolean))];ui.busy='';ui.modelPicker=name;ui.modelSearch='';ui.modelView='all';return render()}
 if(act==='checkpoints'){setBusy('读取ComfyUI模型列表…');ui.models.checkpoint=await listCheckpoints(s.image.comfyBase);ui.busy='';ui.modelPicker='checkpoint';ui.modelSearch='';ui.modelView='all';return render()}
 if(act==='model-close'){ui.modelPicker='';ui.modelSearch='';return render()}
 if(act.startsWith('model-view:')){ui.modelView=act.slice(11);return render()}
 if(act.startsWith('model-fav:')){const typ=ui.modelPicker,val=ui.models[typ]?.[Number(act.slice(10))];if(!val)return;s.modelFavorites[typ]||=[];s.modelFavorites[typ]=s.modelFavorites[typ].includes(val)?s.modelFavorites[typ].filter(x=>x!==val):[...s.modelFavorites[typ],val];persist();return render()}
 if(act.startsWith('model-index:')){const idx=Number(act.slice(12)),type=ui.modelPicker;
    const chosen=ui.models[type]?.[idx];if(!chosen)return tell('模型已失效，请重新获取模型列表',true);
    if(type==='prompt')s.prompt.model=chosen;else if(type==='image')s.image.model=chosen;else if(type==='checkpoint')s.image.checkpoint=chosen;
    persist();ui.modelPicker='';ui.modelSearch='';if(type==='prompt'&&fanEnabled(s,cardContext(ui.chat.context)))discoverFanCard(ui.chat.context,s).then(()=>persist()).catch(()=>{});return render()}
 if(act==='test-image')return connectivity();if(act==='backup')return saveConfigBackup();if(act==='diagnostics')return show('diagnostics');
 }catch(e){ui.busy='';tell('操作失败：'+String(e.message||e),true)}}
 function initialize(){
 // Remove obsolete standalone launchers from R2.0.0; the only entry is V4.1.10's mascot.
 document.querySelectorAll('.avs-r2-launcher,#avs-r2-launcher-css').forEach(el=>el.remove());
 try{window[KEY]?.destroy?.()}catch(e){console.warn('[AVS R2] 旧版本清理失败',e)}
 document.getElementById('avs-r2-workshop')?.remove();
 const link=document.createElement('link');link.rel='stylesheet';link.href=workUrl;
 link.addEventListener('error',()=>{lastMountError='完整样式表加载失败，已切换基本布局样式';console.warn('[AVS R2]',lastMountError)});
 shell=document.createElement('dialog');shell.id='avs-r2-workshop';shell.setAttribute('aria-label','AVS视觉工坊');shell.style.setProperty('display','none','important');shell.setAttribute('aria-hidden','true');shell.addEventListener('cancel',e=>{e.preventDefault();close()});
 surface=document.createElement('div');surface.id='avs-r2-visual-surface';shell.append(surface);shadow=surface.attachShadow({mode:'open'});shadow.append(link);
 content=document.createElement('div');content.className='app';shadow.append(content);document.body.append(shell);
 picker=document.createElement('input');picker.type='file';picker.accept='image/*';picker.style.display='none';picker.addEventListener('change',onPicked);shadow.append(picker);
 repair();
 window[KEY]={version:VERSION,open,verifyVisible,activate,close,repair,diagnostics:()=>({chat:ui.chat.id,archive:ui.archive?.runtime,ui:ui.page,visible:visibleGeometry(),frontMost:frontMost(),layout:layoutProbe(),lastMountError}),destroy(){close();window.removeEventListener('resize',syncViewport);window.visualViewport?.removeEventListener('resize',syncViewport);shell?.remove();if(window[KEY]?.version===VERSION)delete window[KEY]}};
 shadow.addEventListener('click',e=>{const b=e.target.closest('[data-act]');if(b){e.preventDefault();action(b.dataset.act)}});
 shadow.addEventListener('change',e=>{const el=e.target;if(el.dataset.bind){changePath(el.dataset.bind,el.value);if(el.dataset.bind==='image.engine'||el.dataset.bind==='prompt.useMain')render()}
 else if(el.dataset.check){changePath(el.dataset.check,el.checked);render()}
 else if(el.dataset.char){ui.selected=el.checked?[...new Set([...ui.selected,el.dataset.char])]:ui.selected.filter(x=>x!==el.dataset.char);render()}
 else if(el.dataset.ref){s.characterRefs[el.dataset.ref]=el.value.trim();persist()}});
 shadow.addEventListener('input',e=>{const el=e.target;
  if(el.hasAttribute('data-model-search')){ui.modelSearch=el.value;const box=shadow.querySelector('[data-model-results]');if(box)box.innerHTML=modelRows();return;}
  if(el.dataset.draft){if(el.dataset.draft==='positive')ui.prompt=el.value;else ui.negative=el.value}
  if(el.dataset.styleDraft){if(!ui.styleDraft)ui.styleDraft={positive:s.styleLock?.positive||'',negative:s.styleLock?.negative||''};ui.styleDraft[el.dataset.styleDraft]=el.value}});
 // Character reference URLs persist after leaving the field.
 shadow.addEventListener('focusout',e=>{const el=e.target;if(el?.dataset?.ref){s.characterRefs[el.dataset.ref]=el.value.trim();persist()}});
 // No separate launch button: AVS V4.1.10 mascot is the only entry.
 function eventHook(){try{const c=window.SillyTavern?.getContext?.();const src=c?.eventSource,events=c?.event_types;if(!src||!events)return;
 if(events.CHAT_CHANGED)src.on(events.CHAT_CHANGED,()=>{ui.notice='';ui.error='';refresh()});
 if(events.GENERATION_ENDED)src.on(events.GENERATION_ENDED,async()=>{if(!s.auto||workRunning)return;const ctx=contextInfo();const k=ctx.id+'#'+ctx.index;if(ctx.index<0||autolast===k)return;autolast=k;await runTask(false,false)})}catch(e){console.warn('[AVS R2] 事件挂载失败',e)}}
 window.addEventListener('resize',syncViewport);window.visualViewport?.addEventListener('resize',syncViewport);render();warmAssetLibrary().catch(e=>console.warn('[AVS] 视觉词典后台加载失败',e));window.setTimeout(eventHook,800);console.info('[AVS R2]',VERSION,'浏览器前端视觉工坊已挂载');}
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',initialize,{once:true});else initialize();
}
