const sessionId =
  sessionStorage.getItem(
    "agentshield_session"
  ) || crypto.randomUUID();

sessionStorage.setItem(
  "agentshield_session",
  sessionId
);

let mouseMoves = 0;
let clickCount = 0;
let focusEvents = 0;
let maxScrollDepth = 0;

const pageStart =
  Date.now();

document.addEventListener(
  "mousemove",
  () => {
    mouseMoves++;
  }
);

document.addEventListener(
  "click",
  () => {
    clickCount++;
  }
);

window.addEventListener(
  "focus",
  () => {
    focusEvents++;
  }
);

window.addEventListener(
  "scroll",
  () => {

    const scrollTop =
      window.scrollY;

    const documentHeight =
      document.documentElement
        .scrollHeight -
      window.innerHeight;

    if (documentHeight <= 0) {
      return;
    }

    const percent =
      Math.round(
        (scrollTop /
          documentHeight) *
          100
      );

    if (
      percent >
      maxScrollDepth
    ) {
      maxScrollDepth =
        percent;
    }
  }
);

function sendBehavior() {

  const readingTime =
    Math.floor(
      (Date.now() -
        pageStart) / 1000
    );

  fetch(
    "http://localhost:3000/v1/evaluate",
    {
      method: "POST",

      headers: {
        "Content-Type":
          "application/json",

        "x-api-key":
          "test_key_123"
      },

      body: JSON.stringify({
        userAgent:
          navigator.userAgent,

        path:
          window.location.pathname,

        referrer:
          document.referrer,

        sessionId,

        mouseMoves,

        scrollDepth:
          maxScrollDepth,

        clickCount,

        focusEvents,

        readingTime
      })
    }
  ).catch(error => {
    console.error(
      "AgentShield error:",
      error
    );
  });

}

window.addEventListener(
  "beforeunload",
  sendBehavior
);

setTimeout(
  sendBehavior,
  10000
);
