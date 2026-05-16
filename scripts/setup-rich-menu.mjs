/**
 * Plant Care — LINE Rich Menu Setup
 *
 * 3パネルのリッチメニュー（写真を追加 / 相談する / ガーデンを見る）を作成し、
 * 全ユーザーのデフォルトとして設定します。
 *
 * 実行方法:
 *   npm run setup-richmenu
 *
 * 必要な環境変数 (.env.local):
 *   LINE_CHANNEL_ACCESS_TOKEN  — Messaging API チャンネルのトークン
 *
 * カスタム画像を使う場合:
 *   scripts/assets/rich-menu.png を配置すると自動生成をスキップします。
 *   推奨サイズ: 2500×843px (PNG)
 */

import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ── 本番URL（LINE URI アクションは https:// のみ対応） ───────────────────────
const PRODUCTION_URL = 'https://plant-line-bot-forme.vercel.app';

// ── .env.local を読み込む ────────────────────────────────────────────────────
const envPath = join(ROOT, '.env.local');
if (!existsSync(envPath)) {
  console.error('❌ .env.local が見つかりません。');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#'))
    .map(l => {
      const idx = l.indexOf('=');
      if (idx === -1) return null;
      const key = l.slice(0, idx).trim();
      const val = l.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      return [key, val];
    })
    .filter(Boolean)
);

const TOKEN = env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('❌ LINE_CHANNEL_ACCESS_TOKEN が .env.local に設定されていません。');
  process.exit(1);
}

const appUrl = env.NEXT_PUBLIC_APP_URL ?? '';
const GARDEN_URL = appUrl.startsWith('https://') ? appUrl : PRODUCTION_URL;
console.log(`📡 ガーデンURL: ${GARDEN_URL}\n`);

// ── リッチメニュー定義 ────────────────────────────────────────────────────────
// Panel 1, 2: postback action（webhook で専用ハンドラが処理）
// Panel 3:    uri action（Webアプリへ遷移）
const RICH_MENU = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: 'Plant Care メインメニュー',
  chatBarText: 'メニューを開く',
  areas: [
    {
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: {
        type: 'postback',
        label: '写真を追加',
        data: 'action=add_photo',
        displayText: '📸 写真を追加',
      },
    },
    {
      bounds: { x: 833, y: 0, width: 834, height: 843 },
      action: {
        type: 'postback',
        label: '相談する',
        data: 'action=start_consultation',
        displayText: '💬 相談する',
      },
    },
    {
      bounds: { x: 1667, y: 0, width: 833, height: 843 },
      action: {
        type: 'uri',
        label: 'ガーデンを見る',
        uri: GARDEN_URL,
      },
    },
  ],
};

// ── SVG 画像 ─────────────────────────────────────────────────────────────────
// アイコンはすべて ~220×175px の同一バウンディングボックスに統一
// 各パネル中央 x: 416, 1249, 2082
// アイコン中心 y: ~295, テキスト baseline y: 500 / 608
const MENU_SVG = `
<svg width="2500" height="843" xmlns="http://www.w3.org/2000/svg">

  <!-- Background -->
  <rect width="2500" height="843" fill="#1a3320"/>

  <!-- Center panel subtle highlight -->
  <rect x="833" y="0" width="834" height="843" fill="rgba(255,255,255,0.035)"/>

  <!-- Divider lines -->
  <line x1="833"  y1="50" x2="833"  y2="793" stroke="rgba(255,255,255,0.13)" stroke-width="2"/>
  <line x1="1667" y1="50" x2="1667" y2="793" stroke="rgba(255,255,255,0.13)" stroke-width="2"/>

  <!-- ══ Panel 1: Camera icon (center x=416, icon bbox y=210-385) ══ -->
  <!-- Body: 220×165 -->
  <rect x="306" y="213" width="220" height="165" rx="20"
        fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="10"/>
  <!-- Viewfinder bump -->
  <rect x="350" y="193" width="70" height="22" rx="10"
        fill="rgba(255,255,255,0.85)"/>
  <!-- Lens outer r=50 -->
  <circle cx="416" cy="296" r="50"
          fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="10"/>
  <!-- Lens inner -->
  <circle cx="416" cy="296" r="20" fill="rgba(255,255,255,0.35)"/>

  <text x="416" y="500"
        text-anchor="middle" fill="rgba(255,255,255,0.96)"
        font-size="82" font-weight="700"
        font-family="'Yu Gothic','Hiragino Sans','Meiryo',sans-serif">写真を追加</text>
  <text x="416" y="608"
        text-anchor="middle" fill="rgba(255,255,255,0.40)"
        font-size="48"
        font-family="'Yu Gothic','Hiragino Sans','Meiryo',sans-serif">今日の様子をそのまま送る</text>

  <!-- ══ Panel 2: Chat bubble icon (center x=1249, icon bbox y=210-385) ══ -->
  <!-- Body: 220×155 -->
  <rect x="1139" y="213" width="220" height="155" rx="26"
        fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="10"/>
  <!-- Tail -->
  <path d="M1175,368 L1148,418 L1228,368" fill="rgba(255,255,255,0.85)"/>
  <!-- Dots at y=291 -->
  <circle cx="1193" cy="291" r="16" fill="rgba(255,255,255,0.85)"/>
  <circle cx="1249" cy="291" r="16" fill="rgba(255,255,255,0.85)"/>
  <circle cx="1305" cy="291" r="16" fill="rgba(255,255,255,0.85)"/>

  <text x="1249" y="500"
        text-anchor="middle" fill="rgba(255,255,255,0.96)"
        font-size="82" font-weight="700"
        font-family="'Yu Gothic','Hiragino Sans','Meiryo',sans-serif">相談する</text>
  <text x="1249" y="608"
        text-anchor="middle" fill="rgba(255,255,255,0.40)"
        font-size="48"
        font-family="'Yu Gothic','Hiragino Sans','Meiryo',sans-serif">気になることをひとこと</text>

  <!-- ══ Panel 3: Leaf icon (center x=2082, icon bbox y=210-385) ══ -->
  <!-- Leaf: width ~220px, height ~178px -->
  <!-- Top (2082,213) → widest at y=296 (±110px) → bottom (2082,388) -->
  <path d="M2082,213
           C2082,213 1972,255 1972,300
           C1972,345 2082,388 2082,388
           C2082,388 2192,345 2192,300
           C2192,255 2082,213 2082,213 Z"
        fill="none" stroke="rgba(255,255,255,0.85)" stroke-width="10"/>
  <!-- Midrib -->
  <path d="M2082,223 Q2082,310 2082,388"
        fill="none" stroke="rgba(255,255,255,0.25)" stroke-width="6"/>
  <!-- Stem -->
  <line x1="2082" y1="388" x2="2082" y2="430"
        stroke="rgba(255,255,255,0.85)" stroke-width="10" stroke-linecap="round"/>

  <text x="2082" y="500"
        text-anchor="middle" fill="rgba(255,255,255,0.96)"
        font-size="82" font-weight="700"
        font-family="'Yu Gothic','Hiragino Sans','Meiryo',sans-serif">ガーデンを見る</text>
  <text x="2082" y="608"
        text-anchor="middle" fill="rgba(255,255,255,0.40)"
        font-size="48"
        font-family="'Yu Gothic','Hiragino Sans','Meiryo',sans-serif">Webアプリで記録を確認</text>

</svg>
`;

