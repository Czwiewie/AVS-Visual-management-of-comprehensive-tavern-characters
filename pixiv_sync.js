
/* Pixiv monthly snapshot reader.
 * Does not authenticate to Pixiv, bypass access controls or invent rankings.
 * Monthly snapshot is populated by repository GitHub Actions when public ranking
 * data can be retrieved; images remain on their owners' hosts.
 */
function repoUrl(value){
 const raw=String(value||'').trim().replace(/\.git$/,'').replace(/\/+$/,'');
 if(!raw)return '';
 const m=/^https:\/\/github\.com\/([A-Za-z0-9-]+)\/([A-Za-z0-9_.-]+)$/.exec(raw);
 if(!m)throw new Error('GitHub仓库地址应为 https://github.com/用户名/仓库名');
 return `https://raw.githubusercontent.com/${m[1]}/${m[2]}/main/data/pixiv-monthly.json`;
}
function normalize(j){
 if(j?.status!=='ok'||!Array.isArray(j?.items)||j.items.length!==50){
  throw new Error(j?.message||'排行榜快照尚未同步成功；请在GitHub仓库的Actions运行“同步Pixiv月榜”');
 }
 const unique=new Set();
 const a=j.items.map(x=>{
  const id=String(x.id||''), rank=Number(x.rank);
  if(!/^\d+$/.test(id)||rank<1||rank>50||unique.has(id))throw new Error('月榜快照排名或作品ID不正确');
  unique.add(id);
  const url=`https://www.pixiv.net/artworks/${id}`;
  const thumbnail=String(x.thumbnail||'');
  return {id,rank,title:String(x.title||'未命名').slice(0,180),artist:String(x.artist||'作者未提供').slice(0,90),
   tags:Array.isArray(x.tags)?x.tags.map(String).slice(0,20):[],
   thumbnail:/^https:\/\/(i\.pximg\.net|www\.pixiv\.net)\//.test(thumbnail)?thumbnail:'',
   url};
 }).sort((a,b)=>a.rank-b.rank);
 if(a.some((x,i)=>x.rank!==i+1))throw new Error('月榜快照缺少某个名次，拒绝展示不完整前50');
 return {items:a,updated:String(j.syncedAt||''),source:String(j.source||'Pixiv monthly public ranking'),count:a.length};
}
async function readOne(url,signal){
 const ac=new AbortController(),timer=setTimeout(()=>ac.abort('timeout'),25000);
 const handler=()=>ac.abort('user');
 signal?.addEventListener('abort',handler,{once:true});
 try{
  const r=await fetch(url,{cache:'no-cache',credentials:'omit',signal:ac.signal});
  if(!r.ok)throw new Error('快照HTTP '+r.status);
  const t=await r.text();
  if(t.length>450000)throw new Error('快照数据超出大小限制');
  return normalize(JSON.parse(t));
 }finally{clearTimeout(timer);signal?.removeEventListener('abort',handler)}
}
export async function loadMonthlyRanking(repository='',signal){
 const urls=[],remote=repoUrl(repository);
 if(remote)urls.push(remote);
 urls.push(new URL('./data/pixiv-monthly.json',import.meta.url).href);
 const errs=[];
 for(const url of urls){
  try{return await readOne(url,signal)}
  catch(e){errs.push(String(e?.message||e));}
 }
 throw new Error('尚无可用的真实Pixiv月榜快照。'+errs.join('；')+'。在GitHub仓库Actions运行同步任务，成功后更新扩展或填写仓库URL。');
}
