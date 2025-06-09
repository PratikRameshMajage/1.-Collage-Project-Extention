// Your Gemini API key - store this securely in production
const API_KEY = "AIzaSyCNvCXojUMc0zq7MXNJkms1iUoMP245B1I"; // Make sure this is replaced with your real API key
const API_URL = "https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent";

// Function to format the response with HTML and emojis
function formatResponse(text) {
    // First, clean up any existing HTML or problematic characters
    let formatted = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    
    // Replace Markdown-style bullet points and titles with HTML
    formatted = formatted.replace(/\* \*\*(.*?):\*\*/g, '<li><strong>🔍 $1:</strong>');
    formatted = formatted.replace(/\* (.*?)$/gm, '<li>✦ $1</li>');
    
    // Define emoji mappings
    const emojiMap = {
        'confidence': '💪 confidence',
        'performance': '🚀 performance',
        'stress': '😓 stress',
        'interview': '👔 interview',
        'positive': '✨ positive',
        'research': '🔍 research',
        'impact': '💥 impact',
        'changes': '🔄 changes',
        'boost': '⚡ boost',
        'power': '💫 power',
        'success': '🏆 success',
        'improve': '📈 improve',
        'body language': '🧍 body language',
        'hormones': '⚗️ hormones'
    };
    
    // Apply emoji replacements with word boundary checks
    Object.keys(emojiMap).forEach(key => {
        const regex = new RegExp(`\\b${key}\\b`, 'gi');
        formatted = formatted.replace(regex, emojiMap[key]);
    });
    
    // Wrap in a list if it contains list items
    if (formatted.includes('<li>')) {
        formatted = '<ul style="padding-left: 20px; list-style-type: none;">' + formatted + '</ul>';
    }
    
    // Add some styling
    formatted = `<div style="font-family: Arial, sans-serif; line-height: 1.6; color: white;">${formatted}</div>`;
    
    return formatted;
}

// Alternative formatting function that manually creates HTML elements
function formatResponseAlternative(text) {
    // Split the text into lines
    const lines = text.split('\n');
    let html = '<ul>';
    
    for (const line of lines) {
        const trimmedLine = line.trim();
        if (trimmedLine.startsWith('* **')) {
            // This is a title line
            const titleMatch = trimmedLine.match(/\* \*\*(.*?):\*\*/);
            if (titleMatch && titleMatch[1]) {
                const title = titleMatch[1];
                const content = trimmedLine.replace(/\* \*\*.*?:\*\*\s*/, '');
                html += `<li><strong>${title}:</strong> ${content}</li>`;
            } else {
                html += `<li>${trimmedLine}</li>`;
            }
        } else if (trimmedLine.startsWith('*')) {
            // This is a regular bullet point
            const content = trimmedLine.replace(/\*\s*/, '');
            html += `<li>${content}</li>`;
        } else if (trimmedLine.length > 0) {
            // This is regular text
            html += `<li>${trimmedLine}</li>`;
        }
    }
    
    html += '</ul>';
    
    return html;
}

// Function to get the current tab's URL and title
async function getCurrentTabInfo() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tabs.length === 0) throw new Error('No active tab found');
        return {
            url: tabs[0].url,
            title: tabs[0].title || 'YouTube Video'
        };
    } catch (error) {
        console.error("Error getting tab info:", error);
        throw error;
    }
}

