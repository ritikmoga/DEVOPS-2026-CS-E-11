# EventHub Frontends

This folder contains two vanilla HTML, CSS, JavaScript and jQuery frontends:

- `public-client`: public EventHub website
- `admin-client`: admin EventHub dashboard

Run the public site on port `5173` and the admin site on port `5174`. The repository root also contains the Jenkins CI configuration used to verify both frontends.

Each frontend loads `src/app.js`, reads its API settings from `src/config.json`, and uses jQuery for DOM rendering, navigation, forms and AJAX requests. No frontend framework or compile-to-JavaScript source language is used.
