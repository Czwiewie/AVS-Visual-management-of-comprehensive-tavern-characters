/* R2.5 final image prompt compiler: atomic priority budget, read-only locked style,
 * and an output guard against narrative UI/auxiliary leakage. */
import {safeVisualText,extractCharacterFacts,characterImageText,cleanList,validateImagePrompt} from './prompt_compiler.js';
import {assertNoAuxiliaryLeak} from './story_cleaner.js';
export {safeVisualText,extractCharacterFacts,characterImageText,cleanList,validateImagePrompt};
export function composePrompt(style,parts,budget=6500){
 const locked=String(style||'').trim();
 if(locked.length>4000)throw new Error('用户锁定画风过长，需玩家手动修改；编译器不会截断画风');
 const remaining=budget-locked.length-(locked?2:0);
 if(remaining<240)throw new Error('生图提示词预算无法容纳已锁定画风和人物信息');
 const seen=new Set(),kept=[];let length=0;
 for(const item of parts){
   const t=safeVisualText(item,1300).trim();if(!t)continue;
   assertNoAuxiliaryLeak(t);
   // Prioritize complete high-level phrases over slicing a long engineering dump midway.
   const segments=t.length>520?t.split(/[,，;；](?=\s|[\p{L}\p{N}])/u).map(s=>s.trim()).filter(Boolean):[t];
   for(const segment of segments){
     if(!segment||segment.length>700)continue;
     const key=segment.toLocaleLowerCase();if(seen.has(key))continue;
     const delta=segment.length+(kept.length?2:0);
     if(length+delta>remaining)continue;
     kept.push(segment);seen.add(key);length+=delta;
   }
 }
 const output=locked+(locked&&kept.length?', ':'')+kept.join(', ');
 validateImagePrompt(output,'');assertNoAuxiliaryLeak(output);
 return output;
}