// Function to extract video ID from YouTube URL
function getVideoId(url) {
    const regex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

// Function to show/hide loading indicator with proper cleanup
function showLoading(show) {
    const loading = document.getElementById('loading');
    
    if (!loading) return; // Safety check
    
    if (show) {
        // Clear any existing timeouts to prevent issues
        if (window.loadingHideTimeout) {
            clearTimeout(window.loadingHideTimeout);
            window.loadingHideTimeout = null;
        }
        
        loading.classList.remove('hidden');
        loading.style.opacity = '1';
        
        // Disable buttons during loading
        const buttons = document.querySelectorAll('.bt, .sidebar-item, .action-btn');
        buttons.forEach(button => {
            button.disabled = true;
            button.style.opacity = '0.6';
            button.style.cursor = 'not-allowed';
        });
    } else {
        // Use opacity transition before hiding
        loading.style.opacity = '0';
        
        // Store the timeout ID so we can clear it if needed
        window.loadingHideTimeout = setTimeout(() => {
            loading.classList.add('hidden');
            window.loadingHideTimeout = null;
            
            // Re-enable buttons
            const buttons = document.querySelectorAll('.bt, .sidebar-item, .action-btn');
            buttons.forEach(button => {
                button.disabled = false;
                button.style.opacity = '1';
                button.style.cursor = 'pointer';
            });
        }, 300); // Match this to your CSS transition time
    }
}

// Function to show notification
function showNotification(message, isError = false) {
    const response = document.getElementById("response");
    if (isError) {
        response.innerHTML = `<div class="error-message"><i class="ri-error-warning-line"></i>${message}</div>`;
    } else {
        response.innerHTML = `<div class="status-message"><i class="ri-checkbox-circle-line"></i><p>${message}</p></div>`;
    }
}

// Function to get video transcript using content script
async function getVideoTranscript() {
    try {
        const [tab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
        });

        if (!tab || !tab.id) {
            throw new Error("No active tab found");
        }

        // Set a timeout to prevent hanging
        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error("Transcript retrieval timed out")), 10000);
        });

        const scriptPromise = chrome.scripting.executeScript({
            target: { tabId: tab.id },
            function: () => {
                // This function runs in the context of the YouTube page
                const transcriptItems = document.querySelectorAll(
                    "yt-formatted-string.segment-text"
                );
                if (transcriptItems.length === 0) {
                    // Try to find and click the transcript button if transcript is not open
                    const transcriptButton = Array.from(
                        document.querySelectorAll("button")
                    ).find((button) => button.textContent.includes("Show transcript"));

                    if (transcriptButton) {
                        transcriptButton.click();
                        // Need a slight delay for the transcript to load
                        return "NEED_RETRY";
                    }
                    return "NO_TRANSCRIPT_FOUND";
                }

                // Extract transcript text
                const transcript = Array.from(transcriptItems)
                    .map((item) => item.textContent.trim())
                    .join(" ");

                return transcript;
            },
        });

        // Race the script execution against the timeout
        const results = await Promise.race([scriptPromise, timeoutPromise]);

        if (!results || !results[0]) {
            throw new Error("Failed to execute transcript script");
        }

        const transcriptResult = results[0].result;

        if (transcriptResult === "NEED_RETRY") {
            // Wait a bit and try again, but limit retries
            await new Promise((resolve) => setTimeout(resolve, 1000));
            return getVideoTranscript();
        } else if (transcriptResult === "NO_TRANSCRIPT_FOUND") {
            return "NO_TRANSCRIPT_FOUND";
        }

        return transcriptResult;
    } catch (error) {
        console.error("Error getting transcript:", error);
        return "Failed to get transcript: " + error.message;
    }
}

// Function to call Gemini API with timeout and better error handling
async function callGeminiAPI(prompt) {
    try {
        console.log(
            "Calling Gemini API with prompt:",
            prompt.substring(0, 100) + "..."
        );

        // Set a timeout to prevent hanging
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

        const response = await fetch(`${API_URL}?key=${API_KEY}`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt,
                            },
                        ],
                    },
                ],
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 1024,
                },
            }),
            signal: controller.signal
        });

        // Clear the timeout
        clearTimeout(timeoutId);

        console.log("API response status:", response.status);

        if (!response.ok) {
            let errorMessage = "API Error";
            try {
                const errorData = await response.json();
                console.error("API error data:", errorData);
                errorMessage = `API Error: ${errorData.error?.message || "Unknown error"}`;
            } catch (e) {
                errorMessage = `API Error: ${response.status} ${response.statusText}`;
            }
            throw new Error(errorMessage);
        }

        const data = await response.json();
        console.log("API response received");

        if (!data || !data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts || !data.candidates[0].content.parts[0]) {
            throw new Error("Invalid response format from API");
        }

        return data.candidates[0].content.parts[0].text;
    } catch (error) {
        console.error("Error calling Gemini API:", error);
        if (error.name === 'AbortError') {
            throw new Error("API request timed out. Please try again.");
        }
        throw error;
    }
}

