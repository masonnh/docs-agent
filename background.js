const DEFAULT_STATE = {
  githubConnected: false,
  googleDocsConnected: false,
  chatgptConnected: false,
  monitoredRepos: {},
  lastSuggestion: null,
  targetGoogleDocId: "",
  githubUser: "",
  googleDocTitle: "",
  chatgptModel: ""
};

async function getState() {
  const current = await chrome.storage.local.get(DEFAULT_STATE);
  return { ...DEFAULT_STATE, ...current };
}

function setState(patch) {
  return chrome.storage.local.set(patch);
}

let envCache = null;

function parseEnvFile(content) {
  return content
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .reduce((env, line) => {
      const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
      if (!match) return env;
      const key = match[1];
      let value = match[2];
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      env[key] = value;
      return env;
    }, {});
}

async function loadEnv() {
  if (envCache) return envCache;
  const response = await fetch(chrome.runtime.getURL(".env"), { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Unable to read .env from extension root.");
  }
  const envText = await response.text();
  envCache = parseEnvFile(envText);
  return envCache;
}

function getEnvValue(env, keys) {
  for (const key of keys) {
    if (env[key]) return env[key];
  }
  return "";
}

async function parseApiError(response) {
  const fallback = `Request failed (${response.status})`;
  try {
    const data = await response.json();
    return data.error?.message || data.message || fallback;
  } catch (_err) {
    try {
      const text = await response.text();
      return text || fallback;
    } catch (_err2) {
      return fallback;
    }
  }
}

async function verifyGithub(token) {
  const response = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: "Bearer ".concat(token),
      Accept: "application/vnd.github+json"
    }
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json();
}

