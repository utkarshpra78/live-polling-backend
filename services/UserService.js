import User from '../models/User.js'

class UserService {
  async createOrUpdateUser(socketId, roles, userName = null) {
    const updateData = {
      socketId,
      roles,
      updatedAt: new Date()
    }
    
    if (userName) {
      updateData.userName = userName
    }

    return await User.findOneAndUpdate(
      { socketId },
      updateData,
      { upsert: true, new: true }
    )
  }

  async getUserBySocketId(socketId) {
    return await User.findOne({ socketId })
  }

  async deleteUser(socketId) {
    return await User.findOneAndDelete({ socketId })
  }
}

export default new UserService()

