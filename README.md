# 🛂 Veritaminal

**An AI-powered border control simulation game inspired by Papers, Please**

Make critical decisions as a border agent while navigating corruption, trust, and moral dilemmas across multiple story-driven scenarios. Every decision matters in this terminal-based game that combines strategic thinking with narrative depth.

![alt text](images/Screenshot%202025-06-08%20232136.png)

![alt text](images/Screenshot%202025-06-08%20232024.png)

![alt text](images/Screenshot%202025-06-08%20232008.png)

![alt text](images/Screenshot%202025-06-08%20231944.png)

## ✨ Features

### 🎮 Core Gameplay
- **AI-Powered Documents**: Each traveler document is dynamically generated with unique backstories and potential issues
- **Dynamic Decision Making**: Approve or deny travelers based on document validity and border regulations
- **Corruption & Trust System**: Track your performance with consequences for incorrect decisions
- **Session-Based Saves**: Complete game state persistence with single JSON file per session

### 🌍 Six Unique Border Settings
- **Eastokan-Westoria Border**: Trade disputes and business traveler scrutiny
- **Northland-Southoria Border**: Post-conflict reconciliation with refugee documentation
- **Oceania-Continent Ferry**: Tourism boom with smuggling concerns
- **Alpinia-Metropol Mountain Pass**: Environmental regulations and scientific expeditions
- **Desert Emirates-Republic**: Oil-rich diplomacy and energy sector complexity
- **Frozen Archipelago-Mainland**: Indigenous rights and cultural preservation

### 🤖 AI Integration
- **Smart Document Generation**: Context-aware traveler creation with Google Gemini AI
- **Intelligent Judgment**: AI provides hints and evaluates document authenticity
- **Narrative Updates**: Dynamic story progression based on your decisions
- **Contextual Memory**: AI remembers your past decisions and adapts accordingly

### ⚙️ Customizable Experience
- **Configurable Assignments**: Choose duration (1-30 days) and travelers per day (1-20)
- **Multiple Game Modes**: Quick sessions or extended campaigns
- **Save/Load System**: Continue your career across multiple sessions
- **Debug Mode**: Enhanced logging and AI reasoning display

## 🚀 Installation

### Global Installation (Recommended)
```bash
npm install -g veritaminal
veritaminal
```

### Local Installation
```bash
npm install veritaminal
npx veritaminal
```

### Alternative with Bun
```bash
bun install veritaminal
bun veritaminal
```

## 🔧 Setup