// Function to process the video based on action with improved error handling
async function processVideo(action) {
    // Clear any previous timeouts to prevent issues
    if (window.loadingHideTimeout) {
        clearTimeout(window.loadingHideTimeout);
        window.loadingHideTimeout = null;
    }
    
    // Clear any previous API timeouts
    if (window.apiTimeoutId) {
        clearTimeout(window.apiTimeoutId);
        window.apiTimeoutId = null;
    }
    
    try {
        // Clear any previous errors or responses
        document.getElementById("response").innerHTML = "";
        showLoading(true);

        // Get current tab info
        const { url, title } = await getCurrentTabInfo();

        // Check if it's a YouTube video
        if (!url.includes("youtube.com/watch")) {
            throw new Error("Please open a YouTube video first");
        }

        // Get video ID
        const videoId = getVideoId(url);
        if (!videoId) {
            throw new Error("Could not identify YouTube video ID");
        }
        
        // Get transcript
        document.getElementById("response").innerHTML = `
            <div class="status-message">
                <i class="ri-file-search-line"></i>
                <p>Getting video transcript...</p>
            </div>
        `;
        
        const transcript = await getVideoTranscript();
        if (!transcript || transcript.includes("Failed to get transcript") || transcript === "NO_TRANSCRIPT_FOUND") {
            throw new Error("Could not retrieve transcript. Make sure the video has captions available");
        }
        
        // If action is just to get transcript, display it and return
        if (action === "transcript") {
            // Format transcript with line breaks for better readability
            const formattedTranscript = transcript.replace(/\.\s+/g, '.\n\n');
            document.getElementById("response").innerHTML = `<div class="transcript-text">${formattedTranscript}</div>`;
            showLoading(false);
            return;
        }
        
        document.getElementById("response").innerHTML = `
            <div class="status-message">
                <i class="ri-ai-generate"></i>
                <p>Processing with Gemini AI...</p>
            </div>
        `;

        // Prepare prompt based on action
        let prompt;
        if (action === "summarize") {
            prompt = `Summarize this YouTube video transcript in 5 bullet points. Format each point exactly like this:
            * **Key Point Here:** 
            Then add 1-2 sentences explaining the point.
            
            Make the summary engaging and visually structured.
            
            Title: ${title}
            Transcript: ${transcript.substring(0, 15000)}`;
        } else if (action === "hindi") {
            prompt = `Translate this YouTube video to Hindi with this exact format:
            * **Key Point in Hindi:** 
            Then add 1-2 sentences in Hindi explaining the point.
            
            Use 5 bullet points for main ideas.
            
            Title: ${title}
            Transcript: ${transcript.substring(0, 15000)}`;
        } else if (action === "marathi") {
            prompt = `Translate this YouTube video to Marathi with this exact format:
            * **Key Point in Marathi:** 
            Then add 1-2 sentences in Marathi explaining the point.
            
            Use 5 bullet points for main ideas.
            
            Title: ${title}
            Transcript: ${transcript.substring(0, 15000)}`;
        } else if (action === "english") {
            prompt = `Translate this YouTube video to simple English with this exact format:
            * **Key Point:** 
            Then add 1-2 sentences in simple English explaining the point.
            
            Use 5 bullet points for main ideas.
            
            Title: ${title}
            Transcript: ${transcript.substring(0, 15000)}`;
        } else if (action === "spanish") {
            prompt = `Translate this YouTube video to Spanish with this exact format:
            * **Punto Clave:** 
            Then add 1-2 sentences in Spanish explaining the point.
            
            Use 5 bullet points for main ideas.
            
            Title: ${title}
            Transcript: ${transcript.substring(0, 15000)}`;
        } else if (action === "notes") {
            prompt = `Create detailed study notes from this YouTube video transcript. Format with clear headings and bullet points:
            * **Topic:** 
            Then add key information about this topic.
            
            Make the notes comprehensive yet concise.
            
            Title: ${title}
            Transcript: ${transcript.substring(0, 15000)}`;
        } else if (action === "quiz") {
            prompt = `Create 5 quiz questions based on this YouTube video transcript. Format as:
            * **Question:** [Question here]
            * **Answer:** [Answer here]
            
            Make questions that test understanding of key concepts.
            
            Title: ${title}
            Transcript: ${transcript.substring(0, 15000)}`;
        } else {
            // If no valid action is provided, show error and end processing
            throw new Error("Invalid action specified");
        }

        // Call Gemini API with timeout
        const controller = new AbortController();
        window.apiTimeoutId = setTimeout(() => {
            controller.abort();
            window.apiTimeoutId = null;
        }, 30000); // 30 second timeout
        
        let result;
        try {
            result = await callGeminiAPI(prompt);
            
            // Clear the timeout
            if (window.apiTimeoutId) {
                clearTimeout(window.apiTimeoutId);
                window.apiTimeoutId = null;
            }
            
            if (!result) {
                throw new Error("Failed to get response from Gemini API");
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error("API request timed out. Please try again.");
            }
            throw error;
        }

        // Format and display result with HTML
        try {
            // Check if formatResponseAlternative exists, otherwise use formatResponse
            const formattedResult = typeof formatResponseAlternative === 'function' 
                ? formatResponseAlternative(result) 
                : formatResponse(result);
                
            document.getElementById("response").innerHTML = formattedResult;
            setupScrolling();
        } catch (e) {
            console.error("Error formatting response:", e);
            // Fallback to plain text if formatting fails
            document.getElementById("response").innerText = result;
            setupScrolling();
        }
    } catch (error) {
        console.error("Error in processVideo:", error);
        showNotification(error.message || "An unknown error occurred", true);
    } finally {
        // Always ensure loading is hidden, even if there's an error
        showLoading(false);
        
        // Clear any timeouts to be safe
        if (window.apiTimeoutId) {
            clearTimeout(window.apiTimeoutId);
            window.apiTimeoutId = null;
        }
    }
}

