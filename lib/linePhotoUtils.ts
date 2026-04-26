export async function fetchLineImage(
  messageId: string,
  token: string
): Promise<{ binary: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(
      `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    const binary = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    return { binary, contentType };
  } catch {
    return null;
  }
}

export async function replyToLine(
  token: string,
  replyToken: string,
  messages: object[]
): Promise<void> {
  const res = await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ replyToken, messages }),
  });
  if (!res.ok) {
    console.error("LINE reply error:", await res.text());
  }
}
