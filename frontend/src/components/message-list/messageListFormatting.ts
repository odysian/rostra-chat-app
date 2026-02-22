import type { Message } from "../../types";

export interface SystemMessage {
  id: string;
  type: "system";
  content: string;
  timestamp: number;
}

export type ChatItem = Message | SystemMessage;

export function normalizeToUtcIso(isoString: string): string {
  const hasTimezoneSuffix = /(?:Z|[+-]\d{2}:\d{2})$/i.test(isoString);
  return hasTimezoneSuffix ? isoString : `${isoString}Z`;
}

export function parseTimestamp(isoString: string | null | undefined): number | null {
  if (!isoString) return null;
  const timestamp = Date.parse(normalizeToUtcIso(isoString));
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function isStrictlyNewerThan(
  candidate: Message,
  reference: Message,
): boolean {
  const candidateTime = parseTimestamp(candidate.created_at);
  const referenceTime = parseTimestamp(reference.created_at);

  if (
    candidateTime != null &&
    referenceTime != null &&
    candidateTime !== referenceTime
  ) {
    return candidateTime > referenceTime;
  }

  if (candidateTime != null && referenceTime == null) return true;
  if (candidateTime == null && referenceTime != null) return false;

  return candidate.id > reference.id;
}

export function findFirstUnreadMessageId(
  items: ChatItem[],
  snapshot: string | null | undefined,
  currentUserId: number | null | undefined,
): number | null {
  const snapshotTimestamp = parseTimestamp(snapshot);
  if (snapshotTimestamp == null) return null;

  const unreadMessage = items.find((item) => {
    if ("type" in item && item.type === "system") return false;
    if (currentUserId != null && (item as Message).user_id === currentUserId) {
      return false;
    }
    const messageTimestamp = parseTimestamp((item as Message).created_at);
    return messageTimestamp != null && messageTimestamp > snapshotTimestamp;
  });

  if (!unreadMessage || ("type" in unreadMessage && unreadMessage.type === "system")) {
    return null;
  }

  return (unreadMessage as Message).id;
}

export function getMessageTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function getFullDateTime(isoString: string): string {
  const date = new Date(isoString);
  const longDate = date.toLocaleDateString([], {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  const time = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });
  return `${longDate}\n${time}`;
}

export function getDateLabel(isoString: string): string {
  const date = new Date(normalizeToUtcIso(isoString));
  const now = new Date();

  if (date.toDateString() === now.toDateString()) return "TODAY";

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "YESTERDAY";

  return date
    .toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })
    .toUpperCase();
}

export function shouldShowDateDivider(
  current: ChatItem,
  prev: ChatItem | undefined,
): boolean {
  if (!prev) return true;
  if ("type" in current && current.type === "system") return false;
  if ("type" in prev && prev.type === "system") return false;

  const currMsg = current as Message;
  const prevMsg = prev as Message;
  const currDate = new Date(normalizeToUtcIso(currMsg.created_at));
  const prevDate = new Date(normalizeToUtcIso(prevMsg.created_at));

  return currDate.toDateString() !== prevDate.toDateString();
}

export function shouldGroupMessage(
  current: ChatItem,
  prev: ChatItem | undefined,
): boolean {
  if (!prev) return false;
  if ("type" in current && current.type === "system") return false;
  if ("type" in prev && prev.type === "system") return false;

  const currMsg = current as Message;
  const prevMsg = prev as Message;

  if (currMsg.username !== prevMsg.username) return false;

  const currTime = new Date(currMsg.created_at).getTime();
  const prevTime = new Date(prevMsg.created_at).getTime();

  return currTime - prevTime < 5 * 60 * 1000;
}

export function capturePrependAnchor(
  container: HTMLDivElement,
): { anchorMessageId: number | null; anchorTop: number | null } {
  const containerTop = container.getBoundingClientRect().top;
  const messageElements = Array.from(
    container.querySelectorAll<HTMLElement>("[data-chat-message='true'][data-message-id]"),
  );

  const anchorElement =
    messageElements.find(
      (el) => el.getBoundingClientRect().bottom >= containerTop,
    ) ?? messageElements[0];

  if (!anchorElement) {
    return { anchorMessageId: null, anchorTop: null };
  }

  const rawId = anchorElement.dataset.messageId;
  const parsedId = rawId ? Number(rawId) : Number.NaN;
  if (!Number.isFinite(parsedId)) {
    return { anchorMessageId: null, anchorTop: null };
  }

  return {
    anchorMessageId: parsedId,
    anchorTop: anchorElement.getBoundingClientRect().top,
  };
}