// Function to copy response to clipboard
function copyToClipboard() {
    const responseText = document.getElementById('response').innerText;

    const textarea = document.createElement('textarea');
    textarea.value = responseText;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'absolute';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand('copy');
    document.body.removeChild(textarea);

    // Show "Copied!" near the top-right button (id="copy-feedback" must exist in popup.html)
    const feedback = document.getElementById('copy-feedback');
    if (feedback) {
        feedback.style.display = 'block';
        feedback.classList.add('show');

        setTimeout(() => {
            feedback.style.display = 'none';
            feedback.classList.remove('show');
        }, 2000);
    }
}

// Add event listeners to the buttons
document.addEventListener("DOMContentLoaded", () => {
    // Make sure loading is hidden initially
    const loading = document.getElementById('loading');
    if (loading) {
        loading.classList.add('hidden');
        loading.style.opacity = '0';
    }
    
    // Make sure custom prompt container is hidden initially
    const customPromptContainer = document.getElementById('custom-prompt-container');
    if (customPromptContainer) {
        customPromptContainer.classList.add('hidden');
    }
    
    // Make sure response container is visible initially
    const responseContainer = document.getElementById('response-container');
    if (responseContainer) {
        responseContainer.classList.remove('hidden');
    }
    
    // Check if we're on YouTube and enable/disable buttons accordingly
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const isYouTube = tabs[0]?.url?.includes("youtube.com/watch") || false;
        
        if (!isYouTube) {
            showNotification("Please open a YouTube video to use this extension", true);
            
            // Disable all buttons
            document.querySelectorAll('.bt, .sidebar-item').forEach(button => {
                button.disabled = true;
                button.style.opacity = '0.6';
                button.style.cursor = 'not-allowed';
            });
        }
    });

    setupSidebarHandlers();
    setupCustomPromptHandlers();
    
    // Add copy button functionality
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', copyToClipboard);
    }
});

