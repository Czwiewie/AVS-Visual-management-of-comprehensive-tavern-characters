/* Explicit player mode wins. Scene detection may offer information, never silently switch modes. */
const VALID=new Set(['portrait','single','group','comic']);
export function resolveMode(requested,castCount){const mode=VALID.has(requested)?requested:'single';
 const portrait=mode==='portrait';return {mode,portrait,requireSingleSubject:portrait||mode==='single',
  layoutGoal:portrait?'premium character showcase':mode==='comic'?'sequential comic panels':mode==='group'?'multi-character interaction':'single scene illustration',
  scenePolicy:portrait?'Show the selected character, with only subtle supported scenery. Never copy a reference image character, hairstyle, costume or pose.':
   'Depict the currently occurring story instant. Never use unchosen options, memory appendices or parallel side events.',
  warning:(portrait&&castCount>1)?'立绘模式只使用当前选择的第一名角色；其他已选角色不会被画入':null};}
