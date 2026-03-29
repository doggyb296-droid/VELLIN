const sectionStyle = {
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

const bulletStyle = {
  margin: 0,
  paddingLeft: "20px",
  color: "rgba(255,255,255,0.78)",
  lineHeight: 1.7,
} as const;

export default function PrivacyPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        height: "100dvh",
        overflowY: "auto",
        WebkitOverflowScrolling: "touch",
        background: "radial-gradient(circle at top, rgba(139,212,255,0.18), transparent 36%), #07111f",
        color: "white",
        padding: "32px 20px 64px",
      }}
    >
      <div style={{ maxWidth: "780px", margin: "0 auto", display: "grid", gap: "18px" }}>
        <div style={{ display: "grid", gap: "10px", textAlign: "center", marginBottom: "8px" }}>
          <div style={{ letterSpacing: "0.18em", textTransform: "uppercase", color: "rgba(255,255,255,0.58)", fontSize: "0.78rem", fontWeight: 800 }}>VELLIN</div>
          <h1 style={{ fontSize: "2.4rem", fontWeight: 900, letterSpacing: "-0.04em", margin: 0 }}>Privacy Policy</h1>
          <p style={{ color: "rgba(255,255,255,0.72)", lineHeight: 1.7, margin: 0 }}>
            Last updated: March 24, 2026. This policy explains what data VELLIN collects, why it is used, and what control users have over it.
          </p>
        </div>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Who this policy applies to</h2>
          <p style={bodyStyle}>
            This policy applies to the VELLIN mobile app and related support pages. VELLIN is a focus and digital wellbeing app that helps users track focus sessions, manage distraction apps, view insights, and optionally use social features.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>What we collect</h2>
          <ul style={bulletStyle}>
            <li>Account information such as email address and display name when a user creates an account.</li>
            <li>App preferences such as notification settings, sound settings, selected distraction apps, theme preference, and break reminder timing.</li>
            <li>Progress and usage data inside VELLIN such as focus sessions, milestones, achievements, roadmap data, and saved in-app state.</li>
            <li>Optional social data such as username, avatar URL, leaderboard information, and friend connections if the user chooses to use social features.</li>
            <li>On Android, if the user grants Usage Access, app-usage totals needed to generate screen-time style insights and Reality Check summaries.</li>
            <li>Support information the user sends directly by email.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>What we do not collect</h2>
          <ul style={bulletStyle}>
            <li>We do not collect payment card information directly in the app today.</li>
            <li>We do not sell personal information.</li>
            <li>We do not read a user&apos;s private messages, photos, or contacts.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Why we use data</h2>
          <ul style={bulletStyle}>
            <li>To create and manage user accounts.</li>
            <li>To save progress and sync app state across devices for signed-in users.</li>
            <li>To power features like focus sessions, Reality Check, Forecast, reminders, and social leaderboards.</li>
            <li>To show the user their own in-app analytics and optional Android usage-based insights.</li>
            <li>To respond to support requests, security issues, and account deletion requests.</li>
          </ul>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Permissions and device access</h2>
          <ul style={bulletStyle}>
            <li>Notifications: used to send optional daily nudges, focus reminders, and break reminders if the user turns them on.</li>
            <li>Android Usage Access: used only if the user grants it, so VELLIN can read app-usage totals needed for focus insights.</li>
          </ul>
          <p style={bodyStyle}>
            Users can decline these permissions. Core app features remain available, although some insight or reminder features may be limited.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>How data is stored and shared</h2>
          <p style={bodyStyle}>
            VELLIN uses Supabase to store account data, app state, and optional social data. Data is shared with service providers only as needed to run the app, store account data, and support app functionality. If subscriptions are added later, billing-related status may also be processed by Apple, Google, and a subscription management provider.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>How we protect data</h2>
          <p style={bodyStyle}>
            VELLIN uses authenticated access controls, database security rules, and server-side protections designed to limit unauthorized access to account data. No system can promise perfect security, but VELLIN is designed to reduce unnecessary data exposure and limit access to data that is needed for app functionality.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Retention and deletion</h2>
          <p style={bodyStyle}>
            Account data is kept while the account remains active. Users can delete their account from the Profile screen. When an account is deleted, VELLIN removes the login from authentication and deletes related account records tied to that user record, subject to technical backup and platform limits.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Children</h2>
          <p style={bodyStyle}>
            VELLIN is not directed to children under 13, and the app should not be used by children under the minimum age required by local law without a parent or guardian where required.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Changes to this policy</h2>
          <p style={bodyStyle}>
            This policy may be updated as VELLIN adds new features, billing, or platform integrations. The updated version will be posted on this page with a revised effective date.
          </p>
        </section>

        <section style={sectionStyle}>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>Contact</h2>
          <p style={bodyStyle}>
            For privacy questions or requests, contact <a href="mailto:ryanwork813@gmail.com" style={{ color: "#b8f08c" }}>ryanwork813@gmail.com</a>.
          </p>
        </section>
      </div>
    </main>
  );
}