### 1. Get Google Gemini API Key
1. Visit [Google AI Studio](https://aistudio.google.com/)
2. Sign in with your Google account
3. Click "Get API Key" and create a new key
4. Copy your API key

### 2. Configure Environment
Create a `.env` file in your working directory:
```env
GEMINI_API_KEY=your_api_key_here
```

Or set as environment variable:
```bash
export GEMINI_API_KEY=your_api_key_here
```

## 🎯 Quick Start

### Start Playing
```bash
veritaminal
```

### Command Line Options
```bash
# Debug mode with enhanced logging
veritaminal --debug

# Skip main menu and start immediately
veritaminal --skip-menu

# Load a specific save file
veritaminal --load saves/veritaminal_save_2024-01-15.json

# Combine options
veritaminal --debug --skip-menu
```

### Alternative Scripts
```bash
# Using npm
npm run play

# Using bun
bun start

# Using node directly
node src/main.js
```

## 🎮 How to Play

### Main Menu Options
1. **Start New Career** - Begin a fresh assignment at your chosen border
2. **Continue Previous Career** - Load and resume a saved game
3. **View Border Settings** - Explore all available locations and their challenges
4. **View Game Rules** - Learn document requirements and gameplay mechanics
5. **Game Configuration** - Customize assignment length and difficulty
6. **Quit Game** - Exit Veritaminal

### Gameplay Commands
- `approve` - Allow the traveler to cross the border
- `deny` - Reject the traveler's entry request
- `hint` - Get AI assistance with document analysis (Veritas system)
- `rules` - Review current border regulations
- `save` - Save your current progress
- `quit` - Return to main menu
- `help` - Display available commands

### Game Mechanics

#### Document Validation
Each traveler presents documentation that may contain:
- **Valid Information**: Correct permits, proper formatting, legitimate backstories
- **Suspicious Elements**: Inconsistencies, forgeries, missing requirements
- **Red Flags**: Policy violations, security concerns, fraudulent credentials

#### Scoring System
- **Correct Decisions**: Earn points based on AI confidence in your judgment
- **Corruption Track**: Increases with incorrectly approved suspicious travelers
- **Trust Level**: Decreases with incorrectly denied legitimate travelers
- **Streaks**: Consecutive correct decisions provide bonuses

#### Game Over Conditions
- **High Corruption** (5+): Investigation ends your career
- **Low Trust** (-5): Excessive denials lead to reassignment
- **Assignment Completion**: Successfully finish your designated period

### Sample Gameplay Session
```
=== TRAVELER DOCUMENT ===
Name:      Maria Gonzalez
Permit:    P2847
Backstory: Business consultant traveling for trade negotiations
Note:      Has trade visa stamp dated 2024-01-10

Day: 3 | Score: 2.45
Corruption: Low (1) | Trust: High (-1) | Tendency: neutral

Enter command (approve, deny, hint, rules, save, quit, help) > approve

✅ CORRECT DECISION
Maria's documents were legitimate. Trade visa properly verified.
Score +0.75 | New Score: 3.20
```

## 🛠️ Development

### Prerequisites
- Node.js 16+ or Bun runtime
- Google Gemini API key
- Terminal with color support

### Local Development
```bash
# Clone the repository
git clone https://github.com/maverickkamal/veritaminal-js.git
cd veritaminal-js

# Install dependencies
npm install
# or
bun install

# Set up environment
cp .env.example .env
# Edit .env with your API key

# Run the game
npm start
# or
bun start
```

### Project Structure
```
veritaminal/
├── src/
│   ├── main.js          # Entry point and game loops
│   ├── mainMenu.js      # Menu system and navigation
│   ├── gameplay.js      # Core game mechanics
│   ├── memory.js        # Save system and game state
│   ├── settings.js      # Border configurations
│   ├── ui.js           # Terminal interface
│   ├── api.js          # AI integration
│   └── narrative.js    # Story and progression
├── saves/              # Game save files
├── package.json        # NPM configuration
├── README.md          # This file
└── .env               # API configuration
```

### Contributing
We welcome contributions! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📋 System Requirements

### Minimum Requirements
- **Runtime**: Node.js 16.0+ or Bun
- **Memory**: 64MB RAM
- **Storage**: 10MB disk space
- **Network**: Internet connection for AI features
- **Terminal**: ANSI color support recommended

### Optimal Experience
- **Terminal**: Modern terminal with Unicode support
- **Screen**: 80x24 characters minimum, 120x30+ recommended
- **Network**: Stable connection for responsive AI interactions

## 🔍 Troubleshooting

### Common Issues

#### "API key not found" error
```bash
# Set your API key as environment variable
export GEMINI_API_KEY=your_api_key_here

# Or create .env file in current directory
echo "GEMINI_API_KEY=your_api_key_here" > .env
```

#### Game not starting
```bash
# Check Node.js version
node --version  # Should be 16.0+

# Try running directly
node src/main.js --debug
```

#### Save file issues
```bash
# Check saves directory permissions
ls -la saves/

# Clear corrupted saves
rm saves/*.json
```

#### AI response errors
- Verify your Gemini API key is valid
- Check your internet connection
- Try running with `--debug` flag for detailed logs

### Getting Help
- **Issues**: [GitHub Issues](https://github.com/maverickkamal/veritaminal-js/issues)
- **Discussions**: [GitHub Discussions](https://github.com/maverickkamal/veritaminal-js/discussions)
- **Documentation**: [Wiki](https://github.com/maverickkamal/veritaminal-js/wiki)

## 📜 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Inspiration**: Papers, Please by Lucas Pope
- **AI Platform**: Google Gemini AI
- **Community**: All contributors and players

## 🔗 Links

- **Repository**: [GitHub](https://github.com/maverickkamal/veritaminal-js)
- **NPM Package**: [npm](https://www.npmjs.com/package/veritaminal)
- **Issues**: [Bug Reports](https://github.com/maverickkamal/veritaminal-js/issues)
- **Discussions**: [Community](https://github.com/maverickkamal/veritaminal-js/discussions)

---

**Start your career as a border agent today. Every decision has consequences. 🛂**
