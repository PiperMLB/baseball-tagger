# Baseball Tagger App

A simple web app built to help team members view social media posts, tag the MLB team and player featured in each post, and automatically save those tags into a shared Google Sheet.

---

## Live App Link

Use the link below to open and use the live application:
* **Live Web App:** `(https://pipermlb.github.io/baseball-tagger/)`

---

## What This App Does

* **Plays Videos & Posts:** Displays posts directly from TikTok, Instagram, Twitter/X, and Facebook.
* **Team & Player Search:** Searchable drop down make it fast to find any team or player.
* **Shows Player Headshots:** Automatically shows an official picture of the player as soon as you select their name.
* **Flexible Filters:** Filter your post queue by platform, post type, tagged/untagged status, or date range.
* **Sort Your Queue:** Choose to view posts from Oldest to Newest, Newest to Oldest, or in Random order.
* **Saves to Google Sheets:** Click "Save Tag & Next" to instantly send the tag data straight to a shared Google Sheet.

---

## Files in This Project

* **`index.html`** — The visual layout of the app (buttons, forms, filter bars, video containers).
* **`app.js`** — The main code that makes everything work (loading posts, filtering, showing headshots, and saving tags).
* **`styles.css`** — Controls the design, colors, font sizes, and layout spacing.
* **`posts.json`** — The list of all social media posts currently waiting to be tagged.
* **`rosters.json`** — The team rosters, player jersey numbers, and MLB player picture IDs.
* **`convert_data.py`** — A quick helper script to convert downloaded CSV data into the `posts.json` file.
* **`README.md`** — This documentation file!

---

## How Data Files Work

### `posts.json` (List of Posts)
Stores information about each post in the queue, including:
* **`post_id`**: Unique ID number for the post.
* **`channel`**: The social platform (TikTok, Instagram, Twitter, Facebook).
* **`post_type`**: Type of post (Video, Photo, Reel, etc.).
* **`post_url`**: Link to the original post.
* **`post_content`**: The post's caption text.
* **`post_date_pt`**: The date the post was published.

### `rosters.json` (Team & Player Lists)
Lists each MLB team along with their players, jersey numbers, and MLB picture IDs:
```json
[
  {
    "home_team_full_name": "Tampa Bay Rays",
    "player_list": [
      "Aaron Civale (#38) - ID: 650644",
      "Jose Castillo (#66) - ID: 620454"
    ]
  }
]
```
---
## 🛠️ How to Make Changes to the Codebase

If you need to update team rosters, fix styling, adjust logic, or add features, you can do so directly on GitHub or locally on your computer.

### Option 1: Quick Edits Directly on GitHub (No Software Needed)

*Best for quick text updates, fixing typos, or updating `rosters.json`.*

1. **Navigate to the Repository:** Go to the main project page on GitHub in your browser.
2. **Select the File:** Click on the file you want to change (for example, `rosters.json` or `README.md`).
3. **Open the Editor:** Click the **Pencil Icon** in the upper right corner to enter edit mode.
4. **Make Your Changes:** Edit the text or JSON directly inside the browser window.
5. **Save Changes:** 
   * Click the green **Commit changes...** button in the top right.
   * Enter a short description of what you changed (e.g., *"Added new player to Rays roster"*).
   * Ensure **Commit directly to the `main` branch** is selected, then click **Commit changes**.
6. **Publish Live:** GitHub Pages will automatically update the live app with your changes within 1–2 minutes!

> **Important for Local Developers:** If changes are made directly on GitHub, anyone working on the code locally in VS Code must run a **Pull** (`Sync Changes`) to download the updates before making further changes.

---

### Option 2: Editing Locally with VS Code or GitHub Desktop

*Best for testing structural code changes, UI design updates, or logic in `app.js` and `styles.css`.*

#### Using VS Code:
1. **Open Project:** Launch VS Code and open the `baseball-tagger` folder.
2. **Pull Latest Version:** Go to the **Source Control** tab (`Ctrl + Shift + G`) click the **`...` (More Actions)** menu at the top, and select **Pull** to get the latest code.
3. **Make & Test Edits:** Edit your files and test them locally using **Live Server** on `index.html`.
4. **Save & Commit:**
   * Open **Source Control** (`Ctrl + Shift + G`).
   * Type a clear commit message describing your updates in the message box.
   * Click **Commit**.
5. **Sync to GitHub:** Click **Sync Changes** to push your work live to GitHub Pages.

#### Using GitHub Desktop:
1. Open **GitHub Desktop** and select the `baseball-tagger` repository.
2. Click **Fetch origin** at the top to ensure you have the newest code.
3. Make your edits in your preferred text editor and save your files.
4. Return to GitHub Desktop — your changed files will appear in the left sidebar.
5. Type a summary in the **Summary** box at the bottom left, then click **Commit to main**.
6. Click **Push origin** at the top bar to push the updates live.
