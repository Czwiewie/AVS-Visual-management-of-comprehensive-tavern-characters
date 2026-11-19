import {NAI_PROFILES, profileFor, promptCounts} from './nai_compiler.js';
import {searchResources, resourceById} from './visual_resources.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
 '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[char]));

export function draftFromPrompts(positive, negative, previous) {
 const [base, ...slots] = String(positive || '').split('|').map(value => value.trim());
 const prior = previous?.characters || [];
 return {
  base, negative: String(negative || ''),
  characters: slots.map((prompt, index) => {
   const role = slots.length === prior.length ? prior[index] : null;
   return {id: role?.id || 'manual-' + index, prompt, negative: role?.negative || '', center: {...(role?.center || {x: 0.5, y: 0.5})}};
  }),
  useCoords: slots.length === prior.length ? previous?.useCoords ?? slots.length > 1 : slots.length > 1
 };
}

function promptTags(entry) {
 if (entry?.requires_scope_split || entry?.requires_parent_item) return [];
 return [...new Set((entry?.nai_tags || []).map(s => String(s).trim()))]
  .filter(s => s && s.length <= 110 && !/[|{}:\x00-\x1f\u3400-\u9fff]/u.test(s));
}

export function searchPromptTags(query) {
 return searchResources(query, {limit: 40}).filter(e => promptTags(e).length).slice(0, 8);
}

export function insertPromptTags(draft, target, id) {
 const tags = promptTags(resourceById.get(id));
 if (!tags.length) return false;
 const roleIndex = target.startsWith('role-') ? Number(target.slice(5)) : -1;
 const role = draft.characters[roleIndex];
 if (target !== 'base' && !role) return false;
 const before = role ? role.prompt : draft.base;
 const known = new Set(String(before).split(',').map(s => s.trim().toLowerCase()));
 const append = tags.filter(tag => !known.has(tag.toLowerCase()));
 if (!append.length) return false;
 if (role) role.prompt = [before.trim(), ...append].filter(Boolean).join(', ');
 else draft.base = [before.trim(), ...append].filter(Boolean).join(', ');
 return true;
}

const btn = (label, action, style = 'flat', disabled = false) =>
 `<button type="button" class="btn ${style}" data-act="${esc(action)}" ${disabled ? 'disabled' : ''}>${esc(label)}</button>`;

const area = (label, key, value, rows) =>
 `<label class="field"><span>${esc(label)}</span><textarea data-prompt-input="${esc(key)}" rows="${rows}">${esc(value)}</textarea></label>`;

export function promptBudget(draft, image) {
 const p = NAI_PROFILES[profileFor(image)];
 const count = promptCounts(draft);
 if (!p) return '';
 return p.model.endsWith('4-full')
  ? `约 ${count.base + count.roles} / ${p.workingBudget} 正向 tokens（全局与角色合计） · 负向约 ${count.negative}`
  : `全局约 ${count.base} / ${p.workingBudget} tokens · 角色正向合计约 ${count.roles} · 负向合计约 ${count.negative}`;
}

export function promptTagRows(query) {
 const results = searchPromptTags(query);
 if (!query.trim()) return '';
 return results.map(e => `<div class="row">${btn(e.label_zh || e.label, 'prompt-label:' + e.id)}
  <span class="small">${esc(promptTags(e).join(', '))}</span></div>`).join('') ||
  '<p class="small">没有找到具有明确英文标签的条目。</p>';
}

export function promptWorkspace(board, image, names = new Map()) {
 const profile = profileFor(image), p = NAI_PROFILES[profile];
 if (!p) return '<p>请先选择 Nai 4 Full 或 Nai 5 Full。</p>';
 const draft = board.drafts[board.active];
 const meta = board.metadata;
 const mismatch = meta?.unsupportedModel || (meta?.profile && meta.profile !== profile) || board.profile !== profile;
 const roleName = index => names.get(draft.characters[index]?.id) || ('角色 ' + (index + 1));
 const cards = draft.characters.map((role, index) => `<section class="prompt-role-card" data-prompt-role="${index}">
  <div class="row"><h3>${esc(roleName(index))}</h3>${btn('移除', 'prompt-remove:' + index)}</div>
  ${area('角色正向提示词', 'role-' + index + '-prompt', role.prompt, 3)}
  ${area('角色负向提示词', 'role-' + index + '-negative', role.negative, 2)}
  <div class="twos">${['x', 'y'].map(axis => `<label class="field"><span>${axis === 'x' ? '左右位置（左 0，右 1）' : '上下位置（上 0，下 1）'}</span>
   <input type="number" min="0" max="1" step="0.01" data-prompt-input="role-${index}-${axis}" value="${esc(role.center[axis])}" /></label>`).join('')}</div>
 </section>`).join('');
 return `<h2>提示词分区工作台</h2>
 <div class="row">${btn('读入 NovelAI 原图 PNG', 'prompt-png')}${btn('返回创作', 'goto:home')}</div>
 <p class="small">${esc(p.label)} · ${meta ? '原图数据已在本机读取。生成继续使用当前工坊参数。' : '编辑全局、角色正负词与站位，应用后可在创作页生成。'}</p>
 ${meta ? `<p class="small">原图来源 ${esc(meta.source || 'NovelAI，具体型号未标注')} · ${esc(meta.parameters.width)}×${esc(meta.parameters.height)}
  ${meta.parameters.steps != null ? ' · 步数 ' + esc(meta.parameters.steps) : ''}
  ${meta.parameters.scale != null ? ' · CFG ' + esc(meta.parameters.scale) : ''}
  ${meta.parameters.seed != null ? ' · Seed ' + esc(meta.parameters.seed) : ''}
  ${meta.parameters.sampler ? ' · ' + esc(meta.parameters.sampler) : ''}</p>` : ''}
 ${mismatch ? '<p class="hint">目前可以查看原图数据。应用草稿需在设置中选择与原图一致的 Nai 4 Full 或 Nai 5 Full。</p>' : ''}
 ${board.drafts.length > 1 ? `<label class="field"><span>编辑漫画分镜</span><select data-prompt-panel>${board.drafts.map((_, index) => `<option value="${index}" ${index === board.active ? 'selected' : ''}>第 ${index + 1} 格</option>`).join('')}</select></label>` : ''}
 ${area('全局画面正向提示词', 'base', draft.base, 4)}
 ${area('全局负向提示词', 'negative', draft.negative, 2)}
 <label class="check"><input type="checkbox" data-prompt-coords ${draft.useCoords ? 'checked' : ''}/>使用下方角色位置</label>
 <div class="prompt-roles">${cards}</div>
 <div class="row">${btn('添加角色分区', 'prompt-add', '', draft.characters.length >= p.maxCharacters)}</div>
 <label class="field"><span>中英文标签搜索</span><input type="search" data-prompt-query value="${esc(board.query)}" placeholder="如：高马尾、微笑、blue eyes、smile" /></label>
 <label class="field"><span>标签加入</span><select data-prompt-target>
  <option value="base" ${board.target === 'base' ? 'selected' : ''}>全局正向</option>
  ${draft.characters.map((_, index) => `<option value="role-${index}" ${board.target === 'role-' + index ? 'selected' : ''}>${esc(roleName(index))}的正向分区</option>`).join('')}
 </select></label>
 <div data-prompt-tags>${promptTagRows(board.query)}</div>
 <p class="small" data-prompt-budget>${esc(promptBudget(draft, image))}</p>
 <div class="row">${btn('应用提示词分区', 'prompt-apply', 'primary', mismatch)}</div>`;
}
