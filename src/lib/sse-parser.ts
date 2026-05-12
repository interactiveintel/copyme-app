// Pure SSE frame parser (A5).
//
// Extracted from useMessageStream so it can be unit-tested without React.

export interface SseFrameContext {
  current: string | null;
}

export function handleFrame<E>(
  frame: string,
  onEvent: (ev: E) => void,
  lastIdRef: SseFrameContext,
): void {
  if (!frame || frame.startsWith(":")) return;

  let eventType = "message";
  const dataLines: string[] = [];
  let eventId: string | null = null;

  for (const line of frame.split("\n")) {
    if (line.startsWith(":")) continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    const field = line.slice(0, colon);
    let value = line.slice(colon + 1);
    if (value.startsWith(" ")) value = value.slice(1);
    switch (field) {
      case "id":
        eventId = value;
        break;
      case "event":
        eventType = value;
        break;
      case "data":
        dataLines.push(value);
        break;
    }
  }

  if (eventType === "bye") return;

  const data = dataLines.join("\n");
  if (!data) return;
  if (eventId) lastIdRef.current = eventId;

  try {
    const ev = JSON.parse(data) as E;
    onEvent(ev);
  } catch {
    /* malformed frame — drop */
  }
}
