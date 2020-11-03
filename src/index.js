const _ = require('lodash')
const jsdoc = require('jsdoc-api')

const renderers = require('./renderers')
const actions = require('./actions')
const path = require('path')

const utils = require('./myutils')

const fork = require('child_process').fork;
const program = path.resolve('src/app.js');
const parameters = [];
const options = {
                stdio: ['pipe','pipe','pipe','ipc']
                };

const child = fork(program, parameters. options);

function InternalCommunication(bp)
{
        child.on('message', async (message) => {
                console.log('messagefrom child:', message);
                
				var splitmessage = message.split(":");
				
					
                bp.events.emit('internalcomm', message);

				if (splitmessage.length > 1)
				{
					let { conversationId } = splitmessage[1] || {}
					conversationId = conversationId && parseInt(conversationId)
				
					user = await utils.getOrCreateUser(bp,'web:' + splitmessage[0]);
					
					if (!conversationId) {
						conversationId = await utils.getOrCreateRecentConversation(bp, user.userId, splitmessage[1])
					}

					bp.middlewares.sendIncoming(
							Object.assign(
							{
									platform: 'whats',
									type: 'text',
									//text: message,
									text: splitmessage[2],
									user: user,
									raw: { id: '11',
										   conversationId}
							},
							{}
							)
					);
				}
				else
				{
					user = await utils.getOrCreateUser(bp,'web:666');
					conversation = await utils.getOrCreateRecentConversation(bp, user.userId, "Cristian Villalba")
					
					bp.middlewares.sendIncoming(
							Object.assign(
							{
									platform: 'whats',
									type: 'text',
									text: message,
									user: user,
									raw: { id: '11'}
							},
							{}
							)
					);
				}
                
        });
};

function processOutgoing({event, blocName, instruction})
{
        //console.log('salida hacia cliente!:' + event.text)
        //console.log(event)
		console.log("id:" + event.user.id)
        //console.log(blocName)
        console.log('salida final hacia el cliente:' + instruction.text)
		child.send(event.user.id + "|" + instruction.text);
}


module.exports = bp => {
  ////////////////////////////
  /// INITIALIZATION
  ////////////////////////////

  // Register all renderers
  Object.keys(renderers).forEach(name => {
    bp.renderers.register(name, renderers[name])
  })

  jsdoc.explain({ files: [__dirname + '/actions.js'] }).then(docs => {
    bp.dialogEngine.registerActionMetadataProvider(fnName => {
      const meta = docs.find(({ name }) => name === fnName)
      return {
        desciption: meta.description,
        params: (meta.params || [])
          .filter(({ name }) => name.startsWith('args.'))
          .map(arg => ({ ...arg, name: arg.name.replace('args.', '') }))
      }
    })
    bp.dialogEngine.registerFunctions(actions)
  })
  
  InternalCommunication(bp);

  bp.middlewares.register({
        name:'whats',
        type: 'outgoing',
        order: 666,
        handler: pushbacktoclient,
        module: '',
        description: 'Whatsappmodule'
  })

  async function pushbacktoclient(event, next)
  {
        if (event.platform !== 'whats'){
                return next()
        }

        console.log('respuesta de dialog manager?')
        event._promise && event._resolve && event._resolve()
  }

  bp.middlewares.load()


  bp.renderers.registerConnector({
                platform:'whats',
                processOutgoing: args => processOutgoing(Object.assign({},args, {bp})),
                templates: []
        })


  ////////////////////////////
  /// Conversation Management
  ////////////////////////////

  bp.hear(/\/forget/i, async (event, next) => {
    await bp.users.untag(event.user.id, 'nickname')
    // By not calling next() here, we "swallow" the event (won't be processed by the dialog engine below)
  })
  
   bp.hear({ platform: /whats/i }, async (event, next) => {
    //await bp.users.untag(event.user.id, 'nickname')
    // By not calling next() here, we "swallow" the event (won't be processed by the dialog engine below)
    console.log("recibido x wha:" + event);
    //console.log(event);
    bp.dialogEngine.processMessage(event.sessionId || event.user.id, event).then()
  })


  // All events that should be processed by the Flow Manager
  bp.hear({ type: /text|message|quick_reply/i }, (event, next) => {
    bp.dialogEngine.processMessage(event.sessionId || event.user.id, event).then()
  })
}
