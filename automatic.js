import { suggestCharacterIds } from './scene_extractor.js';
import { hashScene } from './director.js';

export function automaticBinding(ctx) {
  const message = ctx.context?.chat?.[ctx.index];
  return {
    chatId: ctx.id,
    messageIndex: ctx.index,
    sourceHash: hashScene(ctx.text),
    swipeId: message?.swipe_id ?? 0,
  };
}

export function automaticImageId({chatId, messageIndex, sourceHash, swipeId}) {
  return `auto_${hashScene(chatId)}_${messageIndex}_${swipeId ?? 0}_${sourceHash}`;
}

export function automaticCandidates(story, characters) {
  const named = suggestCharacterIds(story, characters);
  const inStory = characters
    .filter(character => named.includes(character.character_id))
    .sort((a, b) => story.lastIndexOf(b.name) - story.lastIndexOf(a.name))
    .map(character => character.character_id);
  const active = characters.filter(character => character.active).map(character => character.character_id);
  return [...new Set([...inStory, ...active])].slice(0, 22);
}

export function listenForNewReplies(host, getInfo, { enabled, ready, chatChanged }) {
  const source = host?.eventSource;
  const events = host?.eventTypes ?? host?.event_types;
  if (!source?.on || !events?.GENERATION_STARTED || !events?.CHARACTER_MESSAGE_RENDERED) return null;
  let origin = null, generating = false;
  const on = (name, handler) => {
    if (!events[name]) return () => {};
    const event = events[name];
    source.on(event, handler);
    return () => (source.off ?? source.removeListener)?.call(source, event, handler);
  };
  const reset = () => { origin = null; };
  const stop = () => { generating = false; reset(); };
  const unsubscribe = [
    on('GENERATION_STARTED', (type, _options, dryRun) => {
      if (dryRun || type === 'quiet') return;
      generating = true;
      const ctx = getInfo();
      origin = type === 'normal' && enabled() && ctx.id && Array.isArray(ctx.context?.chat)
        ? {chatId: ctx.id, nextIndex: ctx.context.chat.length} : null;
    }),
    on('CHARACTER_MESSAGE_RENDERED', (index, type) => {
      if (!origin || type !== 'normal' || !Number.isInteger(index) || index < origin.nextIndex) return;
      const ctx = getInfo();
      const start = origin;
      stop();
      if (enabled() && ctx.id === start.chatId && ctx.index === index) ready(ctx);
    }),
    // Streaming completion may hide the stop button before it renders the final message.
    on('GENERATION_ENDED', () => { generating = false; }),
    on('GENERATION_STOPPED', stop),
    on('CHAT_CHANGED', () => { stop(); chatChanged(); }),
  ];
  return { reset, generating: () => generating, disconnect: () => unsubscribe.forEach(remove => remove()) };
}
