// Copyright 2018, Google LLC.
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

'use strict';

const express = require('express');
const puppeteer = require('puppeteer');
const selector = require('./selector.js');
const crypto = require('crypto');
const fs = require('fs');
const Transform = require('stream').Transform;
const parser = new Transform();
const app = express();

var imagefilename = '';
var connections = {};
var globalchannel = "Cristian Villalba";
var chatactive = false;

var stdin = process.openStdin();

if (process.send)
{
        process.send("HEllo!");
}

process.on('message', message => {
        //console.log('message from parent:', message);
		var idfromparent = message.split("|")[0];
		var finalmessage = message.split("|")[1];
		
		var finalid = idfromparent.split(":")[1];
		
		console.log("Final id: " + finalid);
		console.log("Final message: " + finalmessage);
		
		if (finalid != '666'){
			var oldpage = connections[finalid]["mainChannel"];
			typeMessage(oldpage, finalid, finalmessage, connections[finalid]["vars"]);
		}
});

stdin.addListener("data", function(d){
        process.send("" + d);
});


parser._transform = function(data, encoding, done) {
  const str = data.toString().replace('{URLIMAGE}', '/image?imagefile=' + imagefilename).replace('{CHATURL}','/chat?chatid=' + imagefilename);
  this.push(str);
  done();
};


async function startChat(user, page, res) {
      // replace selector with selected user
      let user_chat_selector = selector.user_chat;
      user_chat_selector = user_chat_selector.replace('XXX', user);

      console.log('Starting chat!:' + user_chat_selector);
      await page.waitForSelector(user_chat_selector);
      console.log('Starting chat!');
      await page.waitFor(2000);
      console.log('Starting chat!.');
      await page.click(user_chat_selector);
      console.log('Starting chat!..');
      await page.click(selector.chat_input);

      console.log('Starting chat!...');
	  
	  const imageBuffer = await page.screenshot();
	  res.set('Content-Type', 'image/png');
	  res.send(imageBuffer);
      
	  let name = getCurrentUserName(page);

      if (name) {
        console.log('You can chat now :-)');
        
      }
      else {
       console.log('Could not find specified user "' + user + '"in chat threads\n');
      }
    }
	
async function switchChat(user, page) {
      // replace selector with selected user
      let user_chat_selector = selector.user_chat;
      user_chat_selector = user_chat_selector.replace('XXX', user);

      console.log('Starting chat!:' + user_chat_selector);
      await page.waitForSelector(user_chat_selector);
      console.log('Starting chat!');
      await page.waitFor(2000);
      console.log('Starting chat!.');
      await page.click(user_chat_selector);
      console.log('Starting chat!..');
      await page.click(selector.chat_input);

      console.log('Starting chat!...');
	  
	  let name = getCurrentUserName(page);

      if (name) {
        console.log('You can chat now :-)');
        
      }
      else {
       console.log('Could not find specified user "' + user + '"in chat threads\n');
      }
    }
	

// read user's name from conversation thread
async function getCurrentUserName(page) {
      return await page.evaluate((selector) => {
        let el = document.querySelector(selector);

        return el ? el.innerText : '';
      }, selector.user_name);
    }

app.get('/image',function(req,res){
	const imagefile = req.query.imagefile;
	res.sendFile(imagefile, { root: 'temp/'});
})	


app.get('/chat',function(req,res){
	const chatid = req.query.chatid;
	//res.send('Buenisimaaaa!!! ' + chatid);
	
	var oldpage = connections[chatid]["mainChannel"];
	connections[chatid]["sessions"][globalchannel] = 1; 
	
	startChat(globalchannel,oldpage, res);
	
	// setup interval for read receipts
    if (true) {
		connections[chatid]["vars"].last_sent_message_interval = setInterval(function () {
            isLastMessageRead(globalchannel, "empty", oldpage, connections[chatid]["vars"]);
          }, 1000);
    }
	
	// see if they sent a new message
    //readLastOtherPersonMessage(oldpage, connections[imagegilename]["vars"]);
	connections[chatid]["vars"].funcReadLast = setInterval(function() {
													readLastOtherPersonMessage(oldpage, chatid ,connections[chatid]["vars"], globalchannel);
												}, 1000);
				
	connections[chatid]["vars"].funcCheckMsg = setInterval(function() {
														checkNewMessagesAllUsers(oldpage, chatid, connections[chatid]["vars"]);
												}, 2500);
				
	connections[chatid]["vars"].funcCheckIdle = setInterval(function() {
														checkIdle(oldpage, connections[chatid]["vars"]);
												}, 1000);
												
	connections[chatid]["vars"].funcCheckChat = setInterval(function() {
														checkChat(chatid, oldpage, connections[chatid]["vars"]);
												}, 3000);
})

