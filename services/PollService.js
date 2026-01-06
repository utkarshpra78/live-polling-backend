import Poll from '../models/Poll.js'
import User from '../models/User.js'

class PollService {
  async createPoll(question, options, timeLimit, createdBy) {
    // Deactivate previous active polls
    await Poll.updateMany({ isActive: true }, { isActive: false })

    const optionTexts = options.map(opt => typeof opt === 'string' ? opt : opt.text.trim())
    const correctAnswers = options
      .map((opt, index) => {
        if (typeof opt === 'object' && opt.isCorrect === true) return index
        return null
      })
      .filter(index => index !== null)

    const startTime = new Date()
    const poll = new Poll({
      question,
      options: optionTexts,
      correctAnswers,
      createdBy,
      timeLimit: timeLimit || 60,
      isActive: true,
      startTime
    })

    await poll.save()
    return poll
  }

  async getActivePoll() {
    return await Poll.findOne({ isActive: true })
  }

  async getPollById(pollId) {
    return await Poll.findById(pollId)
  }

  async submitVote(pollId, userId, userName, option) {
    const poll = await Poll.findById(pollId)
    
    if (!poll || !poll.isActive) {
      throw new Error('Poll not found or not active')
    }

    // Check if poll has expired
    if (poll.startTime) {
      const elapsed = (new Date() - poll.startTime) / 1000
      if (elapsed > poll.timeLimit) {
        throw new Error('Poll has expired')
      }
    }

    // Check if user already voted (prevent duplicate votes)
    const existingVoteIndex = poll.votes.findIndex(v => v.userId === userId)
    if (existingVoteIndex !== -1) {
      // Update existing vote
      poll.votes[existingVoteIndex].option = option
      poll.votes[existingVoteIndex].timestamp = new Date()
    } else {
      // Add new vote
      poll.votes.push({ userId, userName: userName || 'Anonymous', option })
    }

    await poll.save()
    return poll
  }

  async canCreateNewPoll() {
    const activePoll = await this.getActivePoll()
    if (!activePoll) return true

    // Check if poll has expired
    if (activePoll.startTime) {
      const elapsed = (new Date() - activePoll.startTime) / 1000
      if (elapsed > activePoll.timeLimit) {
        // Deactivate expired poll
        await this.deactivatePoll(activePoll._id)
        return true
      }
    }

    // Check if no students have voted yet (no question has been answered)
    if (!activePoll.votes || activePoll.votes.length === 0) {
      return true
    }

    // Otherwise, don't allow creating new poll
    // In a production system, you might track expected participants
    // and check if all have voted
    return false
  }

  async getPollHistory(limit = 50) {
    return await Poll.find({ isActive: false })
      .sort({ createdAt: -1 })
      .limit(limit)
  }

  async deactivatePoll(pollId) {
    return await Poll.findByIdAndUpdate(pollId, { isActive: false }, { new: true })
  }

  getRemainingTime(poll) {
    if (!poll || !poll.startTime || !poll.isActive) {
      return 0
    }
    const elapsed = (new Date() - poll.startTime) / 1000
    const remaining = Math.max(0, poll.timeLimit - elapsed)
    return Math.ceil(remaining)
  }

  hasUserVoted(poll, userId) {
    if (!poll || !poll.votes) return false
    return poll.votes.some(v => v.userId === userId)
  }
}

export default new PollService()

