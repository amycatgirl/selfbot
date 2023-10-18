() => {
  /**
    Build a new logger with a custom name, inteded to be
    used by plugins
    @class
    **/
  class CustomLogger {
    /** @type {string} **/
    name;
    /** @type {string} **/
    colour;
    
    constructor(name, colour) {
      this.name = name;
      this.colour = colour;
    }

    log(...data) {
      console.log(
      `%c[${this.name}] ::%c`,
      `font-weight: bold; color: ${this.colour}`,
      "font-weight: initial; color: initial",
      ...data,
      )
    }
  }
  window.utils = {};
  
  // Allow other plugins to use this under the Utils Object  
  window.utils.CustomLogger = CustomLogger; 
  const debugCustomLogger = new CustomLogger("revite-utils", "#FD6671");
  
  /**
    Use Modals with ease, without having to fiddle with the controllers.modal class
    @class
  **/
  class ModalHelper {
    /**
      @readonly
      @type {string}
      **/
    type;
    /**
      @readonly
      @type {object}
    **/
    data;
    /**
      @param {string} type - Modal Type
      @param {object} data - Data to pass to the modal
      **/
    constructor(type, data) {
      this.type = type;
      this.data = data;
    }

    get Type() {
      return this.type;
    }

    get Data() {
      return this.data;
    }

    showModal() {
      const data = this.data;

      debugCustomLogger.log("About to show modal", type, "with the following data:", data);

      controllers.modal.push({
        type: this.type,
        ...data
      })
    }
  }

  // Expose the ModalHelper class to window
  window.utils.ModalHelper = ModalHelper;

  /**
    Generate a random number between 0 and limit
    @param {number} limit
    **/
  function rng (limit) {
    return Math.floor(Math.random() * limit);
  }

  window.utils.rng = rng;

  /**
    Show the channel description modal using custom data
    Doesn't depend on ModalHelper
    @param {string} title - Title of the modal
    @param {string} message - Contents of the modal
    **/
  window.utils.showCustomChannelModal = function(title, message) {
    controllers.modal.push({
      type: "channel_info",
      channel: {
        name: title,
        description: message
      }
    });
  }

  /**
    Find who and what was reacted to a message
    Depends on ModalHelper
    @param {string} message Valid message ID
    **/
  window.utils.GetReactions = function(message) {
    /** @type {import("revolt.js").Client} **/
    const client = window.controllers.client.getReadyClient();

    if (!client) throw "Couldn't get a valid client, aborting";

    debugCustomLogger.log("Got ready client:", client);

    const foundMessage = client.messages.get(message);

    if (!foundMessage) throw "Couldn't find message in cache, aborting";

    debugCustomLogger.log("Found message:", foundMessage);

    const reactions = foundMessage.reactions.data_;

    /** @type {string[]} **/
    const reactionData = [];

    for (const [key, value] of reactions) {
      debugCustomLogger.log("Pushing", key, value, "to Array");
      reactionData.push(
        `:${key}:: ${Array.from(value.get().values())
          .map(
            (value) => `<@${value}>`)
          .join(", ")}`
      );
    }

    /** @type {string} **/
    const finalMessage = reactionData.join("\n");

    const ReactionModal = new ModalHelper("channel_info", {
      channel: {
        name: "Reactions",
        description: finalMessage
      }
    });

    ReactionModal.showModal();
  };

  /**
     Set a custom notification sound with ease
     @param {"message" | "outbound" | "call_join" | "call_leave"} sound
     @param {string} url
     **/
  window.utils.SetCustomSound = function(sound, url) {
    const lastState = window.state.settings.get("notifications:sounds");
    window.state.settings.set("notifications:sounds", {
      ...lastState,
      [sound]: {
        path: url,
        enabled: true,
      },
    });

    debugCustomLogger.log("Set custom sound", sound, "to", url);
  };

  /**
     mmmm, scrambled eggs
     @param {number} amount
     **/
  window.utils.scrambleServers = function(amount) {
    /** @type {import("revolt.js").Server[]} **/
    const orderedServers = window.state.ordering.orderedServers;
    for (let i = 0; i <= amount; i++) {
      const server = Math.floor(Math.random() * (orderedServers.length - 1));
      const where = Math.floor(Math.random() * (orderedServers.length - 1));
      debugCustomLogger.log("Moving server in position", server, "to position", where);
      window.state.ordering.reorderServer(server, where);
    }

    return true;
  };

  /**
     Toggle current theme's base.
     **/
  window.utils.toggleTheme = function() {
    /** @type {"light" | "dark"} **/
    const currentTheme = window.state.settings.theme.getBase()

    debugCustomLogger.log("Changing theme from", currentTheme, "to", currentTheme === "light" ? "dark" : "light");

    switch (currentTheme) {
      case "light":
        window.state.settings.theme.setBase("dark");
        break;
      case "dark":
        window.state.settings.theme.setBase("light");
        break;
      default:
        throw "Can't find current theme's base";
    }
  }

  debugCustomLogger.log("Revite Plugin Utilities v1.0.0 has been loaded!")

  // TODO: Move this into a separate plugin  
  window.theFunnyValueThatDefinitelyDoesntAffectAnythingInParticular =
    rng(2500000);

  setInterval(() => {
    window.utils.scrambleServers(1);
  }, window.theFunnyValueThatDefinitelyDoesntAffectAnythingInParticular);
};
