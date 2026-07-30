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

## How to Update Posts from BigQuery

When you pull a fresh table or new list of posts from BigQuery, follow these steps to update the queue in your app:

### Step 1: Export from BigQuery
1. Run your SQL query in the **BigQuery Console**.
2. Click **SAVE RESULTS** ➔ **Google Drive (CSV)** or download as a CSV file to your computer.

### Step 2: Convert CSV to `posts.json`
1. Move the downloaded CSV file into your `baseball-tagger` folder in VS Code.
2. Open your terminal in VS Code (`Ctrl + ~`) and run your conversion script, changing line 4:
   ```bash
   python convert_data.py

### Step 3: Publish Updates to Live Site
1. Go to the Source Control tab in VS Code (Ctrl + Shift + G).
2. Type a message like "Updated posts queue".
3. Click Commit, then click Sync Changes. Within 1 minute, your live link will update with the new posts for all taggers!

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
