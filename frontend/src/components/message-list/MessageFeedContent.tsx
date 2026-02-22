import type { Message } from "../../types";
import {
  getDateLabel,
  getFullDateTime,
  getMessageTime,
  normalizeToUtcIso,
  shouldGroupMessage,
  shouldShowDateDivider,
  type ChatItem,
} from "./messageListFormatting";
import { MessageRow } from "./MessageRow";

interface MessageFeedContentProps {
  messages: ChatItem[];
  density: "compact" | "comfortable";
  theme: "neon" | "amber";
  newMessagesAnchorId: number | null;
  highlightedMessageId: number | null;
}

export function MessageFeedContent({
  messages,
  density,
  theme,
  newMessagesAnchorId,
  highlightedMessageId,
}: MessageFeedContentProps) {
  const isComfortableDensity = density === "comfortable";

  return (
    <>
      {messages.map((item, index) => {
        if ("type" in item && item.type === "system") {
          return (
            <div
              key={item.id}
              className="flex justify-center my-4 opacity-75 px-4"
            >
              <span
                className="font-pixel text-[8px] tracking-[0.14em] px-3 py-1"
                style={{
                  color: "var(--color-meta)",
                  border: "1px solid var(--border-dim)",
                }}
              >
                {item.content}
              </span>
            </div>
          );
        }

        const message = item as Message;
        const isoDate = normalizeToUtcIso(message.created_at);
        const isGrouped = shouldGroupMessage(item, messages[index - 1]);
        const showDateDivider = shouldShowDateDivider(item, messages[index - 1]);
        const headerTime = getMessageTime(isoDate);
        const hoverTime = new Date(isoDate).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        });
        const fullDateTime = getFullDateTime(isoDate);

        return (
          <div key={message.id}>
            {newMessagesAnchorId === message.id && (
              <div
                className={`flex items-center ${isComfortableDensity ? "gap-3 my-6" : "gap-2.5 my-5"}`}
              >
                <div
                  className="flex-1 h-px"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, var(--color-secondary))",
                  }}
                />
                <span
                  className="font-pixel text-[8px] tracking-[0.16em] px-2 py-1"
                  style={{
                    color: "var(--color-secondary)",
                    border: "1px solid var(--color-secondary)",
                  }}
                >
                  NEW MESSAGES
                </span>
                <div
                  className="flex-1 h-px"
                  style={{
                    background:
                      "linear-gradient(270deg, transparent, var(--color-secondary))",
                  }}
                />
              </div>
            )}

            {showDateDivider && (
              <div
                className={`flex items-center ${isComfortableDensity ? "gap-3 my-6" : "gap-2.5 my-5"}`}
              >
                <div
                  className="flex-1 h-px"
                  style={{
                    background:
                      "linear-gradient(90deg, transparent, var(--border-dim))",
                  }}
                />
                <span
                  className="font-pixel text-[8px] tracking-[0.16em]"
                  style={{ color: "var(--color-text)" }}
                >
                  {getDateLabel(isoDate)}
                </span>
                <div
                  className="flex-1 h-px"
                  style={{
                    background:
                      "linear-gradient(270deg, transparent, var(--border-dim))",
                  }}
                />
              </div>
            )}

            <MessageRow
              message={message}
              isGrouped={isGrouped}
              isComfortableDensity={isComfortableDensity}
              theme={theme}
              isHighlighted={highlightedMessageId === message.id}
              headerTime={headerTime}
              hoverTime={hoverTime}
              fullDateTime={fullDateTime}
            />
          </div>
        );
      })}
    </>
  );
}