function setupSidebarHandlers() {
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    
    sidebarItems.forEach(item => {
        item.addEventListener('click', function() {
            handleSidebarItemClick(this, sidebarItems);
        });
    });
    
    // Setup translation options
    const translationOptions = document.querySelectorAll('.translation-option');
    translationOptions.forEach(option => {
        option.addEventListener('click', function() {
            const lang = this.getAttribute('data-lang');
            
            // Hide translation menu
            const translationMenu = document.querySelector('.translation-menu');
            const backdrop = document.querySelector('.menu-backdrop');
            
            if (translationMenu && backdrop) {
                translationMenu.classList.remove('active');
                backdrop.classList.remove('active');
            }
            
            // Process translation
            if (lang) {
                processVideo(lang);
            }
        });
    });
    
    // Setup backdrop click to close translation menu
    const backdrop = document.querySelector('.menu-backdrop');
    if (backdrop) {
        backdrop.addEventListener('click', function() {
            const translationMenu = document.querySelector('.translation-menu');
            if (translationMenu) {
                translationMenu.classList.remove('active');
                this.classList.remove('active');
            }
        });
    }
}

function setupCustomPromptHandlers() {
    const customPromptBtn = document.getElementById('custom-prompt-btn');
    const customPromptContainer = document.getElementById('custom-prompt-container');
    const submitPromptBtn = document.getElementById('submit-prompt-btn');
    const cancelPromptBtn = document.getElementById('cancel-prompt-btn');
    const customPromptInput = document.getElementById('custom-prompt-input');
    const responseContainer = document.getElementById('response-container');
    
    if (!customPromptBtn || !customPromptContainer || !submitPromptBtn || 
        !cancelPromptBtn || !customPromptInput || !responseContainer) {
        console.error("Missing required DOM elements for custom prompt setup");
        return;
    }
    
    // Show custom prompt input when the sidebar item is clicked
    customPromptBtn.addEventListener('click', function() {
        // Hide response container
        responseContainer.classList.add('hidden');
        
        // Show custom prompt container
        customPromptContainer.classList.remove('hidden');
        
        // Focus the input
        customPromptInput.focus();
    });
    
    // Handle submit button click
    submitPromptBtn.addEventListener('click', function() {
        const customPrompt = customPromptInput.value.trim();
        
        if (customPrompt.length < 10) {
            showNotification("Please enter a longer prompt (at least 10 characters)", true);
            return;
        }
        
        // Hide custom prompt container
        customPromptContainer.classList.add('hidden');
        
        // Show response container
        responseContainer.classList.remove('hidden');
        
        // Process the video with the custom prompt
        processVideoWithCustomPrompt(customPrompt);
    });
    
    // Handle cancel button click
    cancelPromptBtn.addEventListener('click', function() {
        // Hide custom prompt container
        customPromptContainer.classList.add('hidden');
        
        // Show response container
        responseContainer.classList.remove('hidden');
        
        // Clear the input
        customPromptInput.value = '';
    });
    
    // Handle Enter key in textarea
    customPromptInput.addEventListener('keydown', function(e) {
        // Submit on Ctrl+Enter or Cmd+Enter
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            submitPromptBtn.click();
            e.preventDefault();
        }
    });
}

function handleSidebarItemClick(clickedItem, allItems) {
    // Don't do anything if already processing
    if (document.getElementById('loading') && 
        !document.getElementById('loading').classList.contains('hidden')) {
        return;
    }
    
    // Remove active class from all items
    allItems.forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to clicked item
    clickedItem.classList.add('active');
    
    // Update heading based on clicked item
    updateHeading(clickedItem.id);
    
    // If it's the custom prompt button, show the custom prompt container and hide response container
    if (clickedItem.id === 'custom-prompt-btn') {
        const customPromptContainer = document.getElementById('custom-prompt-container');
        const responseContainer = document.getElementById('response-container');
        
        if (customPromptContainer && responseContainer) {
            customPromptContainer.classList.remove('hidden');
            responseContainer.classList.add('hidden');
            
            const customPromptInput = document.getElementById('custom-prompt-input');
            if (customPromptInput) {
                customPromptInput.focus();
            }
        }
        return;
    } else {
        // For all other options, hide custom prompt container and show response container
        const customPromptContainer = document.getElementById('custom-prompt-container');
        const responseContainer = document.getElementById('response-container');
        
        if (customPromptContainer && responseContainer) {
            customPromptContainer.classList.add('hidden');
            responseContainer.classList.remove('hidden');
        }
    }
    
    // Process video based on clicked item
    if (clickedItem.id === 'transcript-btn') {
        processVideo('transcript');
    } else if (clickedItem.id === 'summarize-btn') {
        processVideo('summarize');
    } else if (clickedItem.id === 'notes-btn') {
        processVideo('notes');
    } else if (clickedItem.id === 'quiz-btn') {
        processVideo('quiz');
    } else if (clickedItem.id === 'language-btn') {
        // Show language selection panel
        const translationMenu = document.querySelector('.translation-menu');
        const backdrop = document.querySelector('.menu-backdrop');
        
        if (translationMenu && backdrop) {
            translationMenu.classList.add('active');
            backdrop.classList.add('active');
        }
    }
}

