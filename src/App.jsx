import { useState, useEffect, useRef } from 'react'
import './App.css'

function App() {
  const [items, setItems] = useState([])
  const [isListening, setIsListening] = useState(false)
  const [mode, setMode] = useState(null) // 'log' or 'find'
  const [transcript, setTranscript] = useState('')
  const [showConfirm, setShowConfirm] = useState(false)
  const [parsedData, setParsedData] = useState(null)
  const [searchResult, setSearchResult] = useState(null)
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ itemName: '', location: '' })
  const [error, setError] = useState('')
  const [listeningTimer, setListeningTimer] = useState(0)
  const [apiKey, setApiKey] = useState(localStorage.getItem('openrouter_key') || '')
  const [showApiKeyInput, setShowApiKeyInput] = useState(false)
  const [parseCache, setParseCache] = useState({})
  const recognitionRef = useRef(null)
  const timerRef = useRef(null)

  // Load items from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem('findit_items')
    if (stored) {
      setItems(JSON.parse(stored))
    }
  }, [])

  // Save items to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem('findit_items', JSON.stringify(items))
  }, [items])

  // Initialize speech recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
      recognitionRef.current = new SpeechRecognition()
      recognitionRef.current.continuous = true
      recognitionRef.current.interimResults = true
      recognitionRef.current.lang = 'en-US'
      recognitionRef.current.maxAlternatives = 3

      recognitionRef.current.onresult = (event) => {
        const results = event.results[event.results.length - 1]
        const text = results[0].transcript

        // Get alternatives for better accuracy
        const alternatives = []
        for (let i = 0; i < Math.min(results.length, 3); i++) {
          alternatives.push(results[i].transcript)
        }

        setTranscript(text)

        if (results.isFinal) {
          setIsListening(false)

          if (mode === 'log') {
            handleLogParsing(text, alternatives)
          } else if (mode === 'find') {
            handleFindParsing(text, alternatives)
          }
        }
      }

      recognitionRef.current.onerror = (event) => {
        setIsListening(false)
        setError(`Speech recognition error: ${event.error}. Please try again or type instead.`)
        setTimeout(() => setError(''), 5000)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
        setListeningTimer(0)
        if (timerRef.current) {
          clearInterval(timerRef.current)
          timerRef.current = null
        }
      }
    }
  }, [mode])

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current)
      }
    }
  }, [])

  // Parse with OpenRouter AI (free model with paid fallback)
  const parseWithAI = async (text, type = 'log') => {
    // Check cache first
    const cacheKey = `${type}:${text.toLowerCase()}`
    if (parseCache[cacheKey]) {
      return parseCache[cacheKey]
    }

    if (!apiKey) {
      throw new Error('NO_API_KEY')
    }

    const prompt = type === 'log'
      ? `Parse this into item and location. User said: "${text}". Respond ONLY with JSON: {"item":"...","location":"..."}`
      : `Extract what the user is looking for. User said: "${text}". Respond ONLY with JSON: {"search":"..."}`

    try {
      // Try FREE model first
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'HTTP-Referer': window.location.origin,
          'X-Title': 'FindIt App',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-3.2-1b-instruct:free',
          messages: [{
            role: 'user',
            content: prompt
          }],
          max_tokens: 100,
          temperature: 0
        })
      })

      if (response.status === 429) {
        // Rate limited on free, try paid model
        return await parseWithAIPaid(text, type, prompt)
      }

      const data = await response.json()
      const content = data.choices[0].message.content

      // Extract JSON from response
      const jsonMatch = content.match(/\{[^}]+\}/)
      if (jsonMatch) {
        const result = JSON.parse(jsonMatch[0])
        // Cache result
        setParseCache(prev => ({ ...prev, [cacheKey]: result }))
        return result
      }

      throw new Error('Invalid AI response')
    } catch (error) {
      if (error.message === 'Invalid AI response') {
        throw error
      }
      // Network error or other issue, try paid model
      return await parseWithAIPaid(text, type, prompt)
    }
  }

  // Fallback to paid model
  const parseWithAIPaid = async (text, type, prompt) => {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.2-1b-instruct', // Paid version
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 100,
        temperature: 0
      })
    })

    const data = await response.json()
    const content = data.choices[0].message.content

    const jsonMatch = content.match(/\{[^}]+\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      const cacheKey = `${type}:${text.toLowerCase()}`
      setParseCache(prev => ({ ...prev, [cacheKey]: result }))
      return result
    }

    throw new Error('Invalid AI response')
  }

  // Common speech recognition corrections
  const correctCommonErrors = (text) => {
    const corrections = {
      'draw': 'drawer',
      'draws': 'drawers',
      'saw': 'drawer', // Often mishears "drawer" as "saw"
      'garage toolbox': 'garage toolbox',
      'kitchen counter': 'kitchen counter',
      'bedroom': 'bedroom',
      'living room': 'living room',
      'bathroom': 'bathroom',
      'office': 'office',
      'car': 'car',
      'purse': 'purse',
      'wallet': 'wallet',
      'keys': 'keys',
      'phone': 'phone',
      'charger': 'charger',
    }

    let corrected = text.toLowerCase()

    // Apply corrections
    for (const [wrong, right] of Object.entries(corrections)) {
      const regex = new RegExp(`\\b${wrong}\\b`, 'gi')
      corrected = corrected.replace(regex, right)
    }

    return corrected
  }

  // Parse voice input for logging items
  const handleLogParsing = async (text, alternatives = []) => {
    // Apply common corrections
    const correctedText = correctCommonErrors(text)
    const lowerText = correctedText.toLowerCase()

    // Remove common conversational phrases
    const cleaned = lowerText
      .replace(/^(i |i'm |i've |i just |i am |the |a |an |my |so |okay |ok |um |uh )/g, '')
      .replace(/(put |placing |placed |placing |left |leaving |kept |keeping |stored |storing |saved |saving |dropped |dropping |threw |throwing )/g, '')
      .replace(/(the |a |an |my |our |some )/g, '')

    // Split by location indicators - expanded list for natural speech
    const locationWords = [
      ' in the ', ' in my ', ' in ',
      ' at the ', ' at my ', ' at ',
      ' on the ', ' on my ', ' on ',
      ' inside the ', ' inside my ', ' inside ',
      ' under the ', ' under my ', ' under ',
      ' behind the ', ' behind my ', ' behind ',
      ' near the ', ' near my ', ' near ',
      ' by the ', ' by my ', ' by ',
      ' next to the ', ' next to my ', ' next to ',
      ' within the ', ' within my ', ' within '
    ]

    let item = cleaned
    let location = ''
    let confidence = 0

    for (const word of locationWords) {
      if (cleaned.includes(word)) {
        const parts = cleaned.split(word)
        item = parts[0].trim()
        location = parts.slice(1).join(word).trim()
        confidence = 0.8
        break
      }
    }

    // Check if we have hyphen format: "item - location"
    if (cleaned.includes(' - ')) {
      const parts = cleaned.split(' - ')
      item = parts[0].trim()
      location = parts[1].trim()
      confidence = 0.9
    }

    // If still no location, try alternative transcriptions
    if (!location && alternatives.length > 1) {
      for (let i = 1; i < alternatives.length; i++) {
        const altCorrected = correctCommonErrors(alternatives[i])
        const altCleaned = altCorrected.toLowerCase()

        for (const word of locationWords) {
          if (altCleaned.includes(word)) {
            const parts = altCleaned.split(word)
            item = parts[0].replace(/^(i |i'm |the |put |left )/g, '').trim()
            location = parts.slice(1).join(word).trim()
            confidence = 0.7
            break
          }
        }
        if (location) break
      }
    }

    // If dictionary parsing failed or low confidence, try AI
    if (!location || confidence < 0.7) {
      try {
        const aiResult = await parseWithAI(text, 'log')
        if (aiResult && aiResult.item && aiResult.location) {
          setParsedData({ itemName: aiResult.item, location: aiResult.location })
          setShowConfirm(true)
          return
        }
      } catch (error) {
        if (error.message === 'NO_API_KEY') {
          // No API key, show setup message
          setError('For better accuracy, add your free OpenRouter API key in settings (top right)')
          setTimeout(() => setError(''), 6000)
        }
        // Fall through to dictionary result or error
      }
    }

    if (!location) {
      setError('Could not understand location. Try: "Keys in the kitchen drawer" or "I put my phone on the counter"')
      setTimeout(() => setError(''), 5000)
      return
    }

    setParsedData({ itemName: item, location: location })
    setShowConfirm(true)
  }

  // Parse voice input for finding items
  const handleFindParsing = async (text, alternatives = []) => {
    // Apply corrections
    const correctedText = correctCommonErrors(text)
    const lowerText = correctedText.toLowerCase()

    // Remove common question words - expanded for natural speech
    const searchTerm = lowerText
      .replace(/^(where |where's |where is |where are |wheres |find |locate |search |look for |looking for |do you know where |can you find )/g, '')
      .replace(/(my |the |a |an |our |some |\?|is|are)/g, '')
      .trim()

    if (!searchTerm) {
      setError('Could not understand what you\'re looking for. Try: "Where are my keys?"')
      setTimeout(() => setError(''), 5000)
      return
    }

    await searchForItem(searchTerm, alternatives, text)
  }

  // Search for item with fuzzy matching
  const searchForItem = async (searchTerm, alternatives = [], originalText = '') => {
    // Try exact and partial matches
    let results = items.filter(item =>
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.location.toLowerCase().includes(searchTerm.toLowerCase())
    )

    // If no results, try alternatives
    if (results.length === 0 && alternatives.length > 1) {
      for (let i = 1; i < alternatives.length; i++) {
        const altCorrected = correctCommonErrors(alternatives[i])
        const altTerm = altCorrected
          .toLowerCase()
          .replace(/^(where |find |locate )/g, '')
          .replace(/(my |the |\?)/g, '')
          .trim()

        results = items.filter(item =>
          item.itemName.toLowerCase().includes(altTerm.toLowerCase()) ||
          item.location.toLowerCase().includes(altTerm.toLowerCase())
        )

        if (results.length > 0) break
      }
    }

    // Try fuzzy matching if still no results
    if (results.length === 0) {
      results = items.filter(item => {
        const itemWords = item.itemName.toLowerCase().split(' ')
        const searchWords = searchTerm.toLowerCase().split(' ')

        return searchWords.some(searchWord =>
          itemWords.some(itemWord =>
            itemWord.startsWith(searchWord) ||
            searchWord.startsWith(itemWord) ||
            levenshteinDistance(itemWord, searchWord) <= 2
          )
        )
      })
    }

    // If still no results and we have API key, try AI
    if (results.length === 0 && apiKey) {
      try {
        const aiResult = await parseWithAI(originalText || searchTerm, 'find')
        if (aiResult && aiResult.search) {
          // Try searching with AI's interpretation
          const aiSearchTerm = aiResult.search.toLowerCase()
          results = items.filter(item =>
            item.itemName.toLowerCase().includes(aiSearchTerm) ||
            item.location.toLowerCase().includes(aiSearchTerm)
          )
        }
      } catch (error) {
        // AI failed, continue with no results
      }
    }

    if (results.length === 0) {
      setSearchResult({ found: false, term: searchTerm })
      speak(`I don't have any record of ${searchTerm}. Try saying the exact item name, or check your items list below.`)
    } else if (results.length === 1) {
      const item = results[0]
      const daysSince = Math.floor((Date.now() - item.timestamp) / (1000 * 60 * 60 * 24))
      const timeWarning = daysSince > 1 ? ` This was logged ${daysSince} days ago, so it might have moved.` : ''

      setSearchResult({ found: true, items: results })
      speak(`Your ${item.itemName} is in ${item.location}.${timeWarning}`)
    } else {
      setSearchResult({ found: true, items: results })
      speak(`I found ${results.length} items. Check the screen to see them all.`)
    }
  }

  // Simple Levenshtein distance for fuzzy matching
  const levenshteinDistance = (str1, str2) => {
    const matrix = []

    for (let i = 0; i <= str2.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= str1.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          )
        }
      }
    }

    return matrix[str2.length][str1.length]
  }

  // Text-to-speech
  const speak = (text) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.rate = 1.0
      utterance.pitch = 1.0
      window.speechSynthesis.speak(utterance)
    }
  }

  // Start voice input
  const startListening = (newMode) => {
    if (!recognitionRef.current) {
      setError('Speech recognition is not supported in your browser. Please use Chrome, Edge, or Safari.')
      return
    }

    setMode(newMode)
    setTranscript('')
    setShowConfirm(false)
    setSearchResult(null)
    setError('')
    setIsListening(true)
    setListeningTimer(0)

    // Start timer countdown (10 seconds)
    timerRef.current = setInterval(() => {
      setListeningTimer(prev => {
        if (prev >= 10) {
          stopListening()
          return 10
        }
        return prev + 1
      })
    }, 1000)

    recognitionRef.current.start()
  }

  // Stop listening manually
  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop()
      setIsListening(false)
      setListeningTimer(0)
      if (timerRef.current) {
        clearInterval(timerRef.current)
        timerRef.current = null
      }
    }
  }

  // Confirm and save item
  const confirmSave = () => {
    const existingIndex = items.findIndex(
      item => item.itemName.toLowerCase() === parsedData.itemName.toLowerCase()
    )

    const newItem = {
      id: existingIndex >= 0 ? items[existingIndex].id : Date.now().toString(),
      itemName: parsedData.itemName,
      location: parsedData.location,
      timestamp: Date.now()
    }

    if (existingIndex >= 0) {
      // Update existing
      const updatedItems = [...items]
      updatedItems[existingIndex] = newItem
      setItems(updatedItems)
      speak(`Updated ${parsedData.itemName} location to ${parsedData.location}`)
    } else {
      // Add new
      setItems([newItem, ...items])
      speak(`Saved ${parsedData.itemName} in ${parsedData.location}`)
    }

    setShowConfirm(false)
    setParsedData(null)
    setTranscript('')
  }

  // Cancel confirmation
  const cancelConfirm = () => {
    setShowConfirm(false)
    setParsedData(null)
    setTranscript('')
  }

  // Delete item
  const deleteItem = (id) => {
    setItems(items.filter(item => item.id !== id))
  }

  // Start editing
  const startEdit = (item) => {
    setEditingId(item.id)
    setEditForm({ itemName: item.itemName, location: item.location })
  }

  // Save edit
  const saveEdit = (id) => {
    setItems(items.map(item =>
      item.id === id
        ? { ...item, ...editForm, timestamp: Date.now() }
        : item
    ))
    setEditingId(null)
  }

  // Cancel edit
  const cancelEdit = () => {
    setEditingId(null)
  }

  // Save API key
  const saveApiKey = () => {
    localStorage.setItem('openrouter_key', apiKey)
    setShowApiKeyInput(false)
    setError('')
  }

  // Remove API key
  const removeApiKey = () => {
    setApiKey('')
    localStorage.removeItem('openrouter_key')
    setShowApiKeyInput(false)
  }

  // Get time since last update
  const getTimeSince = (timestamp) => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000)
    const minutes = Math.floor(seconds / 60)
    const hours = Math.floor(minutes / 60)
    const days = Math.floor(hours / 24)

    if (days > 0) return `${days}d ago`
    if (hours > 0) return `${hours}h ago`
    if (minutes > 0) return `${minutes}m ago`
    return 'Just now'
  }

  // Get warning class
  const getWarningClass = (timestamp) => {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24))
    if (days > 7) return 'stale-red'
    if (days > 1) return 'stale-yellow'
    return 'fresh'
  }

  return (
    <div className="app">
      <div className="container">
        <header className="header">
          <div className="header-content">
            <div>
              <h1>🔍 FindIt</h1>
              <p>Never lose your things again</p>
            </div>
            <button
              className="settings-btn"
              onClick={() => setShowApiKeyInput(!showApiKeyInput)}
              title="AI Settings"
            >
              ⚙️
            </button>
          </div>
        </header>

        {showApiKeyInput && (
          <div className="api-key-card">
            <h3>🤖 AI Enhancement (Optional)</h3>
            <p className="api-info">
              Add your <strong>free</strong> OpenRouter API key for smarter parsing.
              <a href="https://openrouter.ai/keys" target="_blank" rel="noopener noreferrer"> Get one here →</a>
            </p>
            <div className="api-key-input-group">
              <input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-or-v1-..."
                className="api-key-input"
              />
              <button onClick={saveApiKey} className="btn-save-key">
                Save
              </button>
            </div>
            {apiKey && (
              <button onClick={removeApiKey} className="btn-remove-key">
                Remove API Key
              </button>
            )}
            <p className="api-note">
              💡 Uses FREE models. No credit card needed. Your key stays on your device.
            </p>
          </div>
        )}

        {error && (
          <div className="error-banner">
            {error}
          </div>
        )}

        <div className="main-actions">
          <button
            className={`action-btn log-btn ${isListening && mode === 'log' ? 'listening' : ''}`}
            onClick={() => startListening('log')}
            disabled={isListening}
          >
            <span className="icon">📝</span>
            <span className="label">Log Item</span>
            {isListening && mode === 'log' && <span className="pulse">🎤</span>}
          </button>

          <button
            className={`action-btn find-btn ${isListening && mode === 'find' ? 'listening' : ''}`}
            onClick={() => startListening('find')}
            disabled={isListening}
          >
            <span className="icon">🔍</span>
            <span className="label">Find Item</span>
            {isListening && mode === 'find' && <span className="pulse">🎤</span>}
          </button>
        </div>

        {isListening && (
          <div className="listening-indicator">
            <div className="wave"></div>
            <p>Listening... Speak now ({10 - listeningTimer}s remaining)</p>
            <p className="hint-text">Say naturally: "I just put my keys in the kitchen drawer"</p>
            <button className="btn-stop" onClick={stopListening}>
              Stop Listening
            </button>
          </div>
        )}

        {transcript && !showConfirm && !searchResult && (
          <div className="transcript-box">
            <p className="transcript-label">I heard:</p>
            <p className="transcript-text">"{transcript}"</p>
          </div>
        )}

        {showConfirm && parsedData && (
          <div className="confirm-box">
            <h3>Confirm Details</h3>
            <p className="transcript-text">"{transcript}"</p>
            <div className="parsed-data">
              <div className="parsed-row">
                <span className="label">Item:</span>
                <span className="value">{parsedData.itemName}</span>
              </div>
              <div className="parsed-row">
                <span className="label">Location:</span>
                <span className="value">{parsedData.location}</span>
              </div>
            </div>
            <div className="confirm-actions">
              <button className="btn-confirm" onClick={confirmSave}>
                ✓ Save
              </button>
              <button className="btn-cancel" onClick={cancelConfirm}>
                ✗ Cancel
              </button>
            </div>
          </div>
        )}

        {searchResult && (
          <div className={`search-result ${searchResult.found ? 'found' : 'not-found'}`}>
            {searchResult.found ? (
              <>
                <h3>Found {searchResult.items.length} item(s)</h3>
                {searchResult.items.map(item => (
                  <div key={item.id} className={`result-item ${getWarningClass(item.timestamp)}`}>
                    <div className="result-name">{item.itemName}</div>
                    <div className="result-location">📍 {item.location}</div>
                    <div className="result-time">{getTimeSince(item.timestamp)}</div>
                  </div>
                ))}
              </>
            ) : (
              <>
                <h3>Not Found</h3>
                <p>No record of "{searchResult.term}"</p>
              </>
            )}
            <button className="btn-dismiss" onClick={() => setSearchResult(null)}>
              Dismiss
            </button>
          </div>
        )}

        <div className="items-section">
          <h2>All Items ({items.length})</h2>

          {items.length === 0 ? (
            <div className="empty-state">
              <p>No items logged yet</p>
              <p className="hint">Tap "Log Item" to get started!</p>
            </div>
          ) : (
            <div className="items-list">
              {items.map(item => (
                <div key={item.id} className={`item-card ${getWarningClass(item.timestamp)}`}>
                  {editingId === item.id ? (
                    <div className="edit-form">
                      <input
                        type="text"
                        value={editForm.itemName}
                        onChange={(e) => setEditForm({ ...editForm, itemName: e.target.value })}
                        placeholder="Item name"
                        className="edit-input"
                      />
                      <input
                        type="text"
                        value={editForm.location}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        placeholder="Location"
                        className="edit-input"
                      />
                      <div className="edit-actions">
                        <button className="btn-save" onClick={() => saveEdit(item.id)}>
                          Save
                        </button>
                        <button className="btn-cancel" onClick={cancelEdit}>
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="item-info">
                        <div className="item-name">{item.itemName}</div>
                        <div className="item-location">📍 {item.location}</div>
                        <div className="item-time">{getTimeSince(item.timestamp)}</div>
                      </div>
                      <div className="item-actions">
                        <button
                          className="btn-icon edit"
                          onClick={() => startEdit(item)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn-icon delete"
                          onClick={() => deleteItem(item.id)}
                          title="Delete"
                        >
                          🗑️
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <footer className="footer">
          <p><strong>💡 Speak naturally!</strong></p>
          <p>Log: "I just put my keys in the kitchen drawer"</p>
          <p>Find: "Where are my phone charger?"</p>
        </footer>
      </div>
    </div>
  )
}

export default App