// ── 画像生成 ─────────────────────────────────────────────────────────────────
const CUSTOM_IMAGE = join(__dirname, 'assets', 'rich-menu.png');

async function generateImage() {
  if (existsSync(CUSTOM_IMAGE)) {
    console.log('📁 scripts/assets/rich-menu.png を使用します');
    return readFileSync(CUSTOM_IMAGE);
  }
  console.log('🎨 リッチメニュー画像を生成中...');
  const { default: sharp } = await import('sharp');
  const png = await sharp(Buffer.from(MENU_SVG.trim())).png().toBuffer();
  mkdirSync(join(__dirname, 'assets'), { recursive: true });
  writeFileSync(CUSTOM_IMAGE, png);
  console.log('   → scripts/assets/rich-menu.png に保存しました');
  return png;
}

// ── LINE Messaging API ────────────────────────────────────────────────────────
const LINE_API = 'https://api.line.me';
const LINE_DATA_API = 'https://api-data.line.me';
const AUTH = { Authorization: `Bearer ${TOKEN}` };

async function getDefaultRichMenuId() {
  const res = await fetch(`${LINE_API}/v2/bot/user/all/richmenu`, { headers: AUTH });
  if (!res.ok) return null;
  const json = await res.json();
  return json.richMenuId ?? null;
}

async function deleteRichMenu(richMenuId) {
  await fetch(`${LINE_API}/v2/bot/user/all/richmenu`, { method: 'DELETE', headers: AUTH });
  await fetch(`${LINE_API}/v2/bot/richmenu/${richMenuId}`, { method: 'DELETE', headers: AUTH });
}

async function createRichMenu() {
  const res = await fetch(`${LINE_API}/v2/bot/richmenu`, {
    method: 'POST',
    headers: { ...AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(RICH_MENU),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`作成失敗: ${JSON.stringify(json)}`);
  return json.richMenuId;
}

async function uploadImage(richMenuId, imageBuffer) {
  const res = await fetch(`${LINE_DATA_API}/v2/bot/richmenu/${richMenuId}/content`, {
    method: 'POST',
    headers: { ...AUTH, 'Content-Type': 'image/png' },
    body: imageBuffer,
  });
  if (!res.ok) throw new Error(`画像アップロード失敗: ${await res.text()}`);
}

async function setDefault(richMenuId) {
  const res = await fetch(`${LINE_API}/v2/bot/user/all/richmenu/${richMenuId}`, {
    method: 'POST',
    headers: AUTH,
  });
  if (!res.ok) throw new Error(`デフォルト設定失敗: ${await res.text()}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('🌿 Plant Care リッチメニューのセットアップを開始します...\n');

try {
  // 0. 既存デフォルトを削除
  const existingId = await getDefaultRichMenuId();
  if (existingId) {
    console.log(`🗑  既存リッチメニューを削除中... (${existingId})`);
    await deleteRichMenu(existingId);
    console.log('✓ 削除完了\n');
  }

  // 1. 画像生成
  const imageBuffer = await generateImage();
  console.log(`✓ 画像: ${(imageBuffer.length / 1024).toFixed(0)} KB\n`);

  // 2. 作成
  console.log('① リッチメニューを作成中...');
  const richMenuId = await createRichMenu();
  console.log(`✓ richMenuId: ${richMenuId}\n`);

  // 3. 画像アップロード
  console.log('② 画像をアップロード中...');
  await uploadImage(richMenuId, imageBuffer);
  console.log('✓ 完了\n');

  // 4. デフォルト設定
  console.log('③ デフォルトに設定中...');
  await setDefault(richMenuId);
  console.log('✓ 完了\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ セットアップ完了！');
  console.log(`   richMenuId: ${richMenuId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📱 確認手順:');
  console.log('   1. スマホの LINE アプリを開く');
  console.log('   2. Plant Care Bot のトーク画面を開く');
  console.log('   3. 下部に 3つのメニューが表示されることを確認');
  console.log('   4. 「写真を追加」「相談する」をタップして応答を確認\n');
} catch (err) {
  console.error('\n❌ エラー:', err.message);
  process.exit(1);
}
