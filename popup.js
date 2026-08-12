function send(message) {
  return chrome.runtime.sendMessage(message);
}

function setStatus(id, text) {
  document.getElementById(id).textContent = text;
}

function setConnectionStatus(id, connected, details = "") {
  const status = connected ? "Connected" : "Disconnected";
  setStatus(id, connected && details ? `${status}: ${details}` : status);
}

function showResult(result) {
  const panel = document.getElementById("result-panel");
  const title = document.getElementById("result-title");
  const message = document.getElementById("result-message");
  const accept = document.getElementById("accept");
  const reject = document.getElementById("reject");

  panel.classList.remove("hidden");
  title.textContent =
    result.status === "update_recommended"
      ? "Documentation Update Recommended"
      : result.status === "no_update"
        ? "No Update Needed"
        : "Decision Recorded";
  message.textContent = result.message;

  const showDecisionButtons = result.status === "update_recommended";
  accept.classList.toggle("hidden", !showDecisionButtons);
  reject.classList.toggle("hidden", !showDecisionButtons);
}

async function refresh() {
  const state = await send({ type: "get_state" });
  setConnectionStatus("github-status", state.githubConnected, state.githubUser);
  setConnectionStatus("docs-status", state.googleDocsConnected, state.googleDocTitle);
  setConnectionStatus("chatgpt-status", state.chatgptConnected, state.chatgptModel);
  if (!document.getElementById("google-doc-id").value && state.targetGoogleDocId) {
    document.getElementById("google-doc-id").value = state.targetGoogleDocId;
  }
  if (state.lastSuggestion) {
    showResult(state.lastSuggestion);
  }
}

document.getElementById("connect-github").addEventListener("click", async () => {
  const response = await send({ type: "connect_github" });
  if (!response.ok) {
    showResult({ status: "error", message: response.error });
    return;
  }
  await refresh();
});

document.getElementById("connect-docs").addEventListener("click", async () => {
  const docId = document.getElementById("google-doc-id").value.trim();
  const response = await send({ type: "connect_google_docs", docId });
  if (!response.ok) {
    showResult({ status: "error", message: response.error });
    return;
  }
  await refresh();
});

document.getElementById("connect-chatgpt").addEventListener("click", async () => {
  const response = await send({ type: "connect_chatgpt" });
  if (!response.ok) {
    showResult({ status: "error", message: response.error });
    return;
  }
  await refresh();
});

document.getElementById("enable-repo").addEventListener("click", async () => {
  const repo = document.getElementById("repo-input").value.trim();
  if (!repo) return;
  const response = await send({ type: "toggle_repo", repo, enabled: true });
  if (!response.ok) {
    showResult({ status: "error", message: response.error });
    return;
  }
  document.getElementById("repo-status").textContent = `Monitoring enabled for ${repo.trim()}`;
});

document.getElementById("analyze").addEventListener("click", async () => {
  const repo = document.getElementById("pr-repo").value.trim();
  const prTitle = document.getElementById("pr-title").value.trim();
  const changedFiles = document
    .getElementById("changed-files")
    .value.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const response = await send({ type: "analyze_pr", repo, prTitle, changedFiles });
  if (!response.ok) {
    showResult({ status: "error", message: response.error });
    return;
  }
  showResult(response.result);
});

document.getElementById("accept").addEventListener("click", async () => {
  await send({ type: "accept_suggestion" });
  await refresh();
});

document.getElementById("reject").addEventListener("click", async () => {
  await send({ type: "reject_suggestion" });
  await refresh();
});

refresh();
