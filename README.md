## Meaning

App, that looks everywhere on the internet to update your media library with song lyrics. 

![alt text](https://i.imgur.com/yVFiEl3.png)

### Goals

* Support for every free lyrics API.
* Cross-platform (Windows, Linux, MacOS).
* Ability to create media library from user's audio collection  quickly, and handle it without a hitch, even if it has over 100.000 files.
* Pretty, responsive and functional interface.

### Built with

* `Electron`, as a way-to-go for cross-platform apps.
* `React` for rendering/struncturing of app.
* `electron-remote` to offload heavy tasks, like creating media library, to background processes, with fully usable rendering process. Process count depends on system core count.
* `Javascript` in ES2016 style, using async/await to not fall into callback/promise hell.
* Own fork of `node-taglib2` (Node native binding to great C++ `Taglib2` library) to do read/write on common audio formats without destruction of file/metadata.

### WIP status

* Work on PRs for dependencies - 100%
* Media library - 90%
* Interface - 70%
* Audio read/update - 100%
* Lyric services integration - 0%