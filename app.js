/* BASEBALL TAGGER - MAIN APPLICATION LOGIC (app.js)
  What this file does:
  1. Manages state for posts, rosters, filters, and user session (tagger name)
  2. Initializes search dropdowns for MLB Clubs and Players
  3. Gets data from external files (`rosters.json`, `posts.json`) and syncs already tagged posts directly from Google Sheets.
  4. Renders responsive social media embeds (TikTok, Instagram, Facebook, X/Twitter).
  5. Handles user interactions (submitting tags, skipping posts, filtering queue).
*/

// ============================================================================
// 1. GLOBAL CONFIGURATION & STATE VARIABLES

// Array holding all original posts loaded from `posts.json`
let ALL_POSTS = [];
// Array holding only the posts that match the user's active filter selections
let FILTERED_POSTS = [];
// Pointer keeping track of which post in `FILTERED_POSTS` is currently displayed
let currentPostIndex = 0;
// Central database object storing parsed team rosters
// Structure: { "Team Name": [{ name: "Player Name (#Jersey)", id: "12345" }] }
let ROSTER_DATABASE = {};
// Retrieves the tagger's name saved in browser LocalStorage (persists across refreshes)
let taggerName = localStorage.getItem('taggerName') || '';
// Global instances for TomSelect searchable dropdown components
let clubTomSelect = null;
let playerTomSelect = null;
// The Google Apps Script Web App Endpoint URL that writes tags into Google Sheets
const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbypxBeKJHQgPgQHj0PAXGkPG6gTfLlNccibh8f_y5qfi2eCrX1bXxmeCmoZnzaUR1AEZw/exec";
// A Set storing unique IDs of posts that have already been tagged
let TAGGED_POST_IDS = new Set();


