"use client";

import dynamic from "next/dynamic";

const VellinApp = dynamic(() => import("../src/App"), {
  ssr: false,
  loading: () => (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", color: "#f7fbff", background: "#1a2742" }}>
      <div style={{ opacity: 0.78, fontFamily: "Manrope, sans-serif", letterSpacing: "0.04em", textTransform: "uppercase", fontSize: "0.82rem" }}>
        Loading VELLIN...
      </div>
    </main>
  ),
});

export default function HomeClient() {
  return <VellinApp />;
}
