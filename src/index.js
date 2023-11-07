() => {
  const client = new Promise((res) => {
        setTimeout(() => {
          res(window.controllers.client.getReadyClient())
        }, 5000)
      });

  const PREFIX = "::";

  // https://stackoverflow.com/a/7624821
  function splitter(str, l){
      var strs = [];
      while(str.length > l){
          var pos = str.substring(0, l).lastIndexOf(' ');
          pos = pos <= 0 ? l : pos;
          strs.push(str.substring(0, pos));
          var i = str.indexOf(' ', pos)+1;
          if(i < pos || i > pos+l)
              i = pos;
          str = str.substring(i);
      }
      strs.push(str);
      return strs;
  }  

  /** @type {Map<string, Promise<(arguments: string[], context: import("revolt.js").Message) => void>>}**/
  const utils = new Map();

  /**
    @param {string[]} ids
    @param {import("revolt.js").Client} client
    @param {import("revolt.js").Channel} channel
    @returns {Promise<number>}
  **/
  async function generateArchive(ids, client, channel) {
    const archive = [];
    let messages_archived = 0;
    // get messages from id
    // check if message has replies, if so, recurse
    // if not, then add message to array
    // next one
    /**
      @param {string[]} ids
      */
    async function recurse(ids) { 
      for await (const id of ids) {
        // Dirty workaround to getting messages outside of cache
        const message = client.messages.get(id) ??
                        await channel.fetchMessage(id)
        
        console.log("got message", message);
        
        if (message.reply_ids ||  message.replies) await recurse(message.reply_ids ?? message.replies, message);

         
        const date = new Date(message.createdAt);
        const formated_string = `${message.author.display_name || message.author.username} (${date.toDateString()} at ${date.toTimeString()})\n${message.content}\n [[context]](/server/${message.channel.server_id}/channel/${message.channel_id}/${message._id})`;

        archive.push(formated_string);

        messages_archived++;
      }
    }
    
    const notes = await client.user.openDM();

    await recurse(ids);

    // if there aren't more ids then stop    
    // join archive
    const toSend = archive.join("\n");

    // check if message can be sent
    if (toSend.length > 2000) {
      // if not, split then send batches one by one
      const split = splitter(toSend, 2000);
      const allMessages = split.map(async (m) => {
        console.log("sending", m);
        await notes.sendMessage(m)
      });

      await Promise.all(allMessages);

    } else {
      // if it can, then send full message
      await notes.sendMessage(toSend);
    }

    return messages_archived;
  }

  /**
    @param {string} name
    @param {Promise<(arguments: string[], context: import("revolt.js").Message) => void>} callback
  **/
  function registerUtility(name, callback) {
    utils.set(name, callback);
  } 
  
  /** @type {import("revolt.js").Client} **/
  client.then((c) => {
    if (c) console.log("hewwo :3\nselfbot is loaded ^^");
    
    registerUtility("addnote", async (args) => {
      await c.user.openDM().then(channel => channel.sendMessage(args.join(" ")));
    })

    registerUtility("listenbrainz", async (_, message) => {
      if (message.channel)
      await message.channel.sendMessage("My listenbrainz: https://listenbrainz.org/user/amycatgirl");
    })
    
    registerUtility("archive", async (args, message) => {
      /** @type {string[]} **/
      const replies = args.length > 0 ? message.reply_ids ? [...args, ...message.reply_ids] : args : message.reply_ids;

      console.log(replies);

      if (!replies) throw "You didn't provide any message IDs or replies to messages.";
      
      await generateArchive(replies, c).then((count) => {
        message.reply({
          embeds: [
            {
              title: `${c.user.username}::self`,
              description: `Archived ${count} message(s) to your Saved Notes`,
              colour: "#CCF5AC"
            }
          ]
        })
      })
    })

    c.on("message", async (message) => {
      /** @type {boolean} **/
      const isMe = message.author._id === c.user._id;
      const containsPrefix = message.content.startsWith(PREFIX) || false;
      const args = message.content.slice(PREFIX.length).trim().split(/ +/);
      const command = args.shift().toLowerCase();

      if (isMe && containsPrefix) {
        try {
          /** @type {Promise<(args: string[], message: import("revolt.js").Message) => void>} */
          const util = utils.get(command);

          if (util) {
            util(args, message).catch((e) => { throw e });
          } else {
            return
          }
        } catch (e) {
          c.user.openDM().then((c) => c.sendMessage({
            content: "",
            embeds: [
              {
                title: "Selfbot Exception",
                description: `\`\`\`txt\nJS TRACEBACK:\n${e.stack}\n\`\`\``,
                color: "#D14081"
              }
            ]
          }));
        }
      }
    })
  });
};
