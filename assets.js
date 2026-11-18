/* Local source-approved vocabulary. No legacy network tag feeds or stale cache reuse. */
import {resourceEntries,searchResources} from './visual_resources.js';
export async function warmAssetLibrary(){return resourceEntries;}
export function assetStatus(){return {source:'≥100星来源与AVS通用术语',count:resourceEntries.length,local:true};}
export function libraryCandidates(query,limit=55){return searchResources(query,{limit}).map(e=>({tag:e.description,group:e.category,origin:e.source_id}));}
export function lexiconForScene(story,packets=[]){return searchResources([story,...packets].join(' '),{limit:20}).map(e=>e.description).join(', ');}
