# ⚾ Baseball Tagger App

A  web application built to review social media posts, tag featured MLB clubs and players, evaluate AI-generated tags, and automatically sync tagged data directly into a shared Google Sheet.

---

## Live App Link

* **Live Web App:** Go to your repository settings on GitHub ➔ **Pages** ➔ Click the link under *"Your site is live at..."*
* **Live Google Sheet:** [View Tagging Data Spreadsheet](https://docs.google.com/spreadsheets/d/1KBwIRQJfqaLDreLcYEgOpEICcuPwn2hYq-FELNkkg7I/edit?gid=0#gid=0)

---

## Key Features

* **Modes:** Switch between **Create Source of Truth Tag** (standard manual tagging) and **Evaluate AI Tagging** (reviewing and correcting pre-tagged AI tags).
* **Multi-Platform Embed Support:** Video and post players for TikTok, Instagram, Twitter/X, and Facebook.
* **Smart Team & Roster Dropdowns:** Powered by TomSelect for fast, searchable MLB team and player selection.
* **Automatic Player Headshots:** Pulls official MLB headshot pictures when a player is selected.
* **AI Prediction Pre-filling:** In AI Evaluation mode, form fields automatically populate with AI tags and show visual AI content descriptions.
* **Advanced Queue Filtering & Sorting:** Filter your queue by platform, post type, tagged/untagged status, publication date range, or sort order (Oldest First, Newest First, Random).
* **Google Sheets Backend Sync:** Submits tag payloads in real-time to the appropriate tab in Google Sheets (`Source of Truth Tags` vs `AI Evaluation Tags`).

---

## Repository File Overview

* **`index.html`** — The webpage structure (holds the filters, video player, post details, tagging form, and popups).
* **`app.js`** — The main code that makes the app work (loads posts, handles buttons, filters data, loads headshots, and saves to Google Sheets).
* **`styles.css`** — The design file that controls colors, fonts, layouts, and how everything looks.
* **`posts.json`** — The list of social media posts for regular manual tagging (Source of Truth mode).
* **`ai_posts.json`** — Dataset containing AI predictions and text descriptions for **AI Evaluation** mode.
* **`rosters.json`** — MLB team lists, player jersey numbers, and photo IDs used to show headshots.
* **`googleSheets/`** — Folder containing the backend Google Apps Script code (`doGet` and `doPost`) deployed to manage reads/writes with Google Sheets.
* **`convert_data.py`** — Helper Python script to parse exported BigQuery CSV files and format them into clean `posts.json` or `ai_posts.json` files.
* **`media_query/`** — SQL querie used to pull post data from BigQuery.
* **`MLB_Roster/`** — SQL querie used to update pull  MLB team rosters.
* **`README.md`** — This documentation guide!

---
##  Dual Tagging Modes Explained

When launching the app, users choose their tagging objective inside the welcome modal:

### 1. Create Source of Truth Tag
* **Dataset Used:** `posts.json`
* **Destination Tab:** `Source of Truth Tags`
* **Use Case:** Human taggers establish baseline ground truth data from scratch.

### 2. Evaluate AI Tagging
* **Dataset Used:** `ai_posts.json`
* **Destination Tab:** `AI Evaluation Tags`
* **Use Case:** Form fields (Club, Player, Objective, Score Graphic) pre-fill with AI tags. An **AI Description** box renders below the post preview, allowing the tagger to review, modify, and verify AI accuracy.

---

## Google Apps Script Setup

The app connects to a Google Apps Script linked to your Google Sheet to save tags and load already-tagged posts.

### 1. Set Up of Google Sheets
Two tabs named:
* **`Source of Truth Tags`**
* **`AI Evaluation Tags`**

#### Column Order (Columns A to O):
`Timestamp` | `Tagger Name` | `Post ID` | `Page Account` | `Channel` | `Post Type` | `Post Date` | `Club` | `Player` | `Event` | `Objective` | `Score Graphic` | `Freeform` | `Post URL` | `Post Content`


### 2. Deploy the Script (`googleSheets/`)
1. In your Google Sheet, click **Extensions** ➔ **Apps Script**.
2. Copy and paste the code from the `googleSheets/` folder in this repo.
3. Click **Deploy** ➔ **Manage deployments**.
4. Click the **Pencil icon (Edit)** and set **Version** to **New version**.
5. Set **Who has access** to **Anyone** (this lets the web app talk to your sheet).
6. Click **Deploy**, copy the Web App URL, and paste it into `SHEET_URL` in `app.js`.

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

### `ai_posts.json` (AI Predictions & Descriptions)
Stores post data pre-filled with AI-generated predictions and descriptions for **AI Evaluation** mode:
* **`post_id`**: Unique ID number for the post.
* **`focal_club`**: AI-predicted MLB team featured in the post.
* **`focal_player`**: AI-predicted player featured in the post (`None` if no specific player).
* **`objective`**: AI-predicted target goal (`1` for New Audience, `0` for Current Fans).
* **`score_graphic`**: AI prediction for whether the post is a score graphic (`1` for Yes, `0` for No).
* **`text_description`**: Detailed visual AI description of what is happening in the post.
* **`post_date_pt`**: The date the post was published.
* **`channel`**: The social platform (TikTok, Instagram, Twitter, Facebook).
* **`post_type`**: Type of post (Carousel, Video, Reel, etc.).
* **`post_url`**: Link to the original post.
* **`post_content`**: The post's caption text.

```json
[
  {
    "post_id": "3942726679886012464_52762453",
    "focal_club": "Chicago Cubs",
    "focal_player": "None",
    "objective": "1",
    "score_graphic": "0",
    "text_description": "The iconic red marquee of Wrigley Field stands proud...",
    "post_date_pt": "2026-07-16",
    "channel": "Instagram",
    "post_type": "Carousel",
    "post_url": "[https://www.instagram.com/p/Da3YQahD6Aw/](https://www.instagram.com/p/Da3YQahD6Aw/)",
    "post_content": "The 2027 All-Star Game is coming to Wrigley Field!"
  }
]
```
---
## How to Make Changes to the Codebase

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

---

#### Using GitHub Desktop:
1. Open **GitHub Desktop** and select the `baseball-tagger` repository.
2. Click **Fetch origin** at the top to ensure you have the newest code.
3. Make your edits in your preferred text editor and save your files.
4. Return to GitHub Desktop — your changed files will appear in the left sidebar.
5. Type a summary in the **Summary** box at the bottom left, then click **Commit to main**.
6. Click **Push origin** at the top bar to push the updates live.

---

## How to Update Posts from BigQuery

When you pull a fresh table or new list of posts from BigQuery, follow these steps to update the queue in your app:

### Step 1: Export from BigQuery
1. Run your SQL query in the **BigQuery Console**.
2. Click **SAVE RESULTS** ➔ **Google Drive (CSV)** or download as a CSV file to your computer.

### Step 2: Convert CSV to `posts.json`
1. Move the downloaded CSV file into your `baseball-tagger` folder in VS Code.
2. Open your terminal in VS Code (`Ctrl + ~`) and run your conversion script (below). This automatically transforms your CSV rows into a clean posts.json file.
   ```bash
   python convert_data.py
  
### Step 3: Publish Updates to the Live Web App
1. Open the Source Control tab in VS Code (Ctrl + Shift + G).
2. Type a message in the input box (e.g., "Updated post queue").
3. Click Commit, then click Sync Changes. GitHub Pages will automatically add your new posts to the live site within 1–2 minutes

---

## Local Testing with VS Code Live Server

When testing changes on your computer, follow these steps.

1. Open **VS Code** and go to the **Extensions tab** (`Ctrl + Shift + X`).
2. Search for **Live Server** (by Ritawick Dey) and click **Install**.
3. Right-click anywhere inside `index.html` and select **Open with Live Server**.
4. Your default browser will launch at `http://127.0.0.1:5500`.