// Function to update heading based on selected option
function updateHeading(buttonId) {
    const heading = document.getElementById('heading');
    
    switch(buttonId) {
        case 'transcript-btn':
            heading.textContent = 'Video Transcript';
            break;
        case 'summarize-btn':
            heading.textContent = 'Video Summary';
            break;
        case 'notes-btn':
            heading.textContent = 'Study Notes';
            break;
        case 'custom-prompt-btn':
            heading.textContent = 'Custom Analysis';
            break;
        case 'language-btn':
            heading.textContent = 'Translation';
            break;
        case 'quiz-btn':
            heading.textContent = 'Quiz Questions';
            break;
        default:
            heading.textContent = 'YouTube Summary';
    }
}

// Function to process video with custom prompt - fixed version
async function processVideoWithCustomPrompt(customPrompt) {
    // Clear any previous timeouts to prevent issues
    if (window.loadingHideTimeout) {
        clearTimeout(window.loadingHideTimeout);
        window.loadingHideTimeout = null;
    }
    
    // Clear any previous API timeouts
    if (window.apiTimeoutId) {
        clearTimeout(window.apiTimeoutId);
        window.apiTimeoutId = null;
    }
    
    try {
        // Clear any previous errors or responses
        document.getElementById("response").innerHTML = "";
        showLoading(true);

        // Get current tab info
        const { url, title } = await getCurrentTabInfo();

        // Check if it's a YouTube video
        if (!url.includes("youtube.com/watch")) {
            throw new Error("Please open a YouTube video first");
        }

        // Get video ID
        const videoId = getVideoId(url);
        if (!videoId) {
            throw new Error("Could not identify YouTube video ID");
        }
        
        // Get transcript
        document.getElementById("response").innerHTML = `
            <div class="status-message">
                <i class="ri-file-search-line"></i>
                <p>Getting video transcript...</p>
            </div>
        `;
        
        const transcript = await getVideoTranscript();
        if (!transcript || transcript.includes("Failed to get transcript") || transcript === "NO_TRANSCRIPT_FOUND") {
            throw new Error("Could not retrieve transcript. Make sure the video has captions available");
        }
        
        document.getElementById("response").innerHTML = `
            <div class="status-message">
                <i class="ri-ai-generate"></i>
                <p>Processing with Gemini AI...</p>
            </div>
        `;

        // Prepare prompt with the custom prompt
        const prompt = `${customPrompt}
        
        Use this YouTube video transcript as the source:
        Title: ${title}
        Transcript: ${transcript.substring(0, 15000)}`;

        // Call Gemini API with timeout
        const controller = new AbortController();
        window.apiTimeoutId = setTimeout(() => {
            controller.abort();
            window.apiTimeoutId = null;
        }, 30000); // 30 second timeout
        
        let result;
        try {
            result = await callGeminiAPI(prompt);
            
            // Clear the timeout
            if (window.apiTimeoutId) {
                clearTimeout(window.apiTimeoutId);
                window.apiTimeoutId = null;
            }
            
            if (!result) {
                throw new Error("Failed to get response from Gemini API");
            }
        } catch (error) {
            if (error.name === 'AbortError') {
                throw new Error("API request timed out. Please try again.");
            }
            throw error;
        }

        // Format and display result with HTML
        try {
            // Check if formatResponseAlternative exists, otherwise use formatResponse
            const formattedResult = typeof formatResponseAlternative === 'function' 
                ? formatResponseAlternative(result) 
                : formatResponse(result);
                
            document.getElementById("response").innerHTML = formattedResult;
            setupScrolling();
        } catch (e) {
            console.error("Error formatting response:", e);
            // Fallback to plain text if formatting fails
            document.getElementById("response").innerText = result;
            setupScrolling();
        }
    } catch (error) {
        console.error("Error in processVideoWithCustomPrompt:", error);
        showNotification(error.message || "An unknown error occurred", true);
    } finally {
        // Always ensure loading is hidden, even if there's an error
        showLoading(false);
        
        // Clear any timeouts to be safe
        if (window.apiTimeoutId) {
            clearTimeout(window.apiTimeoutId);
            window.apiTimeoutId = null;
        }
    }
}

