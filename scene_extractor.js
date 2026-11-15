/* R2.5 scene evidence projector: no new facts, no API call, no dossier writes. */
import {assertCleanStory} from './story_cleaner.js';
export function extractSceneEvidence(ctx,cast=[]){
 const clean=assertCleanStory(ctx?.text||'');
 const parts=clean.text.split(/\n{1,2}/).map(s=>s.trim()).filter(Boolean);
 const lastBeat=parts.slice(-3).join(' ').slice(-780);
 const named=cast.filter(c=>c?.name && clean.text.includes(c.name)).map(c=>({id:c.id,name:c.name}));
 return Object.freeze({mainStory:clean.text,lastBeat,visibleNameMentions:named,
   extractionMode:'main-story-only',source:'latest-completed-AI-reply',
   note:'Name mentions are evidence only; unnamed/pronoun references require director resolution. Never import a character solely from a parallel-event or memory appendix.'});
}
export function suggestCharacterIds(cleanedStory,characters=[]){
 const story=String(cleanedStory||'');
 const matches=characters.filter(ch=>typeof ch?.name==='string'&&ch.name.trim().length>=2&&story.includes(ch.name.trim()));
 // A missing explicit name is NOT proof of absence; callers must offer manual selection.
 return [...new Set(matches.map(ch=>ch.character_id).filter(Boolean))];
}
