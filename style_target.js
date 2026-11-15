/* Art-direction references describe transferable presentation, NOT franchise characters or costumes. */
export const VISUAL_TARGETS=Object.freeze({
 reference:{label:'仅跟随锁定参考画风',positive:'',portrait:'polished single-character key visual; subject legible, expressive pose, restrained peripheral scenery'},
 premium:{label:'商业二游立绘',positive:'',portrait:'premium illustrated mobile-game character showcase, character-forward composition, controlled intricate detail, refined face and expressive hands, carefully rendered established costume, sophisticated integrated lighting, minimal competing scenery'},
 naval:{label:'华丽二游角色展示向',positive:'',portrait:'premium elaborate anime game character key visual, elegant confident posing, highly refined fabric and accessory finish, rich but disciplined material highlights, striking silhouette, restrained decorative motifs'},
 resonant:{label:'清透高完成度角色宣传向',positive:'',portrait:'premium anime game character promotional artwork, clean sculpted silhouettes, refined layered shading, grounded directional illumination, carefully controlled color accents, modern polished visual clarity'}
});
export function targetFor(settings,mode){const id=VISUAL_TARGETS[settings?.visualTarget]?settings.visualTarget:'premium';const obj=VISUAL_TARGETS[id];return {id,label:obj.label,positive:obj.positive,portrait:mode==='portrait'?obj.portrait:''};}
