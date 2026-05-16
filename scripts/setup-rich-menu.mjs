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
 *   NEXT_PUBLIC_APP_URL        — 本番URL（省略時は PRODUCTION_URL を使用）
 *
 * 既存リッチメニューを削除してからやり直す場合:
 *   curl -X DELETE https://api.line.me/v2/bot/richmenu/{richMenuId} \
 *     -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN"
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

// ── 本番URL（ガーデンを見るボタンの遷移先） ──────────────────────────────────
// LINE の URI アクションは https:// のみ対応（localhost 不可）
const PRODUCTION_URL = 'https://plant-line-bot-forme.vercel.app';

// ── .env.local を読み込む ────────────────────────────────────────────────────
const envPath = join(ROOT, '.env.local');
if (!existsSync(envPath)) {
  console.error('❌ .env.local が見つかりません。プロジェクトルートに配置してください。');
  process.exit(1);
}

const env = Object.fromEntries(
  readFileSync(envPath, 'utf-8')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line && !line.startsWith('#'))
    .map(line => {
      const idx = line.indexOf('=');
      if (idx === -1) return null;
      const key = line.slice(0, idx).trim();
      const val = line.slice(idx + 1).trim().replace(/^['"]|['"]$/g, '');
      return [key, val];
    })
    .filter(Boolean)
);

const TOKEN = env.LINE_CHANNEL_ACCESS_TOKEN;
if (!TOKEN) {
  console.error('❌ LINE_CHANNEL_ACCESS_TOKEN が .env.local に設定されていません。');
  console.error('   LINE Developers Console > Messaging API チャンネル > チャンネルアクセストークン を確認してください。');
  process.exit(1);
}

// localhost なら本番URLにフォールバック
const appUrl = env.NEXT_PUBLIC_APP_URL ?? '';
const GARDEN_URL = appUrl.startsWith('https://') ? appUrl : PRODUCTION_URL;

console.log(`📡 接続先ガーデンURL: ${GARDEN_URL}\n`);

// ── リッチメニュー定義 ────────────────────────────────────────────────────────
const RICH_MENU = {
  size: { width: 2500, height: 843 },
  selected: true,
  name: 'Plant Care メインメニュー',
  chatBarText: 'メニューを開く',
  areas: [
    {
      // Panel 1: 写真を追加（左）
      bounds: { x: 0, y: 0, width: 833, height: 843 },
      action: {
        type: 'message',
        label: '写真を追加',
        text: '📸 写真の追加方法を教えて',
      },
    },
    {
      // Panel 2: 相談する（中央）
      bounds: { x: 833, y: 0, width: 834, height: 843 },
      action: {
        type: 'message',
        label: '相談する',
        text: '💬 植物について相談したい',
      },
    },
    {
      // Panel 3: ガーデンを見る（右）
      bounds: { x: 1667, y: 0, width: 833, height: 843 },
      action: {
        type: 'uri',
        label: 'ガーデンを見る',
        uri: GARDEN_URL,
      },
    },
  ],
};

// ── 画像生成 ─────────────────────────────────────────────────────────────────
const CUSTOM_IMAGE = join(__dirname, 'assets', 'rich-menu.png');

const MENU_SVG = `
<svg width="2500" height="843" xmlns="http://www.w3.org/2000/svg">
  <!-- Background: Plant Care deep green -->
  <rect width="2500" height="843" fill="#1a3320"/>

  <!-- Panel 2 subtle highlight (center) -->
  <rect x="833" y="0" width="834" height="843" fill="rgba(255,255,255,0.04)"/>

  <!-- Divider lines -->
  <line x1="833"  y1="48" x2="833"  y2="795" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>
  <line x1="1667" y1="48" x2="1667" y2="795" stroke="rgba(255,255,255,0.14)" stroke-width="2"/>

  <!-- ── Panel 1: Camera icon ── -->
  <!-- Body -->
  <rect x="306" y="200" width="220" height="165" rx="22"
        fill="none" stroke="rgba(255,255,255,0.82)" stroke-width="10"/>
  <!-- Viewfinder bump -->
  <rect x="346" y="180" width="78" height="26" rx="10"
        fill="rgba(255,255,255,0.82)"/>
  <!-- Lens outer -->
  <circle cx="416" cy="283" r="50"
          fill="none" stroke="rgba(255,255,255,0.82)" stroke-width="10"/>
  <!-- Lens inner -->
  <circle cx="416" cy="283" r="20" fill="rgba(255,255,255,0.35)"/>

  <text x="416" y="458"
        text-anchor="middle"
        fill="rgba(255,255,255,0.96)"
        font-size="84" font-weight="700"
        font-family="'Yu Gothic','Hiragino Sans','Meiryo',sans-serif">写真を追加</text>
  <text x="416" y="568"
        text-anchor="middle"
        fill="rgba(255,255,255,0.40)"
        font-size="48"
        font-family="'Yu Gothic','Hiragino Sans','Meiryo',sans-serif">今日の様子をそのまま送る</text>

  <!-- ── Panel 2: Chat bubble icon ── -->
  <rect x="1039" y="182" width="420" height="228" rx="38"
        fill="none" stroke="rgba(255,255,255,0.82)" stroke-width="10"/>
  <!-- Tail -->
  <path d="M1155,410 L1125,468 L1215,410" fill="rgba(255,255,255,0.82)"/>
  <!-- Dots -->
  <circle cx="1179" cy="296" r="19" fill="rgba(255,255,255,0.82)"/>
  <circle cx="1249" cy="296" r="19" fill="rgba(255,255,255,0.82)"/>
  <circle cx="1319" cy="296" r="19" fill="rgba(255,255,255,0.82)"/>

  <text x="1249" y="570"
        text-anchor="middle"
        fill="rgba(255,255,255,0.96)"
        font-size="84" font-weight="700"
        font-family="'Yu Gothic','Hiragino Sans','Meiryo',sans-serif">相談する</text>
  <text x="1249" y="680"
        text-anchor="middle"
        fill="rgba(255,255,255,0.40)"
        font-size="48"
        font-family="'Yu Gothic','Hiragino Sans','Meiryo',sans-serif">気になることをひとこと</text>

  <!-- ── Panel 3: Leaf icon ── -->
  <path d="M2082,168
           C2082,168 1895,252 1915,398
           C1935,544 2082,535 2082,535
           C2082,535 2229,544 2249,398
           C2269,252 2082,168 2082,168 Z"
        fill="none" stroke="rgba(255,255,255,0.82)" stroke-width="10"/>
  <!-- Midrib (center vein) -->
  <line x1="2082" y1="178" x2="2082" y2="535"
        stroke="rgba(255,255,255,0.22)" stroke-width="6"/>
  <!-- Stem -->
  <line x1="2082" y1="535" x2="2082" y2="622"
        stroke="rgba(255,255,255,0.82)" stroke-width="10" stroke-linecap="round"/>

  <text x="2082" y="708"
        text-anchor="middle"
        fill="rgba(255,255,255,0.96)"
        font-size="84" font-weight="700"
        font-family="'Yu Gothic','Hiragino Sans','Meiryo',sans-serif">ガーデンを見る</text>
  <text x="2082" y="800"
        text-anchor="middle"
        fill="rgba(255,255,255,0.40)"
        font-size="48"
        font-family="'Yu Gothic','Hiragino Sans','Meiryo',sans-serif">Webアプリで記録を確認</text>
</svg>
`;

async function generateImage() {
  if (existsSync(CUSTOM_IMAGE)) {
    console.log('📁 scripts/assets/rich-menu.png を使用します（自動生成をスキップ）');
    return readFileSync(CUSTOM_IMAGE);
  }

  console.log('🎨 リッチメニュー画像を生成中...');
  const { default: sharp } = await import('sharp');

  const png = await sharp(Buffer.from(MENU_SVG.trim()))
    .png()
    .toBuffer();

  // 生成した画像を保存（再利用・確認用）
  const assetsDir = join(__dirname, 'assets');
  mkdirSync(assetsDir, { recursive: true });
  writeFileSync(CUSTOM_IMAGE, png);
  console.log(`   → scripts/assets/rich-menu.png に保存しました`);

  return png;
}

// ── LINE Messaging API ────────────────────────────────────────────────────────
const LINE_API = 'https://api.line.me';
const LINE_DATA_API = 'https://api-data.line.me';
const AUTH = { Authorization: `Bearer ${TOKEN}` };

async function createRichMenu() {
  const res = await fetch(`${LINE_API}/v2/bot/richmenu`, {
    method: 'POST',
    headers: { ...AUTH, 'Content-Type': 'application/json' },
    body: JSON.stringify(RICH_MENU),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`リッチメニュー作成失敗: ${JSON.stringify(json)}`);
  return json.richMenuId;
}

async function uploadImage(richMenuId, imageBuffer) {
  const res = await fetch(
    `${LINE_DATA_API}/v2/bot/richmenu/${richMenuId}/content`,
    {
      method: 'POST',
      headers: { ...AUTH, 'Content-Type': 'image/png' },
      body: imageBuffer,
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`画像アップロード失敗: ${text}`);
  }
}

async function setDefaultRichMenu(richMenuId) {
  const res = await fetch(
    `${LINE_API}/v2/bot/user/all/richmenu/${richMenuId}`,
    { method: 'POST', headers: AUTH }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`デフォルト設定失敗: ${text}`);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
console.log('🌿 Plant Care リッチメニューのセットアップを開始します...\n');

try {
  const imageBuffer = await generateImage();
  console.log(`✓ 画像: ${(imageBuffer.length / 1024).toFixed(0)} KB\n`);

  console.log('① リッチメニューを作成中...');
  const richMenuId = await createRichMenu();
  console.log(`✓ richMenuId: ${richMenuId}\n`);

  console.log('② 画像をアップロード中...');
  await uploadImage(richMenuId, imageBuffer);
  console.log('✓ 画像アップロード完了\n');

  console.log('③ デフォルトリッチメニューに設定中...');
  await setDefaultRichMenu(richMenuId);
  console.log('✓ デフォルト設定完了\n');

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('✅ セットアップ完了！');
  console.log(`   richMenuId: ${richMenuId}`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  console.log('📱 確認手順:');
  console.log('   1. スマホの LINE アプリを開く');
  console.log('   2. Plant Care Bot のトーク画面を開く');
  console.log('   3. 画面下部に 3つのメニューが表示されることを確認\n');
  console.log('🗑  リッチメニューを削除するには:');
  console.log(`   curl -X DELETE https://api.line.me/v2/bot/richmenu/${richMenuId} \\`);
  console.log(`     -H "Authorization: Bearer $LINE_CHANNEL_ACCESS_TOKEN"\n`);
} catch (err) {
  console.error('\n❌ エラー:', err.message);
  process.exit(1);
}
