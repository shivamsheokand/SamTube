# YouTube Multi-Player Pro Advanced

Yeh ek advanced YouTube player application hai jo intelligent proxy switching aur real user simulation ke saath multiple YouTube videos ko ek saath chalaane ki suvidha deta hai.

## Features

* **Multiple Video Playback**: Ek saath kai YouTube videos chalayein.
* **Intelligent Proxy Management**: Behtar performance ke liye proxies ko manage karta hai.
* **Real User Simulation**: Video ke saath real user behavior ko simulate karta hai, jaise ki random pause/play, seek, aur volume change.
* **Statistics Dashboard**: Total videos, total views, active proxies, aur average view time jaise live stats dekhein.
* **Customizable Options**: Autoplay, random delay, view counting, proxy rotation, aur video controls jaise options ko enable/disable karein.
* **Easy to Use Interface**: Video URL, quantity, start time, aur view duration daalne ke liye ek simple interface.

## File Structure

-   `src/`: Application ka source code.
    -   `config/`: Configuration files.
        -   `proxies.json`: Proxy aur user agent ki list.
    -   `utils/`: Utility functions.
        -   `proxyManager.js`: Proxy ko manage aur optimize karne ka logic.
        -   `videoManager.js`: Video playback, events, aur stats ko manage karne ka logic.
        -   `videoUtils.js`: Video se related utility functions.
    -   `App.jsx`: Main application component.
    -   `App.css`: `App` component ke liye styles.
    -   `main.jsx`: Application ka entry point.

## Kaise Run Karein

1.  **Dependencies Install Karein**:
    ```bash
    npm install
    ```

2.  **Development Server Start Karein**:
    ```bash
    npm run dev
    ```

3.  Apne browser mein `http://localhost:5173/` open karein.