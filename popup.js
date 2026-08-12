// save the docs link to local storage on button click
document.getElementById("save-docs-btn").addEventListener("click", () => {
  const docsUrl = document.getElementById("google-doc-url").value;
  if (docsUrl) {
    chrome.storage.local.set({ docsUrl }, () => {
      document.getElementById("docs-status").textContent = "Saved!";
    });
  } else {
    document.getElementById("docs-status").textContent =
      "Please enter a valid URL.";
  }
});

// load the docs link from local storage when the popup is opened
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("docsUrl", (data) => {
    if (data.docsUrl) {
      document.getElementById("google-doc-url").value = data.docsUrl;
      document.getElementById("docs-status").textContent = "Docs loaded!";
    } else {
      document.getElementById("docs-status").textContent = "Not saved";
    }
  });
});

// save the PR link to local storage on button click
document.getElementById("save-pr-btn").addEventListener("click", () => {
  const prUrl = document.getElementById("pr-url").value;
  if (prUrl) {
    chrome.storage.local.set({ prUrl }, () => {
      document.getElementById("pr-status").textContent = "PR link saved!";
    });
  } else {
    document.getElementById("pr-status").textContent =
      "Please enter a valid PR URL.";
  }
});

// load the PR link from local storage when the popup is opened
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get("prUrl", (data) => {
    if (data.prUrl) {
      document.getElementById("pr-url").value = data.prUrl;
      document.getElementById("pr-status").textContent = "PR loaded!";
    } else {
      document.getElementById("pr-status").textContent = "No PR link saved";
    }
  });
});

// if there is a pr link and a docs link, show the suggestions panel
document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.local.get(["prUrl", "docsUrl"], (data) => {
    if (data.prUrl && data.docsUrl) {
      document.getElementById("suggestions-panel").classList.remove("hidden");
    }
  });
});

// when suggestions button is clicked, send a message to the background script to get suggestions
document.getElementById("get-suggestions-btn").addEventListener("click", () => {
  chrome.storage.local.get(["prUrl", "docsUrl"], (data) => {
    if (data.prUrl && data.docsUrl) {
      chrome.runtime.sendMessage({
        action: "getSuggestions",
        prUrl: data.prUrl,
        docsUrl: data.docsUrl,
      });
    }
  });
});

// listen for suggestions from the background script and display them
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "displaySuggestions") {
    const suggestions = message.suggestions;
    const resultPanel = document.getElementById("result-panel");
    const resultTitle = document.getElementById("result-title");
    const suggestionsStatus = document.getElementById("suggestions-status");
    const copySuggestion = document.getElementById("copy-suggestion");

    resultTitle.textContent = "Suggestions";
    suggestionsStatus.textContent = "";
    copySuggestion.classList.remove("hidden");
  }
});
