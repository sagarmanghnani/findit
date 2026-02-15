# 🔍 FindIt - Voice-Powered Item Finder

Never lose your things again! Log where you put items using voice commands and find them instantly when you need them.

## ✨ Features

- 🎤 **Voice Logging**: Say "Put keys in drawer" to log items
- 🔍 **Voice Search**: Say "Where are my keys?" to find items
- ⚡ **Instant Results**: Get spoken responses immediately
- 📱 **Works Offline**: Uses browser's local storage
- 🌐 **Cross-Platform**: Works on mobile, tablet, desktop
- ⏰ **Smart Timestamps**: Shows when items were last logged
- ⚠️ **Stale Warnings**: Alerts for items logged long ago
- ✏️ **Edit & Delete**: Manage your items easily
- 🎨 **Beautiful UI**: Clean, modern, easy to use

## 🚀 Quick Deploy to Netlify (5 Minutes)

### Option 1: Drag & Drop (EASIEST)

1. **Build the app first:**
   ```bash
   cd findit-app
   npm install
   npm run build
   ```

2. **Go to [Netlify](https://app.netlify.com)**
   - Sign up/login (free)
   - Click "Add new site" → "Deploy manually"
   - Drag the `dist` folder onto the upload area
   - Done! Your app is live! 🎉

### Option 2: GitHub Deploy (RECOMMENDED for updates)

1. **Push to GitHub:**
   ```bash
   cd findit-app
   git init
   git add .
   git commit -m "Initial commit"
   gh repo create findit-app --public --source=. --push
   # Or manually create repo on github.com and push
   ```

2. **Connect to Netlify:**
   - Go to [Netlify](https://app.netlify.com)
   - Click "Add new site" → "Import from Git"
   - Choose GitHub → Select your repo
   - Build settings:
     - Build command: `npm run build`
     - Publish directory: `dist`
   - Click "Deploy"
   - Done! Auto-deploys on every push! 🚀

## 💻 Local Development

```bash
cd findit-app
npm install
npm run dev
```

Open http://localhost:5173 in Chrome/Edge/Safari

## 📱 How to Use

### Logging Items
1. Click "Log Item" button
2. Speak: "Put [item] in [location]"
   - Examples:
     - "Put keys in kitchen drawer"
     - "Car charger is in the glove box"
     - "Screwdriver - garage toolbox"
3. Verify the transcription
4. Click "Save"

### Finding Items
1. Click "Find Item" button
2. Speak: "Where are my [item]?"
   - Examples:
     - "Where are my keys?"
     - "Find screwdriver"
     - "Locate phone charger"
3. Get instant voice + visual results!

### Managing Items
- **Edit**: Click ✏️ icon on any item
- **Delete**: Click 🗑️ icon on any item
- **View All**: Scroll down to see complete list

## 🎨 Color Coding

- 🟢 **Green**: Fresh (logged today)
- 🟡 **Yellow**: Might be stale (1-7 days old)
- 🔴 **Red**: Probably stale (>7 days old)

## 🌐 Browser Support

**Full Support** (Voice + All Features):
- ✅ Chrome (Desktop & Mobile)
- ✅ Edge (Desktop & Mobile)
- ✅ Safari (iOS & macOS)

**Partial Support** (No Voice):
- ⚠️ Firefox (use text input fallback)

## 🛠️ Tech Stack

- **React 18**: UI framework
- **Vite**: Build tool (blazing fast!)
- **Web Speech API**: Voice input/output
- **LocalStorage**: Data persistence
- **PWA Ready**: Can be installed as app

## 📦 Project Structure

```
findit-app/
├── src/
│   ├── App.jsx       # Main app component
│   ├── App.css       # Styles
│   └── main.jsx      # Entry point
├── public/
│   └── manifest.json # PWA manifest
├── index.html        # HTML template
├── package.json      # Dependencies
└── vite.config.js    # Vite config
```

## 🔧 Customization

### Change App Name
Edit `index.html` and `public/manifest.json`

### Change Colors
Edit gradients in `src/App.css`:
```css
background: linear-gradient(135deg, #YOUR_COLOR_1 0%, #YOUR_COLOR_2 100%);
```

### Add Features
- Photos: Add image input to items
- Categories: Add dropdown for item types
- Cloud Sync: Integrate Firebase/Supabase
- Sharing: Add multi-user support

## 💡 Tips

- Speak clearly and naturally
- Use consistent names for items
- Update locations when you move things
- Clean up old entries regularly
- Works best in quiet environments

## 🐛 Troubleshooting

**Voice not working?**
- Use Chrome, Edge, or Safari
- Grant microphone permission
- Check browser console for errors
- Try typing instead (click input fields)

**Items not saving?**
- Check browser's local storage isn't full
- Try clearing old data
- Ensure browser allows local storage

**App not loading?**
- Clear browser cache
- Try incognito/private mode
- Check console for errors

## 📈 Future Enhancements

- [ ] Photo attachments
- [ ] Cloud sync (Firebase)
- [ ] Categories & tags
- [ ] Export/import data
- [ ] Multi-user support
- [ ] Native mobile apps
- [ ] Voice commands (delete, update)
- [ ] Smart suggestions

## 📄 License

Free to use, modify, and distribute!

## 🤝 Contributing

Found a bug? Have an idea? 
Open an issue or submit a PR!

---

Made with ❤️ for people who lose things

**Version**: 1.0.0  
**Last Updated**: February 2026
