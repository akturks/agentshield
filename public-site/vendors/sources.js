// Where each vendor publishes the addresses its crawlers are allowed to use.
//
// This is a declaration, exactly like OPERATOR_ADDRESSES in stats.js: it lives
// in versioned source so every change to it is in the history, and it is never
// inferred from traffic. Inferring "these addresses look like GPTBot" from the
// requests that claim to be GPTBot would make the check circular — it would
// confirm whatever arrived.
//
// Nothing here is fetched at detection time. A finding must reproduce from the
// record, and a check against a list that changes under it reproduces nothing:
// the same request would verify today and fail next month with no way to tell
// which answer was right. Lists are captured into a dated snapshot by
// `refresh.js`, committed, and cited by date in the finding.
export const VENDOR_LISTS = [
  {
    id: "openai-gptbot",
    vendor: "OpenAI",
    agents: ["GPTBot"],
    url: "https://openai.com/gptbot.json"
  },
  {
    id: "openai-searchbot",
    vendor: "OpenAI",
    agents: ["OAI-SearchBot"],
    url: "https://openai.com/searchbot.json"
  },
  {
    id: "openai-chatgpt-user",
    vendor: "OpenAI",
    agents: ["ChatGPT-User"],
    url: "https://openai.com/chatgpt-user.json"
  },
  {
    id: "google-googlebot",
    vendor: "Google",
    agents: ["Googlebot"],
    url: "https://developers.google.com/static/search/apis/ipranges/googlebot.json"
  },
  {
    id: "google-special-crawlers",
    vendor: "Google",
    agents: ["GoogleOther", "Google-InspectionTool"],
    url: "https://developers.google.com/static/search/apis/ipranges/special-crawlers.json"
  },
  {
    id: "google-user-triggered",
    vendor: "Google",
    agents: ["Google-CloudVertexBot", "Google-Site-Verifier"],
    url: "https://developers.google.com/static/search/apis/ipranges/user-triggered-fetchers.json"
  },
  {
    id: "perplexity-bot",
    vendor: "Perplexity",
    agents: ["PerplexityBot"],
    url: "https://www.perplexity.ai/perplexitybot.json"
  },
  {
    id: "perplexity-user",
    vendor: "Perplexity",
    agents: ["Perplexity-User"],
    url: "https://www.perplexity.ai/perplexity-user.json"
  },
  {
    id: "microsoft-bingbot",
    vendor: "Microsoft",
    agents: ["bingbot"],
    url: "https://www.bing.com/toolbox/bingbot.json"
  }
];

// Agents whose vendor publishes nothing machine-readable that we could find, and
// the reason recorded at the time we looked. An agent landing here is reported as
// unverifiable rather than as suspicious — the absence is the vendor's, not the
// client's, and saying otherwise would turn a gap in their publishing into an
// accusation against whoever arrived.
//
// `Google-Extended` is a special case worth stating: it is a robots.txt token
// that controls training use, not a user agent any client sends. If a request
// ever declares it, that alone is notable.
export const NO_PUBLISHED_LIST = {
  ClaudeBot: "Anthropic publishes no machine-readable range list at any URL we could find (checked 2026-07-26)",
  "Claude-User": "Anthropic publishes no machine-readable range list at any URL we could find (checked 2026-07-26)",
  "Claude-SearchBot": "Anthropic publishes no machine-readable range list at any URL we could find (checked 2026-07-26)",
  "anthropic-ai": "Anthropic publishes no machine-readable range list at any URL we could find (checked 2026-07-26)",
  "Google-Extended": "a robots.txt token controlling training use, not a user agent — no client should ever send it",
  "Applebot-Extended": "a robots.txt token, not a user agent",
  Amazonbot: "no machine-readable range list found (checked 2026-07-26)",
  "meta-externalagent": "no machine-readable range list found (checked 2026-07-26)",
  Bytespider: "no machine-readable range list found (checked 2026-07-26)",
  YouBot: "no machine-readable range list found (checked 2026-07-26)",
  "cohere-ai": "no machine-readable range list found (checked 2026-07-26)"
};

// Who operates each crawler. Declared, because it is a fact about the world and
// not something traffic can be asked.
//
// This exists to answer one question the user agent string cannot: are two
// identities from the same company or from different ones? Googlebot sends
// several user agents — desktop, smartphone, image — and one Google address
// legitimately presents all of them. GPTBot and Googlebot from one address is a
// different thing entirely, and no count of distinct user agent strings can tell
// those two situations apart.
export const AGENT_OWNER = {
  GPTBot: "OpenAI",
  "OAI-SearchBot": "OpenAI",
  "ChatGPT-User": "OpenAI",
  ClaudeBot: "Anthropic",
  "Claude-User": "Anthropic",
  "Claude-SearchBot": "Anthropic",
  "anthropic-ai": "Anthropic",
  Googlebot: "Google",
  "Google-Extended": "Google",
  "Google-CloudVertexBot": "Google",
  "Google-InspectionTool": "Google",
  GoogleOther: "Google",
  "Google-Site-Verifier": "Google",
  PerplexityBot: "Perplexity",
  "Perplexity-User": "Perplexity",
  bingbot: "Microsoft",
  YandexBot: "Yandex",
  Baiduspider: "Baidu",
  CCBot: "Common Crawl",
  "Applebot-Extended": "Apple",
  Amazonbot: "Amazon",
  "meta-externalagent": "Meta",
  Bytespider: "ByteDance",
  "cohere-ai": "Cohere",
  Diffbot: "Diffbot",
  YouBot: "You.com",
  Timpibot: "Timpi",
  "xAI-SearchBot": "xAI",
  DeepSeekBot: "DeepSeek"
};

/** Which companies' crawlers these agent names belong to. */
export function ownersOf(agents) {
  return [...new Set(agents.map((a) => AGENT_OWNER[a]).filter(Boolean))];
}

/** Every list a vendor publishes, given one of its list ids. */
export function siblingLists(listId) {
  const list = VENDOR_LISTS.find((l) => l.id === listId);
  if (!list) return [];
  return VENDOR_LISTS.filter((l) => l.vendor === list.vendor && l.id !== list.id);
}

/** The list that should cover this agent, if any vendor publishes one. */
export function listForAgent(agent) {
  return VENDOR_LISTS.find((l) => l.agents.includes(agent)) ?? null;
}
