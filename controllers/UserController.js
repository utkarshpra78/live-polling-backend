import UserService from '../services/UserService.js'

class UserController {
  async selectRoles(socket, data) {
    try {
      const { roles, userName } = data
      
      await UserService.createOrUpdateUser(socket.id, roles, userName)
      
      return { success: true, roles }
    } catch (error) {
      console.error('Error saving roles:', error)
      return { success: false, error: error.message }
    }
  }

  async getUser(socket) {
    try {
      const user = await UserService.getUserBySocketId(socket.id)
      if (!user) {
        return { success: false, error: 'User not found' }
      }
      return { success: true, user }
    } catch (error) {
      console.error('Error getting user:', error)
      return { success: false, error: error.message }
    }
  }
}

export default new UserController()

