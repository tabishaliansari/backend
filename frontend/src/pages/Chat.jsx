import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

function Chat() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [messages, setMessages] = useState([
    {
      id: '1',
      text: 'Hello! How can I help you with your knowledge graph?',
      sender: 'assistant',
      timestamp: '10:30 AM',
    },
  ])
  const [input, setInput] = useState('')

  const handleSendMessage = (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const newMessage = {
      id: Date.now().toString(),
      text: input,
      sender: 'user',
      timestamp: new Date().toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }),
    }

    setMessages(prev => [...prev, newMessage])
    setInput('')

    // Simulate assistant response
    setTimeout(() => {
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          text: 'This is a placeholder response. The real assistant will respond here.',
          sender: 'assistant',
          timestamp: new Date().toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
          }),
        },
      ])
    }, 500)
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-gray-50 dark:bg-gray-900">
      {/* Page Header */}
      <div className="border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <button
          onClick={() => navigate('/dashboard')}
          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline mb-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </button>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Chat Session: {id}
        </h1>
      </div>

      {/* Messages Area */}
      <main className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full px-4 py-8">
        <div className="space-y-4">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                  msg.sender === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white'
                }`}
              >
                <p className="text-sm">{msg.text}</p>
                <p
                  className={`text-xs mt-1 ${
                    msg.sender === 'user'
                      ? 'text-blue-100'
                      : 'text-gray-500 dark:text-gray-400'
                  }`}
                >
                  {msg.timestamp}
                </p>
              </div>
            </div>
          ))}
        </div>
      </main>

      {/* Input Area */}
      <footer className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 p-4">
        <form onSubmit={handleSendMessage} className="max-w-2xl mx-auto flex gap-4">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Type your message..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
          >
            Send
          </button>
        </form>
      </footer>
    </div>
  )
}

export default Chat

