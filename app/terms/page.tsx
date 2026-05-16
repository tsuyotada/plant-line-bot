import Link from "next/link";
import { BackgroundLayer } from "@/app/BackgroundLayer";

const ff = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const CONTACT_EMAIL = "tsuyotada@gmail.com";

export default function TermsPage() {
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
        .doc-sep {
          border: none;
          border-top: 1px solid #f0ebe2;
          margin: 28px 0 0;
        }
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
            <h1 className="doc-title">利用規約</h1>
            <p className="doc-date">最終更新：2025年5月</p>

            <p className="doc-lead">
              本規約は、Plant Care（以下「本サービス」）を利用するにあたって守っていただくことを定めたものです。
              本サービスをご利用いただくことで、本規約に同意したものとみなします。
            </p>

            {/* 1. サービスの内容 */}
            <h2 className="doc-h2">1. サービスの内容</h2>
            <p className="doc-p">
              Plant Care は、植物の写真・メモ・ケアヒント・LINE通知を通じて、
              植物を気にかけるための補助ツールです。
              現在、個人が試験運用しているサービスです。
            </p>

            <hr className="doc-sep" />

            {/* 2. 医療・専門的助言ではないこと */}
            <h2 className="doc-h2">2. ケアヒントについて</h2>
            <p className="doc-p">
              本サービスが提供するケアヒント・観察コメントは、
              登録情報をもとにした補助的な提案であり、専門的な園芸指導ではありません。
            </p>
            <p className="doc-p">
              植物の状態や環境によって、最適な対応は異なります。
              専門的な判断が必要な場合は、園芸店・専門家・信頼できる情報源にご確認ください。
            </p>

            <hr className="doc-sep" />

            {/* 3. AI機能について */}
            <h2 className="doc-h2">3. AI機能について</h2>
            <p className="doc-p">
              本サービスはAIを使用してケアヒント・植物識別・相談応答を生成します。
              AIによる提案は常に正確とは限りません。
            </p>
            <ul className="doc-ul">
              <li>AIの回答は「観察のきっかけ」として受け取ってください</li>
              <li>「必ず実行すべき指示」ではありません</li>
              <li>実際の植物の状態をご自身で確認したうえで判断してください</li>
              <li>AI機能に使用するデータの詳細は、プライバシーポリシーをご確認ください</li>
            </ul>

            <hr className="doc-sep" />

            {/* 4. 禁止事項 */}
            <h2 className="doc-h2">4. 禁止事項</h2>
            <p className="doc-p">以下の行為を禁止します。</p>
            <ul className="doc-ul">
              <li>不正アクセスや認証の迂回</li>
              <li>他人になりすます行為</li>
              <li>他人の個人情報・写真を無断で登録・利用する行為</li>
              <li>サービスの運営を妨げる行為</li>
              <li>法令・公序良俗に反する行為</li>
              <li>スパムや第三者への迷惑行為</li>
              <li>共有URL・LINE通知機能を不適切な目的で使用する行為</li>
            </ul>

            <hr className="doc-sep" />

            {/* 5. ユーザーの責任 */}
            <h2 className="doc-h2">5. ご利用にあたって</h2>
            <ul className="doc-ul">
              <li>登録する情報はできるだけ正確に入力してください</li>
              <li>写真やメモに不適切な内容を含めないでください</li>
              <li>共有URLの管理はご自身の責任で行ってください</li>
              <li>LINE通知・共有機能を第三者への迷惑となる形で利用しないでください</li>
            </ul>

            <hr className="doc-sep" />

            {/* 6. サービスの変更・停止 */}
            <h2 className="doc-h2">6. サービスの変更・停止</h2>
            <p className="doc-p">
              試験運用中のサービスであるため、機能の追加・変更・停止を予告なく行う場合があります。
              障害やメンテナンスにより一時的に利用できない場合があります。
              これらによって生じた不便については、あらかじめご了承ください。
            </p>

            <hr className="doc-sep" />

            {/* 7. 免責 */}
            <h2 className="doc-h2">7. 免責事項</h2>
            <p className="doc-p">
              本サービスが提供する情報・ケアヒント・AI回答の正確性・完全性を保証しません。
              本サービスの利用によって生じた植物の枯れ・損傷・その他の損害について、
              法令で認められる範囲で責任を負いません。
            </p>
            <p className="doc-p">
              Supabase・Vercel・LINE・OpenAI・Googleなど外部サービスの
              障害や仕様変更による影響について、本サービスは責任を負いません。
            </p>

            <hr className="doc-sep" />

            {/* 8. データ削除・問い合わせ */}
            <h2 className="doc-h2">8. データ削除・問い合わせ</h2>
            <p className="doc-p">
              登録したデータやアカウントの削除を希望される場合は、
              以下の連絡先までお問い合わせください。
            </p>
            <p className="doc-p" style={{ fontWeight: 600, color: "#2d4a3e" }}>
              {CONTACT_EMAIL}
            </p>

            <hr className="doc-sep" />

            {/* 9. 準拠法 */}
            <h2 className="doc-h2">9. 準拠法</h2>
            <p className="doc-p">
              本規約は日本法を準拠法とします。
              本サービスに関する紛争については、東京地方裁判所を第一審の専属的合意管轄裁判所とします。
            </p>

            <div className="doc-footer">
              <Link href="/privacy">プライバシーポリシー</Link>
              <Link href="/login">← ログインへ戻る</Link>
              <span className="doc-footer-right">Plant Care</span>
            </div>
          </div>

        </div>
      </main>
    </>
  );
}
