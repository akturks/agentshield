import { useEffect, useState } from "react";

export default function App() {
  const [data, setData] = useState(null);

  useEffect(() => {
    fetch("http://localhost:3000/v1/dashboard")
      .then((res) => res.json())
      .then(setData)
      .catch(console.error);
  }, []);

  if (!data) {
    return (
      <div style={{ color: "white", padding: 40 }}>
        Loading AgentShield...
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0f172a",
        color: "#ffffff",
        padding: "40px",
        fontFamily: "Arial"
      }}
    >
      <h1>AgentShield Console</h1>

      <div
        style={{
          marginTop: 20,
          marginBottom: 30
        }}
      >
        <Card
          title="MODE"
          value={data.systemMode}
        />
      </div>

      <h2>System Overview</h2>

      <Grid>
        <Card title="Health" value={data.health} />
        <Card title="Identities" value={data.identities} />
        <Card title="Events" value={data.events} />
        <Card
          title="Assessments"
          value={data.assessments}
        />
        <Card
          title="Outcomes"
          value={data.outcomes}
        />
        <Card
          title="Average Trust"
          value={data.averageTrustScore}
        />
      </Grid>

      <h2 style={{ marginTop: 40 }}>
        Outcome Distribution
      </h2>

      <Grid>
        <Card
          title="ALLOW"
          value={
            data.outcomeDistribution?.ALLOW ?? 0
          }
        />

        <Card
          title="OBSERVE"
          value={
            data.outcomeDistribution?.OBSERVE ?? 0
          }
        />

        <Card
          title="CHALLENGE"
          value={
            data.outcomeDistribution?.CHALLENGE ??
            0
          }
        />

        <Card
          title="THROTTLE"
          value={
            data.outcomeDistribution?.THROTTLE ??
            0
          }
        />
      </Grid>

      <h2 style={{ marginTop: 40 }}>
        Latest Outcome
      </h2>

      <Card
        title={data.latestOutcome}
        value={`High Risk: ${data.highRiskIdentities}`}
      />
    </div>
  );
}

function Grid({ children }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns:
          "repeat(auto-fit,minmax(220px,1fr))",
        gap: "20px",
        marginTop: "20px"
      }}
    >
      {children}
    </div>
  );
}

function Card({ title, value }) {
  return (
    <div
      style={{
        background: "#1e293b",
        border: "1px solid #334155",
        borderRadius: "12px",
        padding: "20px"
      }}
    >
      <div
        style={{
          color: "#94a3b8",
          fontSize: "14px"
        }}
      >
        {title}
      </div>

      <div
        style={{
          fontSize: "32px",
          fontWeight: "bold",
          marginTop: "10px",
          color: "#ffffff"
        }}
      >
        {value}
      </div>
    </div>
  );
}