async function checkIdle(page, vars)
{

	if (!vars.idle)
	{
		var endDate = new Date();
		var startDate = vars.last_activity;
		
		var seconds = (endDate.getTime() - startDate.getTime()) /1000;
		
		if (seconds > 25)
		{
			vars.idle = true
			console.log("Idle detected!")
		}
	}
}

async function checkChat(chatid, page, vars)
{
	let chat_active = selector.chat_active;
    
	try{
		//console.log('Starting chat!:' + chat_active);
		await page.waitForSelector(chat_active, {timeout: 1000})
			  .then(() => chatactive = true);
	}
	catch(error)
	{
		console.log("chat closed!")
		connections[chatid]["browser"].close()
		clearInterval(vars.funcReadLast)
		clearInterval(vars.funcCheckMsg)
		clearInterval(vars.funcCheckIdle)
		clearInterval(vars.funcCheckChat)
		
		delete connections[chatid]
	
		chatactive = false;
	}
}

// checks for any new messages sent by all other users
async function checkNewMessagesAllUsers(page, chatid ,vars) {
      let name = await getCurrentUserName(page);

      let user = await page.evaluate((selector) => {

        let nodes = document.querySelectorAll(selector);
        let el = nodes[0];

        return el ? el.innerText : '';
      }, selector.new_message_user);

      if (user && user != name) {
        let message = 'You have a new message by "' + user + '". Switch to that user to see the message.';
		//console.log(message);

        if (vars.last_received_message_other_user != message) {
          //print('\n' + message, config.received_message_color_new_user);

          // show notification
          //notify(user, message);
		  console.log(message)

          vars.last_received_message_other_user = message;
        }
		
		if (vars.idle)
		{
			changeUser(user, chatid ,page, vars);
		}
      }
}

async function changeUser(changeuser, chatid, page, vars)
{
	console.log("Switching to user:" + changeuser)
	clearInterval(vars.funcReadLast)
	
	globalchannel = changeuser
	switchChat(globalchannel,page);
	

	// see if they sent a new message
    //readLastOtherPersonMessage(oldpage, connections[imagegilename]["vars"]);
	vars.funcReadLast = setInterval(function() {
													readLastOtherPersonMessage(page, chatid ,connections[chatid]["vars"], globalchannel);
												}, 1000);
}


// read any new messages sent by specified user
async function readLastOtherPersonMessage(page, userid ,vars, channel) {

  let message = '';
  let name = await getCurrentUserName(page);

  if (!name) {
	return false;
  }

  // read last message sent by other user
  message = await page.evaluate((selector) => {

	let nodes = document.querySelectorAll(selector);
	let el = nodes[nodes.length - 1];

	if (!el) {
	  return '';
	}

	// check if it is picture message

	/*
	if (el.classList.contains('message-image')) {
	  return 'Picture Message';
	}
	*/

   let picNodes = el.querySelectorAll("img[src*='blob']");
   let isPicture = picNodes[picNodes.length - 1];

   if (isPicture) {
	 return 'Picture Message';
   }

	// check if it is gif message
   let gifNodes = el.querySelectorAll("div[style*='background-image']");
   let isGif = gifNodes[gifNodes.length - 1];

   if (isGif) {
	 return 'Gif Message';
   }

	// check if it is video message
	let vidNodes = el.querySelectorAll(".video-thumb");
	let isVideo = vidNodes[vidNodes.length - 1];

	if (isVideo) {
	  return 'Video Message';
	}

	// check if it is voice message
	let audioNodes = el.querySelectorAll("audio");
	let isAudio = audioNodes[audioNodes.length - 1];

	if (isAudio) {
	  return 'Voice Message';
	}

	// check if it is emoji message
	let emojiNodes = el.querySelectorAll("div.selectable-text img.selectable-text");
	let isEmoji = emojiNodes[emojiNodes.length - 1];

	if (isEmoji) {
	  return 'Emoji Message';
	}

	// text message
	nodes = el.querySelectorAll('span.selectable-text');
	el = nodes[nodes.length - 1];

	return el ? el.innerText : '';

  }, selector.last_message);


  if (message) {

	if (vars.last_received_message) {
		
	  if (vars.last_received_message != message) {
		vars.last_received_message = message;
		//print(name + ": " + message, config.received_message_color);
        console.log("mensaje de whatsapp:" + message);
		// show notification
		//notify(name, message);
		if (process.send)
		{
			vars.idle = false;
			vars.last_activity = new Date()
			process.send(userid + ":" + channel + ":" + message);
		}
	  }
	}
	else {
	  vars.last_received_message = message;
	  //print(name + ": " + message, config.received_message_color);
	}

  }
}
	