async function verifyRepo(repo, token) {
  const normalized = (repo || "").trim().replace(/^\/+|\/+$/g, "");
  const [owner, name] = normalized.split("/");
  if (!owner || !name) {
    throw new Error('Repository must be in "owner/repo" format.');
  }
  const response = await fetch(`https://api.github.com/repos/${owner}/${name}`, {
    headers: {
      Authorization: "Bearer ".concat(token),
      Accept: "application/vnd.github+json"
    }
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  await response.json();
  return normalized;
}

async function verifyGoogleDoc(docId, apiKey) {
  const response = await fetch(
    `https://docs.googleapis.com/v1/documents/${encodeURIComponent(docId)}?key=${encodeURIComponent(apiKey)}`
  );
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  return response.json();
}

async function verifyChatGpt(apiKey) {
  const response = await fetch("https://api.openai.com/v1/models", {
    headers: {
      Authorization: "Bearer ".concat(apiKey)
    }
  });
  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }
  const data = await response.json();
  return data.data?.[0]?.id || "available";
}

function selectRelevantTocSections(prText, tocSections) {
  const normalized = (prText || "").toLowerCase();
  const keywords = normalized.split(/\W+/).filter(Boolean);
  return tocSections.filter((section) => {
    const title = section.title.toLowerCase();
    return keywords.some((word) => word.length > 3 && title.includes(word));
  });
}

function analyzeDocumentationImpact(prTitle, changedFiles = []) {
  const title = (prTitle || "").toLowerCase();
  const codeTouched = changedFiles.some((file) =>
    /\.(js|ts|tsx|py|go|rb|java|cs|rs|php|swift|kt)$/i.test(file)
  );
  const behaviorKeywords = ["add", "change", "config", "setting", "api", "workflow", "behavior"];
  const hasBehaviorSignal = behaviorKeywords.some((word) => title.includes(word));
  return codeTouched && hasBehaviorSignal;
}

function getDocsTableOfContents() {
  return [
    { id: "overview", title: "Product Overview" },
    { id: "configuration", title: "Configuration and Settings" },
    { id: "api", title: "API Behavior" },
    { id: "operations", title: "Operational Workflows" }
  ];
}

function buildSuggestion(prTitle, relevantSections) {
  const sectionTitles = relevantSections.map((section) => section.title).join(", ");
  return {
    status: "update_recommended",
    headline: "Documentation Update Recommended",
    message: `Update ${sectionTitles || "the relevant sections"} to reflect PR: "${prTitle}".`,
    actions: ["accept", "reject"]
  };
}

async function buildChatGptSuggestion(prTitle, changedFiles, tocSections, apiKey, googleDocTitle) {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer ".concat(apiKey),
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You are a documentation assistant. Return compact JSON with keys: message (string), section_ids (array of section ids)."
        },
        {
          role: "user",
          content: JSON.stringify({
            prTitle,
            changedFiles,
            docTitle: googleDocTitle || "Google Doc",
            sections: tocSections
          })
        }
      ]
    })
  });

  if (!response.ok) {
    throw new Error(await parseApiError(response));
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(content);
  const selectedIds = Array.isArray(parsed.section_ids) ? new Set(parsed.section_ids) : new Set();
  const relevantSections = tocSections.filter((section) => selectedIds.has(section.id));
  const fallbackMessage = `Update ${relevantSections.map((section) => section.title).join(", ") || "the relevant sections"} to reflect PR: "${prTitle}".`;

  return {
    status: "update_recommended",
    headline: "Documentation Update Recommended",
    message: parsed.message || fallbackMessage,
    actions: ["accept", "reject"]
  };
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    const state = await getState();
    let env;
    let githubToken = "";
    let googleApiKey = "";
    let openAiKey = "";

    if (message.type === "get_state") {
      sendResponse(state);
      return;
    }

    env = await loadEnv();
    githubToken = getEnvValue(env, ["GITHUB_TOKEN", "GH_TOKEN", "GITHUB_API_TOKEN"]);
    googleApiKey = getEnvValue(env, ["GOOGLE_DOCS_API_KEY", "GOOGLE_API_KEY"]);
    openAiKey = getEnvValue(env, ["OPENAI_API_KEY"]);

    if (message.type === "connect_github") {
      if (!githubToken) {
        sendResponse({ ok: false, error: "Missing GITHUB_TOKEN (or GH_TOKEN) in .env." });
        return;
      }
      const user = await verifyGithub(githubToken);
      await setState({ githubConnected: true, githubUser: user.login || "" });
      sendResponse({ ok: true, user: user.login || "" });
      return;
    }

    if (message.type === "connect_google_docs") {
      if (!googleApiKey) {
        sendResponse({ ok: false, error: "Missing GOOGLE_DOCS_API_KEY (or GOOGLE_API_KEY) in .env." });
        return;
      }
      const fallbackDocId = getEnvValue(env, ["GOOGLE_DOC_ID", "GOOGLE_DOCS_DOCUMENT_ID"]);
      const docId = (message.docId || state.targetGoogleDocId || fallbackDocId || "").trim();
      if (!docId) {
        sendResponse({ ok: false, error: "Provide a Google Doc ID or set GOOGLE_DOC_ID in .env." });
        return;
      }
      const doc = await verifyGoogleDoc(docId, googleApiKey);
      await setState({
        googleDocsConnected: true,
        targetGoogleDocId: docId,
        googleDocTitle: doc.title || ""
      });
      sendResponse({ ok: true, docTitle: doc.title || "" });
      return;
    }

    if (message.type === "connect_chatgpt") {
      if (!openAiKey) {
        sendResponse({ ok: false, error: "Missing OPENAI_API_KEY in .env." });
        return;
      }
      const model = await verifyChatGpt(openAiKey);
      await setState({ chatgptConnected: true, chatgptModel: model });
      sendResponse({ ok: true, model });
      return;
    }

    if (message.type === "toggle_repo") {
      const monitoredRepos = { ...state.monitoredRepos };
      const repo = (message.repo || "").trim();
      if (!repo) {
        sendResponse({ ok: false, error: "Repository is required." });
        return;
      }
      if (message.enabled) {
        if (!githubToken) {
          sendResponse({ ok: false, error: "Missing GITHUB_TOKEN (or GH_TOKEN) in .env." });
          return;
        }
        const normalized = await verifyRepo(repo, githubToken);
        monitoredRepos[normalized] = true;
      } else {
        delete monitoredRepos[repo];
      }
      await setState({ monitoredRepos });
      sendResponse({ ok: true, monitoredRepos });
      return;
    }

    if (message.type === "analyze_pr") {
      const { repo, prTitle, changedFiles } = message;
      if (!state.githubConnected || !state.googleDocsConnected || !state.chatgptConnected) {
        sendResponse({ ok: false, error: "Connect GitHub, Google Docs, and ChatGPT first." });
        return;
      }
      if (!state.monitoredRepos[repo]) {
        sendResponse({ ok: false, error: `Repository "${repo}" is not enabled.` });
        return;
      }

      const needsUpdate = analyzeDocumentationImpact(prTitle, changedFiles);
      if (!needsUpdate) {
        const result = { status: "no_update", message: "No documentation updates needed." };
        await setState({ lastSuggestion: result });
        sendResponse({ ok: true, result });
        return;
      }

      const toc = getDocsTableOfContents();
      const relevant = selectRelevantTocSections(`${prTitle} ${(changedFiles || []).join(" ")}`, toc);
      let suggestion = buildSuggestion(prTitle, relevant);
      if (openAiKey) {
        try {
          suggestion = await buildChatGptSuggestion(
            prTitle,
            changedFiles || [],
            toc,
            openAiKey,
            state.googleDocTitle
          );
        } catch (_err) {
          suggestion = buildSuggestion(prTitle, relevant);
        }
      }
      await setState({ lastSuggestion: suggestion });
      sendResponse({ ok: true, result: suggestion });
      return;
    }

    if (message.type === "accept_suggestion" || message.type === "reject_suggestion") {
      await setState({
        lastSuggestion: {
          status: message.type === "accept_suggestion" ? "accepted" : "rejected",
          message:
            message.type === "accept_suggestion"
              ? "Documentation suggestion accepted."
              : "Documentation suggestion rejected."
        }
      });
      sendResponse({ ok: true });
    }
  })().catch((error) => {
    sendResponse({ ok: false, error: error?.message || "Unexpected error." });
  })();

  return true;
});
