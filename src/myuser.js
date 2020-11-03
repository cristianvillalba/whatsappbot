const _ = require('lodash')

var miobjeto = module.exports = {

  getOrCreateUser: async(bp, userId, throwIfNotFound = false) => {
    const knex = await bp.db.get()
    const realUserId = userId.startsWith('web:') ? userId.substr(4) : userId

    const user = await knex('users').where({
      platform: 'whats',
      userId: realUserId
    }).then().get(0).then()

    if (!user) {
      if (throwIfNotFound) {
        throw new Error(`User ${realUserId} not found`)
      }

      await miobjeto.createNewUser(bp, realUserId)
      return miobjeto.getOrCreateUser(bp, realUserId, true)
    }

    return user
  },

  createNewUser: async(bp,userId) => {
    let r = Math.random().toString(36).substring(7)
    let g = Math.random().toString(36).substring(7)
    const [first_name, last_name] = [r,g]
    const user = {
      first_name: first_name,
      last_name: last_name,
      profile_pic: null,
      id: userId,
      platform: 'whats'
    }

    return bp.db.saveUser(user)
	
  }
}
