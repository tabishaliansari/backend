import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

function Dashboard() {
  const navigate = useNavigate()
  const [chats, setChats] = useState([
    { id: '1', title: 'Chat about GraphQL', createdAt: '2024-03-15' },
    { id: '2', title: 'LLM Discussion', createdAt: '2024-03-16' },
    { id: '3', title: 'Knowledge Graphs 101', createdAt: '2024-03-17' },
  ])

  const handleCreateChat = () => {
    const chatId = Math.random().toString(36).substring(7)
    const newChat = {
      id: chatId,
      title: `New Chat ${chats.length + 1}`,
      createdAt: new Date().toISOString().split('T')[0],
    }
    setChats(prev => [newChat, ...prev])
    navigate(`/dashboard/c/${chatId}`)
  }

  return (
    <div className="px-4 py-12 max-w-6xl mx-auto">
      <div className="mb-8">
        <button
          onClick={handleCreateChat}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-8 rounded-lg transition-colors"
        >
          + Create New Chat
        </button>
      </div>

      {/* Chats List */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
          Recent Chats
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => navigate(`/dashboard/c/${chat.id}`)}
              className="bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-lg p-6 cursor-pointer transition-shadow"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                {chat.title}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Created: {chat.createdAt}
              </p>
            </div>
          ))}
        </div>

        {chats.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              No chats yet. Create one to get started!
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Dashboard
