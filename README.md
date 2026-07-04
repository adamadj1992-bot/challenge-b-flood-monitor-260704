# Challenge B: UK Flood Station Monitor

This is a standalone static website for Challenge B.

The app uses browser-side JavaScript to call the Environment Agency Flood Monitoring JSON API. Users can search for a place, select a monitoring station, and load recent readings from the API.

## Files

- `public/index.html`: static page
- `public/app.css`: styling
- `public/app.js`: API calls and UI logic
- `firebase.json`: Firebase Hosting config
- `netlify.toml`: optional Netlify config

## Firebase deployment

The deployed Firebase Hosting URL is:

https://challenge-b-flood-260704.web.app/

The Firebase project ID is `challenge-b-flood-260704`.

To redeploy from this folder:

```sh
firebase login --reauth
firebase deploy --only hosting --project challenge-b-flood-260704
```

## Submission evidence

Capture screenshots from the deployed public URL showing:

- Search results after entering a place such as `York` or `Carlisle`
- Station detail after clicking a station, showing readings, chart, table, and API request log
- Browser address bar showing a public Firebase/Netlify URL, not `localhost`