// checks if last message sent is read
async function isLastMessageRead(name, message, page, vars) {

      let is_last_message_read = await page.evaluate((selector) => {

        let nodes = document.querySelectorAll(selector);
        let el = nodes[nodes.length - 1];

        if (el) {
          let readHTML = el.outerHTML;

          if (readHTML.length) {
            return readHTML.indexOf('data-icon="msg-dblcheck-ack"') > -1;
          }
        }

        return false;
      }, selector.last_message_read);

      if (is_last_message_read) {
        //if (config.read_receipts && last_sent_message_interval) {
		if ( vars.last_sent_message_interval) {

          // make sure we don't report for same message again
          if (!vars.sentMessages.includes(message)) {


            vars.sentMessages.push(message);

            clearInterval(vars.last_sent_message_interval);
          }
        }
	  }
}

async function typeMessage(page, userid, message, vars) {
      await page.keyboard.type(message);
      await page.keyboard.press('Enter');

      // verify message is sent
      let messageSent = await page.evaluate((selector) => {

        let nodes = document.querySelectorAll(selector);
        let el = nodes[nodes.length - 1];

        return el ? el.innerText : '';
      }, selector.last_message_sent);

      if (message == messageSent) {
        //print("You: " + message, config.sent_message_color);

        // setup interval for read receipts
        if (true) {
          vars.last_sent_message_interval = setInterval(function () {
            isLastMessageRead(globalchannel, message, page, vars);
          }, 1000);
        }

      }
	  
	  vars.idle = false;
	  vars.last_activity = new Date()
	  
      // see if they sent a new message
      readLastOtherPersonMessage(page, userid ,vars);
    }

	
app.use(async (req, res) => {
  //const url = req.query.url;

  //if (!url) {
  //  return res.send('Please provide URL as GET parameter, for example: <a href="/?url=https://example.com">?url=https://example.com</a>');
  //}

  const browser = await puppeteer.launch({ /*headless: false,*/
    args: ['--no-sandbox']
  });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (Windows NT 6.3; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/64.0.3264.0 Safari/537.3');
  
  console.log('Init page!');
  await page.goto('https://web.whatsapp.com');
  //const imageBuffer = await page.screenshot();
  imagefilename = 'foo'+crypto.randomBytes(4).readUInt32LE(0)+'bar.png';
  await page.screenshot({path: 'temp/' + imagefilename });
  
  connections[imagefilename] = {};
  connections[imagefilename]["mainChannel"] = page;
  connections[imagefilename]["browser"] = browser;
  connections[imagefilename]["sessions"] = {}; 
  connections[imagefilename]["vars"] = {
										// custom vars ///////////////////////////////
										last_received_message : '',
										last_received_message_other_user : '',
										last_sent_message_interval : null,
										last_new_message_interval : null,
										last_activity : new Date(),
										idle: false,
										funcReadLast: null,
										funcCheckMsg: null,
										funcCheckIdle: null,
										funcCheckChat: null,
										sentMessages : [],
										newMessages : []
										////////////////////////////////////////////// 
  };
  
 
  res.write('<!-- Begin stream -->\n');
  fs
    .createReadStream('launch.html')
    .pipe(parser)
    .on('end', () => {
        res.write('\n<!-- End stream -->')
    }).pipe(res);
  
  //browser.close();
});

const server = app.listen(process.env.PORT || 9082, err => {
  if (err) return console.error(err);
  const port = server.address().port;
  console.info(`App listening on port ${port}`);
});
