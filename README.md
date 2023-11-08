# Amy's Revolt Selfbot

Overcomplicated, cache-destroying, unoptimized selfbot that I *sometimes* use on revolt. Installable as a
[revite plugin](https://developers.revolt.chat/plugin-api)

## Installing it

This selfbot, for some odd reason, only works under developer mode (aka. unminified)

To build it from source, clone the repo, install `revite-generate-plugin`'s dependencies and run `pnpm build:dev`

After it's done building (usually takes 1 or 2 seconds), you will have the build json file in `target/plugin.json`

Copy the contents of said file and paste them inside of revolt-desktop's (or any browser's) console. The contents need
to be inside of `state.plugins.add(<paste_here>)`

> Note: You need to enable plugins in settings > experiments
