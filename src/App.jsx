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
  const recognitionRef = useRef(null)

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
      recognitionRef.current.continuous = false
      recognitionRef.current.interimResults = false
      recognitionRef.current.lang = 'en-US'

      recognitionRef.current.onresult = (event) => {
        const text = event.results[0][0].transcript
        setTranscript(text)
        setIsListening(false)
        
        if (mode === 'log') {
          handleLogParsing(text)
        } else if (mode === 'find') {
          handleFindParsing(text)
        }
      }

      recognitionRef.current.onerror = (event) => {
        setIsListening(false)
        setError(`Speech recognition error: ${event.error}. Please try again or type instead.`)
        setTimeout(() => setError(''), 5000)
      }

      recognitionRef.current.onend = () => {
        setIsListening(false)
      }
    }
  }, [mode])

  // Parse voice input for logging items
  const handleLogParsing = (text) => {
    const lowerText = text.toLowerCase()
    
    // Remove common words
    const cleaned = lowerText
      .replace(/^(i |i'm |i've |the |a |an )/g, '')
      .replace(/(put |placed |left |kept |stored |saved )/g, '')
    
    // Split by location indicators
    const locationWords = [' in ', ' at ', ' on ', ' inside ', ' under ', ' behind ', ' near ']
    let item = cleaned
    let location = ''
    
    for (const word of locationWords) {
      if (cleaned.includes(word)) {
        const parts = cleaned.split(word)
        item = parts[0].trim()
        location = parts.slice(1).join(word).trim()
        break
      }
    }
    
    // Check if we have hyphen format: "item - location"
    if (cleaned.includes(' - ')) {
      const parts = cleaned.split(' - ')
      item = parts[0].trim()
      location = parts[1].trim()
    }
    
    if (!location) {
      setError('Could not understand location. Please try: "Put [item] in [location]"')
      setTimeout(() => setError(''), 5000)
      return
    }
    
    setParsedData({ itemName: item, location: location })
    setShowConfirm(true)
  }

  // Parse voice input for finding items
  const handleFindParsing = (text) => {
    const lowerText = text.toLowerCase()
    
    // Remove common question words
    const searchTerm = lowerText
      .replace(/^(where |where's |where is |find |locate |search )/g, '')
      .replace(/(my |the |a |an |\?)/g, '')
      .trim()
    
    searchForItem(searchTerm)
  }

  // Search for item
  const searchForItem = (searchTerm) => {
    const results = items.filter(item => 
      item.itemName.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    if (results.length === 0) {
      setSearchResult({ found: false, term: searchTerm })
      speak(`I don't have any record of ${searchTerm}`)
    } else if (results.length === 1) {
      const item = results[0]
      const daysSince = Math.floor((Date.now() - item.timestamp) / (1000 * 60 * 60 * 24))
      const timeWarning = daysSince > 1 ? ` This was logged ${daysSince} days ago, so it might have moved.` : ''
      
      setSearchResult({ found: true, items: results })
      speak(`Your ${item.itemName} is in ${item.location}.${timeWarning}`)
    } else {
      setSearchResult({ found: true, items: results })
      speak(`I found ${results.length} items matching ${searchTerm}`)
    }
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
    recognitionRef.current.start()
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
          <h1>🔍 FindIt</h1>
          <p>Never lose your things again</p>
        </header>

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
            <p>Listening... Speak now</p>
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
                        onChange={(e) => setEditForm({...editForm, itemName: e.target.value})}
                        placeholder="Item name"
                        className="edit-input"
                      />
                      <input 
                        type="text"
                        value={editForm.location}
                        onChange={(e) => setEditForm({...editForm, location: e.target.value})}
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
          <p>Tip: Say "Put keys in drawer" or "Where are my keys?"</p>
        </footer>
      </div>
    </div>
  )
}

export default App
