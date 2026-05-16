import Link from "next/link";
import { BackgroundLayer } from "@/app/BackgroundLayer";

const ff = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const CONTACT_EMAIL = "tsuyotada@gmail.com";

export default function PrivacyPage() {
  return (
    <>
      <style>{`
        .doc-wrap {
          max-width: 680px;
          margin: 0 auto;
          width: 100%;
          padding: 0 20px 80px;
        }
        .doc-topbar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 24px 0 0;
          margin-bottom: 32px;
        }
        .doc-brand {
          font-size: 11px;
          font-weight: 700;
          letter-spacing: 1.5px;
          color: rgba(255,255,255,0.38);
          text-transform: uppercase;
          text-shadow: 0 1px 4px rgba(0,0,0,0.30);
        }
        .doc-back {
          font-size: 11px;
          color: rgba(255,255,255,0.42);
          text-decoration: none;
          text-shadow: 0 1px 3px rgba(0,0,0,0.25);
          transition: color 0.15s;
        }
        .doc-back:hover { color: rgba(255,255,255,0.70); }

        /* ─── Card ─── */
        .doc-card {
          background: rgba(253, 250, 244, 0.97);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border: 1px solid rgba(255, 255, 255, 0.95);
          border-radius: 16px;
          padding: 36px 40px 44px;
          box-shadow: 0 4px 32px rgba(40, 35, 20, 0.14);
        }
        @media (max-width: 560px) {
          .doc-card { padding: 24px 20px 32px; border-radius: 12px; }
        }

        /* ─── Typography ─── */
        .doc-title {
          font-size: 22px;
          font-weight: 800;
          color: #1a3320;
          margin: 0 0 4px;
          letter-spacing: -0.4px;
        }
        .doc-date {
          font-size: 12px;
          color: #9ca3af;
          margin: 0 0 28px;
        }
        .doc-lead {
          font-size: 13px;
          color: #4b5563;
          line-height: 1.85;
          margin: 0 0 32px;
          padding-bottom: 24px;
          border-bottom: 1px solid #f0ebe2;
        }
        .doc-h2 {
          font-size: 15px;
          font-weight: 800;
          color: #1a3320;
          margin: 28px 0 10px;
          letter-spacing: -0.2px;
        }
        .doc-h3 {
          font-size: 13px;
          font-weight: 700;
          color: #2d4a3e;
          margin: 16px 0 6px;
        }
        .doc-p {
          font-size: 13px;
          color: #374151;
          line-height: 1.85;
          margin: 0 0 10px;
        }
        .doc-ul {
          font-size: 13px;
          color: #374151;
          line-height: 1.85;
          margin: 0 0 10px;
          padding-left: 20px;
        }
        .doc-ul li { margin-bottom: 4px; }
        .doc-note {
          font-size: 12px;
          color: #9ca3af;
          line-height: 1.75;
          margin: 8px 0 0;
        }
        .doc-sep {
          border: none;
          border-top: 1px solid #f0ebe2;
          margin: 28px 0 0;
        }

        /* ─── Footer links ─── */
        .doc-footer {
          display: flex;
          gap: 16px;
          flex-wrap: wrap;
          margin-top: 32px;
          padding-top: 20px;
          border-top: 1px solid #f0ebe2;
          font-size: 12px;
        }
        .doc-footer a {
          color: #4b7a5a;
          text-decoration: none;
          border-bottom: 1px solid #c8e6cc;
          padding-bottom: 1px;
        }
        .doc-footer a:hover { color: #2d4a3e; }
        .doc-footer-right {
          margin-left: auto;
          color: #9ca3af;
        }
        @media (max-width: 480px) {
          .doc-footer-right { margin-left: 0; }
        }
      `}</style>

      <BackgroundLayer overlayStrength="medium" />

      <main style={{ minHeight: "100vh", fontFamily: ff }}>
        <div className="doc-wrap">

          <div className="doc-topbar">
            <span className="doc-brand">Plant Care</span>
            <Link href="/login" className="doc-back">← ログイン画面へ</Link>
          </div>

          <div className="doc-card">
            <h1 className="doc-title">プライバシーポリシー</h1>
            <p className="doc-date">最終更新：2025年5月</p>

            <p className="doc-lead">
              Plant Care（以下「本サービス」）は、植物の写真・メモ・ケアヒント・LINE通知を通じて、
              植物を気にかけるための個人運営のWebアプリです。
              本ポリシーは、本サービスが取得する情報の種類・利用目的・第三者提供について説明するものです。
            </p>

            {/* 1. 取得する情報 */}
            <h2 className="doc-h2">1. 取得する情報</h2>

            <h3 className="doc-h3">アカウント情報</h3>
            <p className="doc-p">
              LINEログイン・Googleログイン・マジックリンク（メール）によるログイン時に、
              認証に必要な識別情報（LINE userId、メールアドレス、表示名など）を取得します。
            </p>

            <h3 className="doc-h3">植物に関する情報</h3>
            <ul className="doc-ul">
              <li>植物の種類・品種・置き場所</li>
              <li>メモ（ユーザーが入力したテキスト）</li>
              <li>写真（ユーザーがアップロードした画像）</li>
              <li>ケア履歴・観察記録</li>
            </ul>

            <h3 className="doc-h3">LINE通知に関する情報</h3>
            <ul className="doc-ul">
              <li>LINE userId（通知送信に必要な識別子）</li>
              <li>通知の有効・無効状態</li>
              <li>受信者の役割（オーナー／家族・共有メンバー）</li>
            </ul>

            <h3 className="doc-h3">共有機能に関する情報</h3>
            <ul className="doc-ul">
              <li>共有URL（共有リンクを発行した場合）</li>
              <li>共有ページへのアクセス状況（アクセス解析を通じて）</li>
            </ul>

            <h3 className="doc-h3">アクセス解析情報</h3>
            <p className="doc-p">
              ページ閲覧・ボタンクリック・初回登録・共有・LINE連携などの利用状況を取得します。
              詳細は「3. アクセス解析」をご確認ください。
            </p>

            <hr className="doc-sep" />

            {/* 2. 利用目的 */}
            <h2 className="doc-h2">2. 利用目的</h2>
            <p className="doc-p">取得した情報は、以下の目的のみに使用します。</p>
            <ul className="doc-ul">
              <li>植物ページを作成・表示するため</li>
              <li>植物ごとのケアヒントを生成・表示するため</li>
              <li>写真やメモを保存し、あとから見返せるようにするため</li>
              <li>LINEで朝の植物メモや通知を送るため</li>
              <li>LINEから写真送信・相談を受け付けるため</li>
              <li>共有ページを表示するため</li>
              <li>サービスの利用状況を把握し、改善するため</li>
              <li>不具合調査や安全な運用のため</li>
            </ul>

            <hr className="doc-sep" />

            {/* 3. アクセス解析 */}
            <h2 className="doc-h2">3. アクセス解析</h2>
            <p className="doc-p">
              本サービスは、利用状況の把握・改善を目的として、以下のアクセス解析ツールを使用しています。
            </p>
            <ul className="doc-ul">
              <li><strong>Google Analytics 4（GA4）</strong> — ページ閲覧・クリック・初回登録などの利用状況を計測します</li>
              <li><strong>Vercel Analytics</strong> — ページビューとパフォーマンス指標を計測します</li>
            </ul>
            <p className="doc-p">
              解析ツールに送信するデータは、利用状況の統計的な把握を目的としたものに限定しています。
              植物名・メモ本文・写真URL・LINE userId・共有トークン・参加コードなど、
              個人を直接特定できる情報や機密性の高い情報は、解析ツールのイベントデータに含めません。
            </p>
            <p className="doc-note">
              Google Analyticsによるデータの収集・処理については、
              <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" style={{ color: "#4b7a5a" }}>Googleのプライバシーポリシー</a>に従います。
            </p>

            <hr className="doc-sep" />

            {/* 4. AI機能とデータの利用 */}
            <h2 className="doc-h2">4. AI機能とデータの利用</h2>
            <p className="doc-p">
              本サービスは、以下の目的でOpenAI（米国）のAI APIを使用しています。
              該当する機能を利用した場合、以下のデータがOpenAIのサーバーへ送信されます。
            </p>

            <h3 className="doc-h3">ケアヒントの生成（植物登録時）</h3>
            <p className="doc-p">
              植物を新規登録した際に、植物の種類・品種・置き場所・メモなどの登録情報をもとに、
              ケアルールを自動生成します。この処理に際して、植物の登録情報がOpenAIへ送信されます。
            </p>

            <h3 className="doc-h3">写真の植物識別（LINEから写真を送った場合）</h3>
            <p className="doc-p">
              LINEで写真を送ると、どの植物の記録かを識別するため、
              送信された写真と既存の植物情報（名前・メモ・参考写真のURL）がOpenAIへ送信されます。
            </p>

            <h3 className="doc-h3">写真へのアドバイス生成</h3>
            <p className="doc-p">
              LINEから送った写真に対して観察コメントを生成する場合、
              写真・植物名・初期状態のメモがOpenAIへ送信されます。
            </p>

            <h3 className="doc-h3">LINEチャット相談</h3>
            <p className="doc-p">
              LINEで植物について相談した場合、入力されたメッセージ・植物名・会話履歴がOpenAIへ送信されます。
            </p>

            <h3 className="doc-h3">朝のLINE通知文の生成</h3>
            <p className="doc-p">
              朝の通知メッセージを生成する際は、植物名・ケア種別・日付・天気情報のみを使用します。
              メモや写真は送信しません。
            </p>

            <p className="doc-note">
              OpenAIによるデータの取り扱いについては、
              <a href="https://openai.com/policies/privacy-policy" target="_blank" rel="noopener noreferrer" style={{ color: "#4b7a5a" }}>OpenAIのプライバシーポリシー</a>に従います。
              OpenAI APIを通じて送信されたデータは、APIのデフォルト設定ではモデルの学習には使用されません。
            </p>

            <hr className="doc-sep" />

            {/* 5. 第三者サービス */}
            <h2 className="doc-h2">5. 利用している外部サービス</h2>
            <p className="doc-p">
              本サービスは、以下の外部サービスを利用しています。
              各サービスへの情報提供は、本サービスの機能提供に必要な範囲に限ります。
            </p>
            <ul className="doc-ul">
              <li><strong>Supabase</strong>（米国）— 認証・データベース・写真保存</li>
              <li><strong>Vercel</strong>（米国）— ホスティング・アクセス解析</li>
              <li><strong>Google</strong>（米国）— Googleログイン・Google Analytics</li>
              <li><strong>LY Corporation（LINE）</strong>（日本）— LINEログイン・LINE Messaging API・LINE通知</li>
              <li><strong>OpenAI</strong>（米国）— ケアヒント生成・写真識別・チャット相談（詳細は上記「4. AI機能」参照）</li>
            </ul>

            <hr className="doc-sep" />

            {/* 6. 写真・メモの扱い */}
            <h2 className="doc-h2">6. 写真・メモの扱い</h2>
            <p className="doc-p">
              ユーザーが登録した植物写真やメモは、植物ページの表示やケアヒント生成のために使用します。
              原則として、本人または共有URLを知っている相手以外に公開しません。
            </p>
            <p className="doc-p">
              共有URLを発行した場合、そのURLを知っている人はログインなしで植物ページを閲覧できます。
              共有URLの管理はユーザー自身の責任において行ってください。
              不要になった共有URLはアプリ内から無効化できます。
            </p>
            <p className="doc-p">
              写真・メモはAI機能（OpenAI）の処理に使用される場合があります（詳細は「4. AI機能」参照）。
            </p>

            <hr className="doc-sep" />

            {/* 7. LINE通知の扱い */}
            <h2 className="doc-h2">7. LINE通知の扱い</h2>
            <p className="doc-p">
              LINE通知を設定すると、本サービスはLINE userIdと植物ページを紐づけて保存します。
              LINE userIdは、通知を送るために必要な範囲でのみ使用します。
            </p>
            <p className="doc-p">
              通知はユーザー自身が設定した場合にのみ送信されます。
              アプリ内から通知の停止・無効化ができます。
              家族・共有メンバーが参加コードを使ってLINE通知を受け取る場合も、
              通知先として同様に登録されます。
            </p>

            <hr className="doc-sep" />

            {/* 8. データ削除・問い合わせ */}
            <h2 className="doc-h2">8. データ削除・問い合わせ</h2>
            <p className="doc-p">
              登録した植物情報・写真・アカウントデータの削除を希望される場合は、
              以下の連絡先までお問い合わせください。
              内容を確認のうえ、対応いたします。
            </p>
            <p className="doc-p" style={{ fontWeight: 600, color: "#2d4a3e" }}>
              {CONTACT_EMAIL}
            </p>

            <hr className="doc-sep" />

            {/* 9. 改定 */}
            <h2 className="doc-h2">9. ポリシーの改定</h2>
            <p className="doc-p">
              本ポリシーは、サービスの変更や法令への対応のため改定される場合があります。
              重要な変更がある場合は、アプリ上でお知らせします。
              改定後も本サービスを継続して利用された場合は、改定後のポリシーに同意したものとみなします。
            </p>

            <div className="doc-footer">
              <Link href="/terms">利用規約</Link>
              <Link href="/login">← ログインへ戻る</Link>
              <span className="doc-footer-right">Plant Care</span>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
