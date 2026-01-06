import ChatService from '../services/ChatService.js'

class ChatController {
  async sendMessage(socket, data) {
    try {
      const { pollId, message, userName } = data
      // Use null for global chat (continuous across all polls)
      const chatMessage = await ChatService.sendMessage(
        null, // Always use global chat
        userName,
        message,
        socket.id
      )
      
      return { success: true, message: chatMessage }
    } catch (error) {
      console.error('Error sending chat message:', error)
      return { success: false, error: error.message }
    }
  }

  async getMessages(socket, data) {
    try {
      // Always get global chat messages (continuous across all polls)
      const messages = await ChatService.getGlobalMessages(100)
      return { success: true, messages: messages.map(msg => ({
        userName: msg.userName,
        message: msg.message,
        timestamp: msg.timestamp
      })) }
    } catch (error) {
      console.error('Error getting chat messages:', error)
      return { success: false, error: error.message }
    }
  }
}

export default new ChatController()

