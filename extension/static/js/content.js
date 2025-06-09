// This script runs in the context of YouTube pages
console.log('YouTube Summarizer content script loaded');

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "getTranscript") {
        // This functionality is now handled directly in popup.js
        // using chrome.scripting.executeScript
        sendResponse({success: true});
    }
    return true;
});