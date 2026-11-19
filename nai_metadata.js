const PNG_MAGIC = [137, 80, 78, 71, 13, 10, 26, 10];
const FILE_LIMIT = 32 * 1024 * 1024;
const TEXT_LIMIT = 2 * 1024 * 1024;
const MAX_PIXELS = 16 * 1024 * 1024;
const decoder = new TextDecoder();
const SOURCE_MODELS = {
 '4:79f47848':'nai4full',
 '5:0adf9ab7':'nai5full',
 '5:db276663':'curated'
};

function object(value) {
 return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function parseObject(value) {
 if (typeof value !== 'string') return object(value);
 try { return object(JSON.parse(value)); } catch { return {}; }
}

function utf8(bytes) {
 return decoder.decode(bytes);
}

async function inflate(bytes, format) {
 if (typeof DecompressionStream !== 'function') throw new Error('当前浏览器无法解压 PNG 元数据');
 const reader = new Blob([bytes]).stream().pipeThrough(new DecompressionStream(format)).getReader();
 const parts = [];
 let size = 0;
 try {
  while (true) {
   const {value, done} = await reader.read();
   if (done) break;
   size += value.length;
   if (size > TEXT_LIMIT) throw new Error('PNG 元数据过大');
   parts.push(value);
  }
 } catch (error) {
  await reader.cancel().catch(() => {});
  throw error;
 } finally {
  reader.releaseLock();
 }
 return new Uint8Array(await new Blob(parts).arrayBuffer());
}

async function textChunk(type, payload) {
 const keyEnd = payload.indexOf(0);
 if (keyEnd < 1 || keyEnd > 79) return null;
 const key = utf8(payload.subarray(0, keyEnd));
 let cursor = keyEnd + 1;
 if (type === 'tEXt') return [key, utf8(payload.subarray(cursor))];
 if (type === 'zTXt') {
  if (payload[cursor++] !== 0) return null;
  return [key, utf8(await inflate(payload.subarray(cursor), 'deflate'))];
 }
 const flag = payload[cursor++];
 if (![0, 1].includes(flag) || payload[cursor++] !== 0) return null;
 // iTXt stores language and translated keyword before the text.
 for (let i = 0; i < 2; i++) {
  const end = payload.indexOf(0, cursor);
  if (end < 0) return null;
  cursor = end + 1;
 }
 const text = payload.subarray(cursor);
 return [key, utf8(flag ? await inflate(text, 'deflate') : text)];
}

async function scanPng(file) {
 if (!(file instanceof Blob) || file.size > FILE_LIMIT) throw new Error('请选择不超过 32 MiB 的 NovelAI PNG 原图');
 const bytes = new Uint8Array(await file.arrayBuffer());
 if (bytes.length < 33 || !PNG_MAGIC.every((v, i) => bytes[i] === v)) throw new Error('此文件不是有效的 PNG');
 const view = new DataView(bytes.buffer);
 const fields = new Map();
 let w = 0, h = 0, alpha8 = false, ended = false, textSize = 0, textChunks = 0, decodedSize = 0;
 for (let offset = PNG_MAGIC.length; offset + 12 <= bytes.length;) {
  const size = view.getUint32(offset);
  const type = utf8(bytes.subarray(offset + 4, offset + 8));
  const start = offset + 8, next = start + size + 4;
  if (next > bytes.length) throw new Error('PNG 数据不完整');
  if (offset === PNG_MAGIC.length) {
   if (type !== 'IHDR' || size !== 13) throw new Error('PNG 缺少有效头部');
   w = view.getUint32(start);
   h = view.getUint32(start + 4);
   alpha8 = bytes[start + 8] === 8 && [4, 6].includes(bytes[start + 9]);
  }
  if (type === 'IEND') {
   ended = size === 0;
   break;
  }
  if (['tEXt', 'zTXt', 'iTXt'].includes(type)) {
   textSize += size;
   if (++textChunks > 512 || textSize > TEXT_LIMIT) throw new Error('PNG 文本块过大');
   const pair = await textChunk(type, bytes.subarray(start, start + size)).catch(() => null);
   if (pair) {
    const [key, value] = pair;
    decodedSize += value.length - (fields.get(key)?.length || 0);
    if (decodedSize > TEXT_LIMIT) throw new Error('PNG 元数据过大');
    fields.set(key, value);
   }
  }
  offset = next;
 }
 if (!w || !h || !ended) throw new Error('PNG 数据不完整');
 return {fields, w, h, alpha8};
}

async function alphaMetadata(file, image) {
 const {w, h, alpha8} = image;
 if (!alpha8 || w * h > MAX_PIXELS || w * h < 160 || typeof createImageBitmap !== 'function') return new Map();
 const pixels = await createImageBitmap(file);
 try {
  const canvas = typeof OffscreenCanvas === 'function' ? new OffscreenCanvas(w, h) : document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', {willReadFrequently: true});
  if (!ctx) return new Map();
  ctx.drawImage(pixels, 0, 0);
  const rgba = ctx.getImageData(0, 0, w, h).data;
  const read = (byteOffset, length) => {
   const result = new Uint8Array(length);
   for (let i = 0; i < length * 8; i++) {
    const bitOffset = byteOffset * 8 + i;
    const pos = (bitOffset % h) * w + Math.floor(bitOffset / h);
    result[i >>> 3] = (result[i >>> 3] << 1) | (rgba[pos * 4 + 3] & 1);
   }
   return result;
  };
  const header = read(0, 19);
  const magic = utf8(header.subarray(0, 15));
  if (!['stealth_pngcomp', 'stealth_pnginfo'].includes(magic)) return new Map();
  const bits = new DataView(header.buffer).getUint32(15);
  const size = bits / 8;
  if (bits % 8 || size < 1 || size > TEXT_LIMIT || 19 + size > Math.floor(w * h / 8)) return new Map();
  const bytes = read(19, size);
  const text = utf8(magic === 'stealth_pngcomp' ? await inflate(bytes, 'gzip') : bytes);
  return new Map(Object.entries(parseObject(text)));
 } finally {
  pixels.close?.();
 }
}

function coordinate(value) {
 const {x, y} = object(value);
 return Number.isFinite(x) && x >= 0 && x <= 1 && Number.isFinite(y) && y >= 0 && y <= 1
  ? {x, y}
  : {x: 0.5, y: 0.5};
}

function sourceInfo(raw, fields) {
 const candidates = [raw.model, fields.get('Source'), raw.source].filter(v => typeof v === 'string' && v.trim());
 let fallback = {source:candidates[0] || '', profile:'', unsupportedModel:false};
 for (const source of candidates) {
  const slug = source.toLowerCase().trim();
  const version = slug.match(/(?:nai-diffusion-|novelai diffusion v?)(4[.-]5|[0-9]+)(?![0-9.])/)?.[1];
  if (!version) continue;
  const flavor = slug.match(/\b(full|curated)\b/)?.[1];
  const stamp = slug.match(/\b[a-f0-9]{8}\b/)?.[0];
  const known = SOURCE_MODELS[version + ':' + stamp];
  const profile = flavor === 'full' && ['4', '5'].includes(version) ? 'nai'+version+'full' : (flavor ? '' : known);
  if (profile && profile !== 'curated') return {source, profile, unsupportedModel:false};
  fallback = {source, profile:'', unsupportedModel:true};
  if (flavor || known || !['4','5'].includes(version)) return fallback;
 }
 return fallback;
}

function decodeMetadata(fields, image, location) {
 const raw = parseObject(fields.get('Comment'));
 const info = sourceInfo(raw, fields);
 const novel = /novelai|nai-diffusion/i.test(info.source + ' ' + String(fields.get('Software') || ''));
 const pos = object(raw.v4_prompt);
 const neg = object(raw.v4_negative_prompt);
 const base = pos.caption?.base_caption ?? raw.prompt ?? fields.get('Description');
 if (!novel || typeof base !== 'string' || !base.trim()) return null;
 const roleSources = Array.isArray(pos.caption?.char_captions) ? pos.caption.char_captions : [];
 const negatives = Array.isArray(neg.caption?.char_captions) ? neg.caption.char_captions : [];
 const fallback = Array.isArray(raw.characterPrompts) ? raw.characterPrompts : [];
 const slots = roleSources.length ? roleSources : fallback;
 if (slots.length > 22) throw new Error('原图角色分区超过当前工坊可读取的数量');
 const characters = slots.flatMap((r, index) => {
  r = object(r);
  const prompt = r.char_caption ?? r.prompt;
  if (r.enabled === false || typeof prompt !== 'string' || !prompt.trim()) return [];
  return [{
   id: 'png-' + (index + 1),
   prompt,
   negative: String(negatives[index]?.char_caption ?? fallback[index]?.uc ?? r.uc ?? ''),
   center: coordinate(r.centers?.[0] ?? r.center ?? fallback[index]?.center)
  }];
 });
 const parameters = {width: image.w, height: image.h};
 for (const k of ['steps', 'scale', 'seed']) if (Number.isFinite(raw[k])) parameters[k] = raw[k];
 if (typeof raw.sampler === 'string' && raw.sampler.length < 80) parameters.sampler = raw.sampler;
 return {
  ...info, location, base, negative: String(neg.caption?.base_caption ?? raw.uc ?? raw.negative_prompt ?? ''),
  characters, useCoords: typeof pos.use_coords === 'boolean' ? pos.use_coords : characters.length > 1,
  parameters
 };
}

/** Only restores values saved in an original PNG. All reads are local. */
export async function readNovelAIPng(file) {
 const image = await scanPng(file);
 const standard = decodeMetadata(image.fields, image, 'text');
 if (standard) return standard;
 const hidden = await alphaMetadata(file, image).catch(() => new Map());
 const restored = decodeMetadata(new Map([...image.fields, ...hidden]), image, 'alpha');
 if (!restored) throw new Error('这张 PNG 没有可恢复的 NovelAI 提示词。请使用保留生成信息的原图。');
 return restored;
}
