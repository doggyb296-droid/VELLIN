const cardStyle = {
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

export default function TermsPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        height: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        background: "radial-gradient(circle at top, rgba(184,240,140,0.16), transparent 34%), #07111f",
        color: "white",
        padding: "32px 20px 64px",
      }}
    >
      <div style={{ maxWidth: "780px", margin: "0 auto", display: "grid", gap: "18px" }}>
        <div style={{ display: "grid", gap: "10px", textAlign: "center", marginBottom: "8px" }}>
          <div style={{ letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.58)", fontSize: "0.78rem", fontWeight: 800 }}>VELLIN</div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-0.04em", margin: 0 }}>Terms of Service</h1>
          <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.7, margin: 0 }}>
            Last updated: March 24, 2026. These terms apply to the current VELLIN app and support pages.
          </p>
        </div>

        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Using VELLIN</h2>
          <p style={bodyStyle}>
            VELLIN is a focus and productivity app. By using it, users agree not to misuse the app, disrupt the service, attempt unauthorized access, or impersonate another person.
          </p>
        </section>

        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Accounts and guest mode</h2>
          <p style={bodyStyle}>
            Some features can be used in guest mode on a single device. Account-based features such as syncing, social features, and account recovery require a registered account. Users are responsible for maintaining the confidentiality of their login details.
          </p>
        </section>

        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Social features</h2>
          <p style={bodyStyle}>
            If a user chooses to create a public username or connect with friends, some profile and leaderboard information may be visible to other users inside the app. Users should only share information they are comfortable making visible within those features.
          </p>
        </section>

        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Availability and changes</h2>
          <p style={bodyStyle}>
            VELLIN may change, improve, or remove features over time. The app is provided on an ongoing basis, but uninterrupted availability is not guaranteed.
          </p>
        </section>

        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Subscriptions</h2>
          <p style={bodyStyle}>
            Paid subscriptions are not active yet in the current build. If subscriptions are added later, they will be governed by the billing terms and renewal rules of the relevant platform, including Apple App Store or Google Play, plus any in-app terms shown at the time of purchase.
          </p>
        </section>

        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Limitation of liability</h2>
          <p style={bodyStyle}>
            VELLIN is a wellbeing and productivity tool, not a medical or emergency service. The app is provided on an &quot;as is&quot; basis to the extent allowed by law.
          </p>
        </section>

        <section style={cardStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Contact</h2>
          <p style={bodyStyle}>
            For support or legal questions, contact <a href="mailto:ryanwork813@gmail.com" style={{ color: "#b8f08c" }}>ryanwork813@gmail.com</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
