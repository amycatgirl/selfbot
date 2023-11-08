() => {
  const client = new Promise((res) => {
    setTimeout(() => {
      res(window.controllers.client.getReadyClient());
    }, 5000);
  });
  /**
    @type {string}
    Prefix that the bot uses to check whether a message is a command
  */
  const PREFIX = "::";

  /**
    @type {number}
    Maximum file size permited by autumn (in megabytes)
    Default is 20mb, but other instances may increase this number  
  */
  const MAX_SIZE = 20;

  // Dead code commented for now, I'll probably use this sooner or later
  // https://stackoverflow.com/a/7624821
  // function splitter(str, l) {
  //   var strs = [];
  //   while (str.length > l) {
  //     var pos = str.substring(0, l).lastIndexOf(" ");
  //     pos = pos <= 0 ? l : pos;
  //     strs.push(str.substring(0, pos));
  //     var i = str.indexOf(" ", pos) + 1;
  //     if (i < pos || i > pos + l) i = pos;
  //     str = str.substring(i);
  //   }
  //   strs.push(str);
  //   return strs;
  // }

  /**
    @param {string} s - Any string
    @param {number} maxBytes - Maximum ammount of bytes that a chuck needs to have

    Make chunks based on byte size

    @link https://stackoverflow.com/a/57071072
  */
  function* chunk(s, maxBytes) {
    console.log("dividing", s, "into chunks of", maxBytes, "bytes");
    const decoder = new TextDecoder("utf-8");
    let buf = new TextEncoder("utf-8").encode(s);
    while (buf.length) {
      let i = buf.lastIndexOf(32, maxBytes + 1);
      // If no space found, try forward search
      if (i < 0) i = buf.indexOf(32, maxBytes);
      // If there's no space at all, take all
      if (i < 0) i = buf.length;
      // This is a safe cut-off point; never half-way a multi-byte
      yield decoder.decode(buf.slice(0, i));
      buf = buf.slice(i + 1); // Skip space (if any)
    }
  }

  /**
    @type {Map<string, Promise<void>}
    Hashmap of available commands
  */
  const utils = new Map();

  /**
    Upload something to autumn's attachment bucket

    @param {Blob} file - Any blob that does not exeed autumn's file size limit
    @param {string} name - Name of said attachment

    @returns {Promise<string>} Vaild, single-use attachment ID
    */
  async function uploadAttachment(file, name) {
    const form = new FormData();
    form.append("file", file, name);

    console.log("uploading", name);

    const id = await fetch("https://autumn.revolt.chat/attachments", {
      method: "POST",
      body: form,
    })
      .then((response) => response.json())
      .then((json) => json.id);

    return id;
  }

  /**
    Generate a message archive and send it to the user's saved notes

    @param {string[]} ids - IDs of the messages to archive
    @param {import("revolt.js").Client} client - Revolt.JS Client
    @param {import("revolt.js").Channel} channel - Channel (or context) in which the message was sent in
    
    @returns {Promise<number>} Number of messages archived, useful to display how many were they archived successfully.
  **/
  async function generateArchive(ids, client, channel) {
    const archive = [];
    let messages_archived = 0;

    /**
      @param {string[]} ids
      */
    async function recurse(ids) {
      console.log("recursing through", ids);
      for await (const id of ids) {
        // Dirty workaround to getting messages outside of cache
        const message =
          client.messages.get(id) ?? (await channel.fetchMessage(id));

        if (!message) throw "Could not find this message...";

        if (message.reply_ids || message.replies)
          await recurse(message.reply_ids ?? message.replies, message);

        const date = new Date(message.createdAt);
        const formated_string = `${
          message.author.display_name || message.author.username
        } (${date.toDateString()} at ${date.toTimeString()})\n${
          message.content
        }\n [[link]](/server/${message.channel.server_id}/channel/${
          message.channel_id
        }/${message._id})`;

        archive.push(formated_string);

        messages_archived++;
        console.log("archived", messages_archived, "message(s) so far");
      }
    }

    const notes = await client.user.openDM();

    await recurse(ids);

    // Log the date of the archive and store it
    const finishedDate = new Date();

    console.log("archive generated at", finishedDate.toDateString());
    console.log("generating files");

    const toSend = archive.join("\n");

    // Instead of sending the message right away, why don't I make a txt file and send the contents there?
    // That removes the need to split the messages into different messages and it's more bandwidth efficient (i think)
    // But then we have the problem of sending a massive file (if i ever decide to make a channel archival mode or something)

    // mmm idk, i'll leave that for future me to figure out (hiiiiii, future me here. Why the fuck did you have to think about this)
    // Problem is, this is just 1 blob. I am probably going to have more than one blob.

    // Do i really need to make this an array then upload all elements one by one?
    // I'll make this a Blob[] since I might have more than 1 blob here.

    // Amy why did you leave this undefined
    /** @type {Blob[]} */
    let blobs = [];

    if (new TextEncoder().encode(toSend).length > MAX_SIZE * 1000000) {
      // Here is where I, somehow, split a fucking blob to make it fit within the max size
      const ContentChunks = chunk(toSend, MAX_SIZE * 1000000);

      // Loop through all generated chunks and make blobs out of them. Then push those blobs into the array
      for (const chunk of ContentChunks) {
        const blob = new Blob([chunk], { type: "text/txt" });
        console.log("adding", blob.type, "to array");
        blobs.push(blob);
      }
    } else {
      blobs.push(new Blob([toSend], { type: "text/txt" }));
    } // else do absolutely nothing with it :trol:

    // Ok, now for the cool part, uploading each and every single blob into autumn and getting the ids into
    // an array.
    /** @type {string[]} */
    let attachments = [];

    for await (const [index, value] of blobs.entries()) {
      // I guess I won't reach a rate limit any time soon right?
      // :clueless:
      const id = await uploadAttachment(
        value,
        `archive_${finishedDate.getDay()}_${finishedDate.getMonth()}_${finishedDate.getFullYear()}_(${
          index + 1
        }/${blobs.length}).md`,
      );

      attachments.push(id);
    }

    console.log("sending", attachments);

    await notes.sendMessage({
      content: "Hiiiiii here is your archive sweetie :33333",
      attachments: attachments,
    });

    return messages_archived;
  }

  /**
    @param {string} name
    @param {Promise<void>} callback
  **/
  function registerUtility(name, callback) {
    utils.set(name, callback);
  }

  /** @type {import("revolt.js").Client} **/
  client.then((c) => {
    if (c) console.log("hewwo :3\nselfbot is loaded ^^");

    registerUtility("addnote", async (args) => {
      await c.user
        .openDM()
        .then((channel) => channel.sendMessage(args.join(" ")));
    });

    registerUtility("listenbrainz", async (_, message) => {
      if (message.channel)
        await message.channel.sendMessage(
          "My listenbrainz: https://listenbrainz.org/user/amycatgirl",
        );
    });

    registerUtility("archive", async (args, message) => {
      /** @type {string[]} **/
      const replies =
        args.length > 0
          ? message.reply_ids
            ? [...args, ...message.reply_ids]
            : args
          : message.reply_ids;

      console.log(replies);

      if (!replies)
        throw "You didn't provide any message IDs or replies to messages.";

      await generateArchive(replies, c).then((count) => {
        message.reply({
          embeds: [
            {
              title: `${c.user.username}::self`,
              description: `Archived ${count} message(s) to your Saved Notes`,
              colour: "#CCF5AC",
            },
          ],
        });
      });
    });

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
            util(args, message).catch((e) => {
              c.user.openDM().then((c) =>
                c.sendMessage({
                  content: "",
                  embeds: [
                    {
                      title: "Selfbot Exception",
                      description: `\`\`\`txt\nJS TRACEBACK:\n${e.stack}\n\`\`\``,
                      color: "#D14081",
                    },
                  ],
                }),
              );
            });
          } else {
            return;
          }
        } catch (e) {
          c.user.openDM().then((c) =>
            c.sendMessage({
              content: "",
              embeds: [
                {
                  title: "Selfbot Exception",
                  description: `\`\`\`txt\nJS TRACEBACK:\n${e.stack}\n\`\`\``,
                  color: "#D14081",
                },
              ],
            }),
          );
        }
      }
    });
  });
};
