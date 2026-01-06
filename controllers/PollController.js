import PollService from '../services/PollService.js'
import UserService from '../services/UserService.js'

class PollController {
  async createPoll(socket, data) {
    try {
      const { question, options, timeLimit } = data
      const user = await UserService.getUserBySocketId(socket.id)
      
      if (!user || !user.roles.includes('teacher')) {
        return { 
          success: false, 
          error: 'Only teachers can create polls' 
        }
      }

      // Check if can create new poll
      const canCreate = await PollService.canCreateNewPoll()
      if (!canCreate) {
        return {
          success: false,
          error: 'Cannot create new poll. Please wait for all students to answer the current question or for it to expire.'
        }
      }

      const poll = await PollService.createPoll(question, options, timeLimit, socket.id)
      
      return { success: true, poll: poll.toObject() }
    } catch (error) {
      console.error('Error creating poll:', error)
      return { success: false, error: error.message }
    }
  }

  async submitVote(socket, data) {
    try {
      const { pollId, option, userName, userId } = data
      
      // First, try to get the user
      let user = await UserService.getUserBySocketId(socket.id)
      
      // If user doesn't exist or doesn't have student role, try to register them
      if (!user || !user.roles.includes('student')) {
        console.log(`User ${socket.id} not found or missing student role. Attempting to register...`)
        // Register as student if not already registered
        await UserService.createOrUpdateUser(socket.id, ['student'], userName)
        user = await UserService.getUserBySocketId(socket.id)
      }
      
      // Final check - if still no user or no student role, return error
      if (!user || !user.roles.includes('student')) {
        console.error(`User ${socket.id} failed to register as student. User:`, user)
        return { 
          success: false, 
          error: 'Only students can vote. Please ensure you are registered as a student.' 
        }
      }

      // Use provided userId (persistent session id) to prevent multi-vote via refresh
      const voterId = userId || socket.id

      const poll = await PollService.submitVote(pollId, voterId, userName, option)
      
      return { success: true, poll: poll.toObject() }
    } catch (error) {
      console.error('Error submitting vote:', error)
      return { success: false, error: error.message }
    }
  }

  async getActivePoll(socket) {
    try {
      const poll = await PollService.getActivePoll()
      if (!poll) {
        return { success: false, error: 'No active poll' }
      }

      const remainingTime = PollService.getRemainingTime(poll)
      const hasVoted = PollService.hasUserVoted(poll, socket.id)

      return { 
        success: true, 
        poll: poll.toObject(),
        remainingTime,
        hasVoted
      }
    } catch (error) {
      console.error('Error getting active poll:', error)
      return { success: false, error: error.message }
    }
  }

  async getPollHistory(socket) {
    try {
      const polls = await PollService.getPollHistory()
      return { success: true, polls }
    } catch (error) {
      console.error('Error getting poll history:', error)
      return { success: false, polls: [], error: error.message }
    }
  }
}

export default new PollController()

