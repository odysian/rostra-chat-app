import type { MessageReactionSummary, ReactionEmoji } from "../../types";

export const REACTION_ALLOWLIST: ReactionEmoji[] = [
  "👍",
  "👎",
  "❤️",
  "😂",
  "🔥",
  "👀",
  "🎉",
];

const reactionOrder = new Map(
  REACTION_ALLOWLIST.map((emoji, index) => [emoji, index]),
);

export function sortReactions(
  reactions: MessageReactionSummary[],
): MessageReactionSummary[] {
  return [...reactions].sort((left, right) => {
    if (left.count !== right.count) {
      return right.count - left.count;
    }
    const leftOrder = reactionOrder.get(left.emoji) ?? REACTION_ALLOWLIST.length;
    const rightOrder = reactionOrder.get(right.emoji) ?? REACTION_ALLOWLIST.length;
    return leftOrder - rightOrder;
  });
}
