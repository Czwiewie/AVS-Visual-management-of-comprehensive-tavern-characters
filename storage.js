const DB_NAME='AVS_R2_VISUAL_WORKSHOP',DB_VERSION=1;
const KEY='AVS_R2_SETTINGS_V1';
export const defaults={
  prompt:{useMain:false,base:'https://api.openai.com/v1',key:'',model:'',temperature:0.65},
  image:{engine:'openai',base:'https://api.openai.com/v1',key:'',model:'gpt-image-1',size:'1024x1536',
    comfyBase:'http://127.0.0.1:8188',checkpoint:'',steps:28,cfg:6.5,workflow:'',naiModel:'nai-diffusion-5-full',negative:'lowres, watermark, bad anatomy, malformed hands, extra fingers, illegible text'},
  pixiv:{apiKey:'',githubRepo:'',mode:'monthly',proxy:false,updated:'',items:[]},
  styles:[],chosenStyle:null,styleLock:null,materials:[],characterModes:{},characterRefs:{},fanCards:{},modelFavorites:{prompt:[],image:[],checkpoint:[]},
  director:{shotScale:'auto',elevation:'auto',depthOfField:'auto'},
  auto:false,layout:'portrait',comicPanels:2
};
export function settingsRead(){try{const x=JSON.parse(localStorage.getItem(KEY)||'{}');return {
...structuredClone(defaults),...x,
prompt:{...defaults.prompt,...(x.prompt||{})},image:{...defaults.image,...(x.image||{})},
pixiv:{...defaults.pixiv,...(x.pixiv||{})}, director:{...defaults.director,...(x.director||{})},
styles:Array.isArray(x.styles)?x.styles:[],materials:Array.isArray(x.materials)?x.materials:[],characterModes:x.characterModes||{},characterRefs:x.characterRefs||{},fanCards:x.fanCards||{},modelFavorites:{...defaults.modelFavorites,...(x.modelFavorites||{})}
};}catch{return structuredClone(defaults)}}
export function settingsWrite(s){try{localStorage.setItem(KEY,JSON.stringify(s));return true;}catch(e){throw new Error('设置保存失败：本地存储空间不足。请先导出数据，不要清理AVS角色档案。'+String(e.message||''))}}
let dbPromise;
function openDB(){if(dbPromise)return dbPromise;dbPromise=new Promise((resolve,reject)=>{
 const req=indexedDB.open(DB_NAME,DB_VERSION);
 req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('gallery'))db.createObjectStore('gallery',{keyPath:'id'});if(!db.objectStoreNames.contains('media'))db.createObjectStore('media',{keyPath:'id'});};
 req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error||new Error('IndexedDB 打开失败'));
 req.onblocked=()=>reject(new Error('图库数据库被其他窗口占用'));
});return dbPromise;}
async function tx(store,type,fn){const db=await openDB();return new Promise((res,rej)=>{const t=db.transaction(store,type),os=t.objectStore(store);let result;const req=fn(os);if(req){req.onsuccess=()=>{result=req.result};req.onerror=()=>rej(req.error)}t.oncomplete=()=>res(result);t.onabort=()=>rej(t.error||new Error('图库事务回滚'));t.onerror=()=>rej(t.error||new Error('图库事务失败'))})}
export const dbPut=(store,value)=>tx(store,'readwrite',o=>o.put(value));
export const dbGet=(store,id)=>tx(store,'readonly',o=>o.get(id));
export const dbAll=(store)=>tx(store,'readonly',o=>o.getAll());
export const dbDelete=(store,id)=>tx(store,'readwrite',o=>o.delete(id));
export function makeId(prefix='avs'){return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`}
export function taskKey(chatId){return `AVS_R2_TASKS_${String(chatId||'unknown').replace(/[^\w.\-]/g,'_').slice(0,100)}`}
export function loadTasks(chatId){try{return JSON.parse(localStorage.getItem(taskKey(chatId))||'[]').slice(0,60)}catch{return []}}
export function saveTasks(chatId,tasks){try{localStorage.setItem(taskKey(chatId),JSON.stringify(tasks.slice(0,60)))}catch(e){console.warn('AVS R2 task persistence',e)}}
