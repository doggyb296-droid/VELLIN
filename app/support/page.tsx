const supportCardStyle = {
  display: "grid",
  gap: "12px",
  padding: "24px",
  borderRadius: "24px",
  border: "1px solid rgba(255,255,255,0.08)",
  background: "rgba(11, 18, 32, 0.82)",
  boxShadow: "0 18px 50px rgba(5, 10, 24, 0.28)",
} as const;

const bodyStyle = {
  color: "rgba(255,255,255,0.78)",
  lineHeight: 1.7,
  margin: 0,
} as const;

export default function SupportPage() {
  return (
    <main style={{ minHeight: "100vh", background: "radial-gradient(circle at top, rgba(117,167,255,0.18), transparent 34%), #07111f", color: "white", padding: "32px 20px 64px" }}>
      <div style={{ maxWidth: "780px", margin: "0 auto", display: "grid", gap: "18px" }}>
        <div style={{ display: "grid", gap: "10px", textAlign: "center", marginBottom: "8px" }}>
          <div style={{ letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.58)", fontSize: "0.78rem", fontWeight: 800 }}>VELLIN</div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-0.04em", margin: 0 }}>Support</h1>
          <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.7, margin: 0 }}>
            Help with login, syncing, notifications, friends, and account deletion.
          </p>
        </div>

        <section style={supportCardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Support email</h2>
          <p style={bodyStyle}>
            Contact <a href="mailto:ryanwork813@gmail.com" style={{ color: "#b8f08c" }}>ryanwork813@gmail.com</a>. Include the email on your VELLIN account and a short description of the issue so support can respond faster.
          </p>
        </section>

        <section style={supportCardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Common help topics</h2>
          <p style={bodyStyle}>
            Account creation, email confirmation, forgot password, guest mode, profile syncing, deleting an account, social usernames, leaderboards, notifications, and Android Usage Access.
          </p>
        </section>

        <section style={supportCardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Account deletion</h2>
          <p style={bodyStyle}>
            Users can delete their account from the Profile screen inside the app. If they need help, they can email support and request deletion assistance.
          </p>
        </section>

        <section style={supportCardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Response expectations</h2>
          <p style={bodyStyle}>
            Support availability may vary by launch stage, but this address should be monitored before the app is submitted to stores.
          </p>
        </section>
      </div>
    </main>
  );
}
