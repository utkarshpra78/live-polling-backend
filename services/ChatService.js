import ChatMessage from '../models/ChatMessage.js'

class ChatService {
  async sendMessage(pollId, userName, message, socketId) {
    const chatMessage = new ChatMessage({
      pollId: pollId || null, // Allow null for global chat
      userName,
      message,
      socketId
    })

    await chatMessage.save()
    return chatMessage
  }

  async getMessagesByPollId(pollId, limit = 100) {
    // If pollId is null or 'global', get all messages (global chat)
    if (!pollId || pollId === 'global') {
      return await ChatMessage.find({ pollId: null })
        .sort({ timestamp: 1 })
        .limit(limit)
    }
    return await ChatMessage.find({ pollId })
      .sort({ timestamp: 1 }) // Sort ascending (oldest first) for display
      .limit(limit)
  }

  async getGlobalMessages(limit = 100) {
    return await ChatMessage.find({ pollId: null })
      .sort({ timestamp: 1 })
      .limit(limit)
  }
}

export default new ChatService()

