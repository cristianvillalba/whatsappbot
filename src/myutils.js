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
	
  },
  
  getOrCreateRecentConversation: async (bp, userId, title) => {
    const knex = await bp.db.get()

    //const recentCondition = helpers(knex).date.isAfter(
    //  'last_heard_on',
    //  moment().subtract(RECENT_CONVERSATION_LIFETIME, 'ms')
    //)
	//console.log("1")
	//console.log(knex)

    const conversation = await knex('web_conversations')
      .select('id')
      //.whereNotNull('last_heard_on')
      .where({ userId })
      //.andWhere(recentCondition)
	  .andWhere('title', "=", title)
      .orderBy('last_heard_on', 'desc')
      .limit(1)
      .then()
      .get(0)
	
	//console.log("2")
    return conversation ? conversation.id : miobjeto.createConversation(bp, userId, title )
  },
  
  createConversation: async (bp, userId, titlechannel) => {
	const knex = await bp.db.get()
  
    //console.log("10")
    const uid = Math.random()
      .toString()
      .substr(2, 6)
    //const title = `Conversation ${uid}`
    //console.log("11")
	
    await knex('web_conversations')
      .insert({
        userId,
        created_on: miobjeto.isLite(knex) ? knex.raw("strftime('%Y-%m-%dT%H:%M:%fZ', 'now')") : knex.raw('now()'),
        last_heard_on: miobjeto.isLite(knex) ? knex.raw("strftime('%Y-%m-%dT%H:%M:%fZ', 'now')") : knex.raw('now()'),
        title : titlechannel
      })
      .then()

	//console.log("12")
	
    const conversation = await knex('web_conversations')
      //.where({ title, userId })
	  .where({userId})
	  .andWhere('title','=', titlechannel)
      .select('id')
      .then()
      .get(0)

	//console.log(conversation && conversation.id)
    return conversation && conversation.id
  },
  
  isLite: async(knex) => {
	return knex.client.config.client === 'sqlite3';
  } 
  
  
}
