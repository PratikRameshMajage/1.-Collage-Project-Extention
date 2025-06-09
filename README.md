# YouTube Video Summarizer

A Chrome extension that uses Google's Gemini AI to summarize, translate, and analyze YouTube videos.

![YouTube Video Summarizer](extension/static/icons/128.png)

## Features

- **Video Transcript**: Extract the full transcript from any YouTube video
- **Summary**: Generate concise 5-point summaries of video content
- **Study Notes**: Create detailed study notes from educational videos
- **Quiz Generator**: Automatically generate quiz questions based on video content
- **Translation**: Translate video content to multiple languages:
  - Hindi
  - Marathi
  - Spanish
  - Simple English
- **Custom Analysis**: Ask specific questions about the video content

## Installation

### From Chrome Web Store
*(Coming soon)*

### Manual Installation
1. Download or clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" in the top-right corner
4. Click "Load unpacked" and select the downloaded repository folder
5. The extension icon should appear in your browser toolbar

## Usage

1. Navigate to any YouTube video
2. Click the YouTube Video Summarizer extension icon in your browser toolbar
3. Select the desired function from the sidebar:
   - **Transcript**: View the full video transcript
   - **Summary**: Get a 5-point summary of key concepts
   - **Study Notes**: Generate comprehensive study notes
   - **Quiz**: Create quiz questions based on video content
   - **Translate**: Translate video content to other languages
   - **Custom**: Ask specific questions about the video

4. Wait for the AI to process the video content
5. Use the copy button to copy the results to your clipboard

## Requirements

- The YouTube video must have captions/subtitles available
- Active internet connection to access the Gemini API

## Technical Details

- Built with JavaScript, HTML, and CSS
- Uses Google's Gemini 1.5 Flash API for AI processing
- Extracts video transcripts directly from YouTube's interface
- Responsive design with modern UI elements

## Privacy

This extension:
- Only accesses data from the current YouTube tab
- Does not collect or store any personal information
- Processes video content through Google's Gemini API
- Does not track user activity or viewing habits

## Troubleshooting

- **No response**: Ensure the video has captions available
- **Error messages**: Check your internet connection
- **Extension disabled**: Make sure you're on a YouTube video page

## License

[MIT License](LICENSE)

## Credits

- Icons by [Remix Icon](https://remixicon.com/)
- AI processing powered by [Google Gemini](https://ai.google.dev/)