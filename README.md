# Vanik Edge prototype preview

A click-through preview of Vanik Edge: the console (Vanik OS), VanikGPT and Vanik Sense, with Document processing, Vanik Desk, Vanik Echo, Vanik Scout and Vanik MeasureBook beside them.

- The console and VanikGPT show the MVP release only. Vanik Sense shows the MVP and the release after it: the kind of call on every meeting, insights for each kind, a first screen that says what to do next, a library, and a transcript added by hand.
- Everything runs in your browser. The server is a service worker and data is kept in this browser only.
- It opens on a sample workspace: five people, three knowledge collections, finished chats, and in Vanik Sense a meeting of every kind of call.
- No model is connected. New questions in VanikGPT are answered straight from the documents and say so. Vanik Sense reads meetings by plain rules; nothing is sent to Teams, Slack or email.
- MeasureBook does not read a drawing and Echo does not listen to a meeting. Their sample content is stored, and new content is typed or pasted.
- A new build is picked up by itself the next time the page is opened. To start again with fresh sample data, clear this site's data in the browser.

Start: pick the owner account. Vanik OS opens on Home; the apps are under Apps.
