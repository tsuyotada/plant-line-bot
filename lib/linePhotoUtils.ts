export async function fetchLineImage(
  messageId: string,
  token: string
): Promise<{ binary: ArrayBuffer; contentType: string } | null> {
  try {
    const res = await fetch(
      `https://api-data.line.me/v2/bot/message/${messageId}/content`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) {
      const errBody = await res.text().catch(() => "(body読み取り失敗)");
      console.error(`[LINE] 画像取得失敗 messageId=${messageId} status=${res.status} body=${errBody}`);
      return null;
    }
    const binary = await res.arrayBuffer();
    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    console.log(`[LINE] 画像取得成功 messageId=${messageId} contentType=${contentType} size=${binary.byteLength}bytes`);
    return { binary, contentType };
  } catch (err) {
    console.error(`[LINE] 画像取得例外 messageId=${messageId}`, err);
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

export async function pushToLine(
  token: string,
  lineUserId: string,
  messages: object[]
): Promise<void> {
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ to: lineUserId, messages }),
  });
  if (!res.ok) {
    console.error("LINE push error:", await res.text());
  }
}
