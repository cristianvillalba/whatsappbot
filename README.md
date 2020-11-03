Whatsapp Bot
############

I made an app that uses pupetter (to automate a web browser) + botpress(open source conversational AI platform) to put a bot inside a regular Whatsapp session.
It is a project from 2 years ago, but I think it is still working.

If you scan the QR from your mobile, the puppeter app will take control of your whatsapp web session and:
1) will start fowarding messages to the botpress chatbot
2) the responses from the chatbot will be returned back to whatsapp...

So in conclusion, puppeteer will be interfacing between your whatsapp and botpress.

The main core app is a botpress clean project, but in the initialization phase it will Fork another process with the pupetter app.
And uses NodeJS process for Inter Procees Communication.

Best regards,


