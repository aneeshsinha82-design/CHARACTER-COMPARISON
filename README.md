# Character Studio

A lightweight browser app for collecting character images. The first module supports selecting multiple image files, drag and drop, a responsive gallery, and removing images from the current session.

## Run locally

Requires Node.js 18 or newer.

```sh
npm run dev
```

Create a production build with `npm run build`, then preview it with `npm run preview`.

## Upload behavior

Images are held as browser object URLs in memory for the current page session. They are not uploaded to a server or saved after the page is closed. The character data model and gallery renderer are separate modules so later studio features can extend them without changing the upload interface.