// ============================================================================
// 2. DOM CONTENT LOADED - MAIN INITIALIZATION
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded. Initializing app...");

  // A. initialize tagger name / modal 
  initTaggerName();

  // B. initialize TomSelect Dropdowns 
  const clubElem = document.getElementById('club-dropdown');
  if (clubElem) {
    clubTomSelect = new TomSelect('#club-dropdown', {
      create: false,
      openOnFocus: true,
      placeholder: "Search or select MLB club...",
      sortField: { field: "text", order: "asc" },
      maxOptions: 50
    });
  } else {
    console.error("Missing #club-dropdown element!");
  }

  const playerElem = document.getElementById('player-dropdown');
  if (playerElem) {
    playerTomSelect = new TomSelect('#player-dropdown', {
      create: false,
      openOnFocus: true,
      placeholder: "Select a Club first...",
      sortField: { field: "text", order: "asc" },
      maxOptions: 200
    });
  }

  // C. load rosters JSON 
  fetch('rosters.json')
    .then(res => res.json())
    .then(data => {
      if (clubTomSelect) clubTomSelect.clearOptions();
      
      data.forEach(row => {
        const clubName = row.home_team_full_name || row.home_Team_full_name;
        
        if (clubName) {
          let rawPlayers = Array.isArray(row.player_list) ? row.player_list : (row.player_list || '').split(',');
          
          const teamPlayers = rawPlayers.map(pString => {
            const displayName = pString.split('-')[0].trim();
            const idMatch = pString.match(/ID:\s*(\d+)/i);

            return { 
              name: displayName, 
              id: idMatch ? idMatch[1] : null  // Sets id to null if non-numeric
            };
          });

          // Save parsed team data into ROSTER_DATABASE
          ROSTER_DATABASE[clubName] = teamPlayers;
          
          // Add team option to Club dropdown
          if (clubTomSelect) {
            clubTomSelect.addOption({ value: clubName, text: clubName });
          }
        }
      });

      if (clubTomSelect) clubTomSelect.refreshOptions(false);
      console.log("Loaded rosters for " + Object.keys(ROSTER_DATABASE).length + " teams.");
    })
    .catch(err => console.error("Error loading rosters.json:", err));

  // D. load posts JSON & Sync google sheet tags 
  fetch('posts.json')
    .then(res => res.json())
    .then(data => {
      ALL_POSTS = data;
      console.log("Loaded " + ALL_POSTS.length + " posts from posts.json.");
      applyFiltersAndRender();
    })
    .catch(err => console.error("Error loading posts.json:", err));

  if (GOOGLE_SHEET_URL && GOOGLE_SHEET_URL.startsWith('http')) {
    fetch(GOOGLE_SHEET_URL)
      .then(res => res.json())
      .then(resData => {
        if (resData.status === "success" && Array.isArray(resData.taggedPostIds)) {
          resData.taggedPostIds.forEach(id => TAGGED_POST_IDS.add(String(id)));
          console.log("Synced " + TAGGED_POST_IDS.size + " existing tags from Google Sheets.");
          applyFiltersAndRender();
        }
      })
      .catch(err => console.warn("Google Sheet sync warning:", err));
  }

  // E. Event Listeners: Dropdowns & Filter Controls
  // When a Club is selected -> populate corresponding player options
  if (clubTomSelect) {
    clubTomSelect.on('change', function(selectedClub) {
      if (!playerTomSelect) return;
      
      playerTomSelect.clear();
      playerTomSelect.clearOptions();
      hidePlayerHeadshot();

      if (selectedClub && ROSTER_DATABASE[selectedClub]) {
        ROSTER_DATABASE[selectedClub].forEach(p => {
          playerTomSelect.addOption({ value: p.name, text: p.name, playerId: p.id });
        });
        playerTomSelect.enable();
        playerTomSelect.refreshOptions(false);
      } else {
        playerTomSelect.disable();
      }
    });
  }

  // When a Player is selected -> render official MLB headshot
  if (playerTomSelect) {
    playerTomSelect.on('change', function(selectedPlayerName) {
      if (!selectedPlayerName) {
        hidePlayerHeadshot();
        return;
      }
      
      const selectedOption = playerTomSelect.options[selectedPlayerName];
      if (selectedOption && selectedOption.playerId && selectedOption.playerId !== 'null') {
        const headshotUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png/v1/people/${selectedOption.playerId}/headshot/67/current`;
        const imgElem = document.getElementById('player-headshot-img');
        const containerElem = document.getElementById('player-headshot-container');
        
        if (imgElem && containerElem) {
          imgElem.src = headshotUrl;
          containerElem.style.display = 'block';
        }
      } else {
        hidePlayerHeadshot();
      }
    });
  }

  // Filter Bar listeners
  const filterPlatform = document.getElementById('filter-platform');
  const filterPostType = document.getElementById('filter-post-type');
  const filterStatus = document.getElementById('filter-status');
  const filterStartDate = document.getElementById('filter-start-date');
  const filterEndDate = document.getElementById('filter-end-date');
  const filterSort = document.getElementById('filter-sort');

  if (filterPlatform) filterPlatform.addEventListener('change', applyFiltersAndRender);
  if (filterPostType) filterPostType.addEventListener('change', applyFiltersAndRender);
  if (filterStatus) filterStatus.addEventListener('change', applyFiltersAndRender);
  if (filterStartDate) filterStartDate.addEventListener('change', applyFiltersAndRender);
  if (filterEndDate) filterEndDate.addEventListener('change', applyFiltersAndRender);
  if (filterSort) filterSort.addEventListener('change', applyFiltersAndRender);

  setupFormHandlers();
});


// ============================================================================
// 3. TAGGER NAME MODAL LOGIC
function initTaggerName() {
  const modal = document.getElementById('name-modal');
  const taggerInput = document.getElementById('tagger-name-input');
  const saveBtn = document.getElementById('save-name-btn');
  const nameDisplay = document.getElementById('tagger-name-display');
  const changeNameBtn = document.getElementById('change-name-btn');

  function updateTaggerUI() {
    if (taggerName) {
      if (nameDisplay) nameDisplay.textContent = taggerName;
      if (modal) modal.style.display = 'none';
    } else {
      if (nameDisplay) nameDisplay.textContent = 'Not Set';
      if (modal) modal.style.display = 'flex';
    }
  }

  updateTaggerUI();

  if (saveBtn) {
    saveBtn.addEventListener('click', function(e) {
      e.preventDefault();
      
      const inputVal = taggerInput ? taggerInput.value.trim() : '';
      if (!inputVal) {
        alert("Please enter your name before starting!");
        return;
      }

      taggerName = inputVal;
      localStorage.setItem('taggerName', taggerName);

      updateTaggerUI();
      applyFiltersAndRender();
    });
  }

  if (changeNameBtn) {
    changeNameBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (modal) {
        if (taggerInput) taggerInput.value = taggerName;
        modal.style.display = 'flex';
      }
    });
  }
}


// ============================================================================
// 4. FILTERING LOGIC
function applyFiltersAndRender() {
  const selectedPlatform = document.getElementById('filter-platform')?.value || 'all';
  const selectedPostType = document.getElementById('filter-post-type')?.value || 'all';
  const selectedStatus = document.getElementById('filter-status')?.value || 'untagged';
  const startDate = document.getElementById('filter-start-date')?.value || '';
  const endDate = document.getElementById('filter-end-date')?.value || '';
  const selectedSort = document.getElementById('filter-sort')?.value || 'asc';

  // 1. FILTER POSTS
  FILTERED_POSTS = ALL_POSTS.filter(post => {
    if (selectedPlatform !== 'all' && post.channel.toLowerCase() !== selectedPlatform.toLowerCase()) return false;
    if (selectedPostType !== 'all' && post.post_type.toLowerCase() !== selectedPostType.toLowerCase()) return false;

    const isTagged = TAGGED_POST_IDS.has(String(post.post_id));
    if (selectedStatus === 'untagged' && isTagged) return false;
    if (selectedStatus === 'tagged' && !isTagged) return false;

    if (post.post_date_pt) {
      if (startDate && post.post_date_pt < startDate) return false;
      if (endDate && post.post_date_pt > endDate) return false;
    }

    return true;
  });

  // 2. SORT POSTS
  if (selectedSort === 'asc') {
    FILTERED_POSTS.sort((a, b) => new Date(a.post_date_pt) - new Date(b.post_date_pt));
  } else if (selectedSort === 'desc') {
    FILTERED_POSTS.sort((a, b) => new Date(b.post_date_pt) - new Date(a.post_date_pt));
  } else if (selectedSort === 'random') {
    for (let i = FILTERED_POSTS.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [FILTERED_POSTS[i], FILTERED_POSTS[j]] = [FILTERED_POSTS[j], FILTERED_POSTS[i]];
    }
  }

  // 3. RESET INDEX & RENDER
  if (currentPostIndex >= FILTERED_POSTS.length) {
    currentPostIndex = Math.max(0, FILTERED_POSTS.length - 1);
  }

  renderCurrentPost();
}


// ============================================================================
// 5. RENDER CURRENT POST IN UI
function renderCurrentPost() {
  const embedContainer = document.getElementById('media-embed-container');
  const captionElem = document.getElementById('post-caption-text');
  const postIdElem = document.getElementById('post-id-display');
  const counterElem = document.querySelector('.counter-text');

  if (FILTERED_POSTS.length === 0) {
    if (embedContainer) {
      embedContainer.innerHTML = "<div style='padding: 40px; text-align: center; color: #666;'><h3>No posts match your filters</h3><p>Try broadening your platform or date filters above.</p></div>";
    }
    if (captionElem) captionElem.textContent = "N/A";
    if (postIdElem) postIdElem.textContent = "N/A";
    if (counterElem) counterElem.textContent = "0 of 0 in Queue";
    return;
  }

  const currentPost = FILTERED_POSTS[currentPostIndex];

  if (postIdElem) postIdElem.textContent = `#${currentPost.post_id}`;
  if (captionElem) captionElem.textContent = currentPost.post_content || "No caption available.";
  if (counterElem) {
    counterElem.textContent = `Post ${currentPostIndex + 1} of ${FILTERED_POSTS.length} in Queue`;
  }

  const channel = currentPost.channel ? currentPost.channel.toLowerCase() : '';

  if (channel === 'tiktok') {
    embedContainer.innerHTML = `
      <iframe 
        src="https://www.tiktok.com/player/v1/${currentPost.post_id}" 
        style="width: 100%; height: 580px; border: none; border-radius: 12px; max-width: 500px; display: block; margin: 0 auto;" 
        allow="fullscreen"
      ></iframe>
    `;

  } else if (channel === 'instagram') {
    embedContainer.innerHTML = `
      <blockquote class="instagram-media" data-instgrm-permalink="${currentPost.post_url}" data-instgrm-version="14" style="max-width: 540px; min-width: 326px; width: 100%;"></blockquote>
    `;
    if (window.instgrm) window.instgrm.Embeds.process();

  } else if (channel === 'facebook' || channel === 'fb') {
    embedContainer.innerHTML = `
      <div class="fb-post" data-href="${currentPost.post_url}" data-width="500"></div>
    `;
    if (window.FB) window.FB.XFBML.parse(embedContainer);

  } else if (channel === 'twitter' || channel === 'x') {
    embedContainer.innerHTML = `
      <blockquote class="twitter-tweet" data-theme="light">
        <a href="${currentPost.post_url}"></a>
      </blockquote>
    `;
    if (window.twttr && window.twttr.widgets) window.twttr.widgets.load(embedContainer);

  } else {
    embedContainer.innerHTML = `
      <div style="padding: 30px; text-align: center;">
        <p><strong>Platform:</strong> ${currentPost.channel} (${currentPost.post_type})</p>
        <a href="${currentPost.post_url}" target="_blank" class="btn btn-primary" style="text-decoration: none; display: inline-block; margin-top: 10px;">
          Open Original Post ↗
        </a>
      </div>
    `;
  }
}


// ============================================================================
// 6. FORM HANDLERS (SUBMIT & SKIP)
function setupFormHandlers() {
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', function() {
      if (!FILTERED_POSTS || FILTERED_POSTS.length === 0) return;

      const selectedObjective = document.querySelector('input[name="objective"]:checked');
      const currentPost = FILTERED_POSTS[currentPostIndex];

            // Assemble tag payload object
      const tagData = {
        taggedAt: new Date().toLocaleString(),
        taggerName: taggerName,
        postId: currentPost.post_id,
        pageAccount: currentPost.page_account || "",
        channel: currentPost.channel || "",
        postType: currentPost.post_type || "",
        postDate: currentPost.post_date_pt || "",
        club: clubTomSelect ? clubTomSelect.getValue() : null,
        player: playerTomSelect ? playerTomSelect.getValue() : null,
        event: document.getElementById('event-input')?.value.trim() || null,
        freeform: document.getElementById('freeform-input')?.value.trim() || null, // <--- ADDED THIS LINE
        objective: selectedObjective ? selectedObjective.value : null,
        postUrl: currentPost.post_url || "",
        postContent: currentPost.post_content || ""
      };

      submitBtn.disabled = true;
      submitBtn.textContent = "Saving to Google Sheet...";

      TAGGED_POST_IDS.add(String(currentPost.post_id));

      fetch(GOOGLE_SHEET_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(tagData)
      })
      .then(() => console.log("Tag saved to Google Sheet:", tagData))
      .catch(err => console.warn("Background fetch warning:", err))
      .finally(() => {
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Tag & Next ➔";
        resetForm();

        const selectedStatus = document.getElementById('filter-status')?.value;
        if (selectedStatus === 'untagged') {
          applyFiltersAndRender();
        } else {
          currentPostIndex++;
          if (currentPostIndex >= FILTERED_POSTS.length) currentPostIndex = 0;
          renderCurrentPost();
        }
      });
    });
  }

  const skipBtn = document.getElementById('skip-button');
  if (skipBtn) {
    skipBtn.addEventListener('click', function(e) {
      e.preventDefault();

      if (!FILTERED_POSTS || FILTERED_POSTS.length === 0) return;
      if (FILTERED_POSTS.length === 1) {
        alert("Only 1 post in the active queue matching your filters.");
        return;
      }

      currentPostIndex++;
      if (currentPostIndex >= FILTERED_POSTS.length) currentPostIndex = 0;

      resetForm();
      renderCurrentPost();
    });
  }
}


// ============================================================================
// 7. HELPER FUNCTIONS
function resetForm() {
  if (clubTomSelect) clubTomSelect.clear();
  if (playerTomSelect) {
    playerTomSelect.clear();
    playerTomSelect.clearOptions();
    playerTomSelect.disable();
  }

  hidePlayerHeadshot();

  const eventInput = document.getElementById('event-input');
  if (eventInput) eventInput.value = '';

  // Clear Freeform field
  const freeformInput = document.getElementById('freeform-input'); // <--- ADDED THIS
  if (freeformInput) freeformInput.value = '';                     // <--- ADDED THIS

  const checkedRadio = document.querySelector('input[name="objective"]:checked');
  if (checkedRadio) checkedRadio.checked = false;
}