const DEFAULT_STATE = {
  githubConnected: false,
  googleDocsConnected: false,
  monitoredRepos: {},
  lastSuggestion: null
};

async function getState() {
  const current = await chrome.storage.local.get(DEFAULT_STATE);
  return { ...DEFAULT_STATE, ...current };
}

function setState(patch) {
  return chrome.storage.local.set(patch);
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    const state = await getState();

    if (message.type === "get_state") {
      sendResponse(state);
      return;
    }

    if (message.type === "connect_github") {
      await setState({ githubConnected: true });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "connect_google_docs") {
      await setState({ googleDocsConnected: true });
      sendResponse({ ok: true });
      return;
    }

    if (message.type === "toggle_repo") {
      const monitoredRepos = { ...state.monitoredRepos, [message.repo]: Boolean(message.enabled) };
      await setState({ monitoredRepos });
      sendResponse({ ok: true, monitoredRepos });
      return;
    }

    if (message.type === "analyze_pr") {
      const { repo, prTitle, changedFiles } = message;
      if (!state.githubConnected || !state.googleDocsConnected) {
        sendResponse({ ok: false, error: "Connect GitHub and Google Docs first." });
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
      const suggestion = buildSuggestion(prTitle, relevant);
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
  })();

  return true;
});
