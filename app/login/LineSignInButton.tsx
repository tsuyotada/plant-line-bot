// Server Component — no client JS needed for a simple anchor link.
const ff = 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export function LineSignInButton() {
  return (
    <a
      href="/api/auth/line/authorize"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        width: "100%",
        padding: "13px 14px",
        background: "#06C755",
        color: "#fff",
        borderRadius: 10,
        fontSize: 15,
        fontWeight: 600,
        fontFamily: ff,
        textDecoration: "none",
        marginBottom: 14,
        boxSizing: "border-box",
        boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
      }}
    >
      {/* LINE logo mark */}
      <svg width="22" height="22" viewBox="0 0 44 44" aria-hidden="true">
        <path
          fill="#fff"
          d="M22 4C12.06 4 4 11.163 4 20c0 5.34 2.9 10.074 7.4 13.1l-1.75 6.5 7.3-3.85A19.9 19.9 0 0022 36c9.94 0 18-7.163 18-16S31.94 4 22 4zm9.14 20.9h-4.58c-.29 0-.53-.23-.53-.52v-7.36c0-.29.24-.52.53-.52.3 0 .53.23.53.52v6.85h4.05c.3 0 .53.23.53.52 0 .28-.23.51-.53.51zm-6.96 0c-.29 0-.52-.23-.52-.52v-7.36c0-.29.23-.52.52-.52.3 0 .53.23.53.52v7.36c0 .29-.23.52-.53.52zm-2.07 0c-.19 0-.37-.1-.46-.27l-3.63-4.95v4.7c0 .29-.24.52-.53.52-.3 0-.53-.23-.53-.52v-7.36c0-.28.23-.51.53-.51.19 0 .36.1.46.26l3.63 4.95v-4.7c0-.29.24-.52.53-.52.3 0 .53.23.53.52v7.36c0 .29-.23.52-.53.52zm-5.17 0H12.4c-.3 0-.53-.23-.53-.52v-7.36c0-.29.23-.52.53-.52h4.54c.3 0 .53.23.53.52 0 .3-.23.53-.53.53h-4.01v2.44h3.44c.3 0 .53.24.53.53 0 .29-.23.52-.53.52h-3.44v2.82h4.01c.3 0 .53.24.53.53 0 .28-.23.51-.53.51z"
        />
      </svg>
      LINEでログイン
    </a>
  );
}
