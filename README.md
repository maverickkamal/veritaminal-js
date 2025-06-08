# Veritaminal JS

🛂 **AI-Powered Border Control Simulation Game**

A text-based border control simulation game inspired by "Papers, Please," built with **Bun** and **Google Gemini AI**. Make critical decisions as a border agent while managing corruption, trust, and moral dilemmas.

## 🎮 Features

- **AI-Generated Content**: Dynamic travelers, documents, and narratives powered by Google Gemini
- **Moral Complexity**: Your decisions affect corruption and trust levels with multiple endings
- **Enhanced Context System**: All AI interactions are aware of current traveler details for consistency
- **Career Progression**: Work through 10 days with 5 travelers per day
- **Multiple Border Settings**: Different locations with unique challenges
- **Save/Load System**: Continue your career across sessions
- **Real-time Hints**: Get subtle assistance from Veritas AI assistant

## 🚀 Quick Start

### Prerequisites
- [Bun](https://bun.sh) v1.2.2 or higher
- Google Gemini API key (free from [Google AI Studio](https://ai.google.dev/))

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/maverickkamal/veritaminal-js.git
   cd veritaminal-js
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Set up environment variables**
   ```bash
   # Create .env file
   echo "GEMINI_API_KEY=your_api_key_here" > .env
   ```

4. **Run the game**
   ```bash
   bun start
   ```

## 🎯 Gameplay

### Objective
Survive 10 days as a border control agent by making correct decisions about traveler documents while balancing:
- **Corruption Level**: Increases when incorrectly approving invalid documents
- **Trust Level**: Decreases when incorrectly denying valid documents

### Controls
- **approve** - Allow traveler entry
- **deny** - Reject traveler entry  
- **hint** - Get assistance from Veritas AI
- **rules** - View current verification rules
- **save** - Save current progress
- **quit** - Return to main menu

### Document Verification
Check for:
- Permit format: Must be 'P' followed by 4 digits (e.g., P1234)
- Name consistency: First and last name required
- Backstory alignment: Does the story match the traveler details?
- Setting-specific requirements: Each border has unique rules

## 🎭 Multiple Endings

- **Good Ending**: Balanced approach with commendation
- **Corrupt Ending**: Survived but morally compromised  
- **Strict Ending**: Overly rigid enforcement
- **Bad Endings**: Fired for corruption or excessive strictness

## 🔧 Command Line Options

```bash
# Start with debug logging
bun start --debug

# Skip main menu and start new game
bun start --skip-menu  

# Load specific save file
bun start --load path/to/savefile.json

# Combine options
bun start --debug --skip-menu
```

## 🏗️ Technical Architecture

- **Runtime**: Bun.js for fast JavaScript execution
- **AI Integration**: Google Gemini 2.0 Flash for dynamic content generation
- **Context System**: Global document context ensures AI consistency
- **CLI Interface**: Rich terminal UI with colors and formatting
- **Save System**: JSON-based game state persistence

## 🔐 Environment Setup

Required environment variables in `.env`:
```
GEMINI_API_KEY=your_google_gemini_api_key
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is open source and available under the [MIT License](LICENSE).

## 🙏 Acknowledgments

- Inspired by Lucas Pope's "Papers, Please"
- Built with [Bun](https://bun.sh) runtime
- Powered by [Google Gemini AI](https://ai.google.dev/)

---

**Ready to test your moral compass at the border? 🛂**