// Function to ensure proper scrolling after content is loaded
function setupScrolling() {
    // Reset scroll position when new content is loaded
    const responseElement = document.getElementById('response');
    if (responseElement) {
        responseElement.scrollTop = 0;
    }
    
    // Ensure the response container is visible and scrollable
    const responseContainer = document.getElementById('response-container');
    if (responseContainer && responseContainer.classList.contains('hidden')) {
        responseContainer.classList.remove('hidden');
    }
    
    // Adjust content padding if needed based on content height
    adjustContentPadding();
}

// Function to adjust content padding based on content height
function adjustContentPadding() {
    const responseElement = document.getElementById('response');
    const headingElement = document.getElementById('heading');
    
    if (responseElement && headingElement) {
        // If content is shorter than available space, add some bottom padding
        if (responseElement.scrollHeight <= responseElement.clientHeight) {
            responseElement.style.paddingBottom = '20px';
        } else {
            responseElement.style.paddingBottom = '16px';
        }
    }
}

// Add resize handling for better responsiveness
window.addEventListener('resize', function() {
    setupScrolling();
});

// Add this function to prevent body scrolling when dropdown is open
function preventBodyScroll(prevent) {
    document.body.style.overflow = prevent ? 'hidden' : '';
}

// Function to setup language panel handlers
function setupLanguagePanel() {
    const languageBtn = document.getElementById('language-btn');
    const languagePanel = document.getElementById('language-panel');
    const closeLanguagePanel = document.getElementById('close-language-panel');
    const languageCards = document.querySelectorAll('.language-card');
    
    // Open language panel when language button is clicked
    languageBtn.addEventListener('click', function() {
        languagePanel.classList.add('active');
    });
    
    // Close language panel when close button is clicked
    closeLanguagePanel.addEventListener('click', function() {
        languagePanel.classList.remove('active');
    });
    
    // Handle language selection
    languageCards.forEach(card => {
        card.addEventListener('click', function() {
            const lang = this.getAttribute('data-lang');
            const langName = this.querySelector('.language-name').textContent;
            
            // Close the panel
            languagePanel.classList.remove('active');
            
            // Update heading
            document.getElementById('heading').textContent = `${langName} Translation`;
            
            // Process the video with selected language
            processVideo(lang);
            
            // Update active state in sidebar
            const sidebarItems = document.querySelectorAll('.sidebar-item');
            sidebarItems.forEach(item => item.classList.remove('active'));
            languageBtn.classList.add('active');
        });
    });
}

// Function to toggle translation menu
function toggleTranslationMenu() {
    const translationMenu = document.querySelector('.translation-menu');
    const backdrop = document.querySelector('.menu-backdrop');
    const languageBtn = document.getElementById('language-btn');
    
    // Toggle active class
    translationMenu.classList.toggle('active');
    backdrop.classList.toggle('active');
    languageBtn.classList.toggle('active');
    
    // If menu is now active, add click outside listener
    if (translationMenu.classList.contains('active')) {
        setTimeout(() => {
            document.addEventListener('click', closeTranslationMenuOnClickOutside);
        }, 10);
    } else {
        document.removeEventListener('click', closeTranslationMenuOnClickOutside);
    }
}

// Function to close translation menu when clicking outside
function closeTranslationMenuOnClickOutside(e) {
    const translationMenu = document.querySelector('.translation-menu');
    const languageBtn = document.getElementById('language-btn');
    
    // If click is outside menu and not on language button, close menu
    if (!translationMenu.contains(e.target) && !languageBtn.contains(e.target)) {
        closeTranslationMenu();
        document.removeEventListener('click', closeTranslationMenuOnClickOutside);
    }
}

