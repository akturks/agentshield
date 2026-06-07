const sessionId =
  sessionStorage.getItem(
    "agentshield_session"
  ) || crypto.randomUUID();

sessionStorage.setItem(
  "agentshield_session",
  sessionId
);

fetch("http://localhost:3000/v1/evaluate", {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "x-api-key": "test_key_123"
  },
body: JSON.stringify({
  userAgent: navigator.userAgent,
  path: window.location.pathname,
  referrer: document.referrer,
  sessionId
})
})
.catch(error => {
  console.error(
    "AgentShield error:",
    error
  );
});