// Function to close translation menu
function closeTranslationMenu() {
    const translationMenu = document.querySelector('.translation-menu');
    const backdrop = document.querySelector('.menu-backdrop');
    const languageBtn = document.getElementById('language-btn');
    
    translationMenu.classList.remove('active');
    backdrop.classList.remove('active');
    languageBtn.classList.remove('active');
    
    document.removeEventListener('click', closeTranslationMenuOnClickOutside);
}

// Function to setup translation options
function setupTranslationOptions() {
    const translationOptions = document.querySelectorAll('.translation-option');
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    const languageBtn = document.getElementById('language-btn');
    
    translationOptions.forEach(option => {
        option.addEventListener('click', function() {
            const lang = this.getAttribute('data-lang');
            const langName = this.querySelector('.translation-option-name').textContent;
            
            // Close the menu
            closeTranslationMenu();
            
            // Update heading
            document.getElementById('heading').textContent = `${langName} Translation`;
            
            // Set language button as active
            sidebarItems.forEach(item => item.classList.remove('active'));
            languageBtn.classList.add('active');
            
            // Process the video with selected language
            processVideo(lang);
        });
    });
}

// Enhanced UI animations and transitions
function setupUIEnhancements() {
    // Add subtle entrance animation for sidebar items
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach((item, index) => {
        item.style.opacity = '0';
        item.style.transform = 'translateX(-10px)';
        
        setTimeout(() => {
            item.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            item.style.opacity = '1';
            item.style.transform = 'translateX(0)';
        }, 50 + (index * 50)); // Staggered animation
    });
    
    // Smooth transition when changing content
    const responseContainer = document.getElementById('response-container');
    const originalUpdateHeading = updateHeading;
    
    // Override the updateHeading function to add animations
    window.updateHeading = function(buttonId) {
        const heading = document.getElementById('heading');
        
        // Animate heading change
        heading.style.opacity = '0';
        heading.style.transform = 'translateY(-5px)';
        
        setTimeout(() => {
            // Call the original function
            originalUpdateHeading(buttonId);
            
            // Animate heading back in
            heading.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
            heading.style.opacity = '1';
            heading.style.transform = 'translateY(0)';
        }, 150);
        
        // Animate response container
        if (responseContainer) {
            responseContainer.style.opacity = '0';
            responseContainer.style.transform = 'translateY(10px)';
            
            setTimeout(() => {
                responseContainer.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
                responseContainer.style.opacity = '1';
                responseContainer.style.transform = 'translateY(0)';
            }, 300);
        }
    };
    
    // Enhance loading animation
    const originalShowLoading = showLoading;
    window.showLoading = function(show) {
        const loading = document.getElementById('loading');
        
        if (show) {
            loading.classList.remove('hidden');
            loading.style.opacity = '0';
            
            setTimeout(() => {
                loading.style.opacity = '1';
            }, 10);
        } else {
            loading.style.opacity = '0';
            
            setTimeout(() => {
                loading.classList.add('hidden');
            }, 300);
        }
        
        // Call original function for button disabling
        originalShowLoading(show);
    };
    
    // Enhance copy button animation
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
        copyBtn.addEventListener('mouseenter', () => {
            copyBtn.style.transform = 'translateY(-2px) scale(1.05)';
            copyBtn.style.boxShadow = 'var(--shadow-lg)';
        });
        
        copyBtn.addEventListener('mouseleave', () => {
            copyBtn.style.transform = '';
            copyBtn.style.boxShadow = '';
        });
    }
}

// Call the setup function when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    // Original event listeners
    // ...
    
    // Add our UI enhancements
    setupUIEnhancements();
});

// Add a fallback formatResponseAlternative function if it doesn't exist
if (typeof formatResponseAlternative !== 'function') {
    function formatResponseAlternative(text) {
        return formatResponse(text);
    }
}

// Make sure copy button is visible on all features
document.addEventListener("DOMContentLoaded", () => {
    // Existing code...
    
    // Ensure copy button is visible on all features
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) {
        // Make sure it's always visible
        copyBtn.style.display = 'flex';
    }
});
