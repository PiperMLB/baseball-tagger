// ====================================================================
// 1. GLOBAL STATE VARIABLES
// ====================================================================
let ALL_POSTS = [];
let FILTERED_POSTS = [];
let currentPostIndex = 0;
let ROSTER_DATABASE = {};
let taggerName = localStorage.getItem('taggerName') || '';

let clubTomSelect = null;
let playerTomSelect = null;

const GOOGLE_SHEET_URL = "https://script.google.com/macros/s/AKfycbypxBeKJHQgPgQHj0PAXGkPG6gTfLlNccibh8f_y5qfi2eCrX1bXxmeCmoZnzaUR1AEZw/exec";
let TAGGED_POST_IDS = new Set();


// ====================================================================
// 2. DOM CONTENT LOADED - MAIN INITIALIZATION
// ====================================================================
document.addEventListener('DOMContentLoaded', function() {
  console.log("DOM loaded. Initializing app...");

  // --------------------------------------------------
  // A. Initialize Tagger Name / Modal
  // --------------------------------------------------
  initTaggerName();

  // --------------------------------------------------
  // B. Initialize TomSelect Dropdowns
  // --------------------------------------------------
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
    playerTomSelect.disable();
  } else {
    console.error("Missing #player-dropdown element!");
  }

  // --------------------------------------------------
  // C. Load Rosters JSON
  // --------------------------------------------------
  fetch('rosters.json')
    .then(res => res.json())
    .then(data => {
      if (clubTomSelect) clubTomSelect.clearOptions();
      data.forEach(row => {
        const clubName = row.home_team_full_name || row.home_Team_full_name;
        if (clubName) {
          let rawPlayers = Array.isArray(row.player_list) ? row.player_list : (row.player_list || '').split(',');
          
          const teamPlayers = rawPlayers.map(pString => {
            // Splits at " - ID:" so displayName becomes "Aaron Civale (#38)"
            const displayName = pString.split('-')[0].trim();
            
            // Extracts numeric MLB ID (e.g., 650644) for headshot fetching
            const idMatch = pString.match(/ID:\s*(\d+)/i);
            
            return { 
              name: displayName, 
              id: idMatch ? idMatch[1] : null 
            };
          });

          ROSTER_DATABASE[clubName] = teamPlayers;
          if (clubTomSelect) clubTomSelect.addOption({ value: clubName, text: clubName });
        }
      });
      if (clubTomSelect) clubTomSelect.refreshOptions(false);
      console.log("Loaded rosters for " + Object.keys(ROSTER_DATABASE).length + " teams.");
    })
    .catch(err => console.error("Error loading rosters.json:", err));

  // --------------------------------------------------
  // D. Load Posts JSON & Sync Google Sheets Tags
  // --------------------------------------------------
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

  // --------------------------------------------------
  // E. Event Listeners: Dropdowns & Filters
  // --------------------------------------------------
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

  if (playerTomSelect) {
    playerTomSelect.on('change', function(selectedPlayerName) {
      if (!selectedPlayerName) {
        hidePlayerHeadshot();
        return;
      }
      const selectedOption = playerTomSelect.options[selectedPlayerName];
      if (selectedOption && selectedOption.playerId) {
        const headshotUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:67:current.png/w_426,q_auto:best/v1/people/${selectedOption.playerId}/headshot/67/current`;
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

  // Top Filter Bar Change Handlers
  const filterPlatform = document.getElementById('filter-platform');
  const filterPostType = document.getElementById('filter-post-type');
  const filterStatus = document.getElementById('filter-status');
  const filterStartDate = document.getElementById('filter-start-date');
  const filterEndDate = document.getElementById('filter-end-date');

  if (filterPlatform) filterPlatform.addEventListener('change', applyFiltersAndRender);
  if (filterPostType) filterPostType.addEventListener('change', applyFiltersAndRender);
  if (filterStatus) filterStatus.addEventListener('change', applyFiltersAndRender);
  if (filterStartDate) filterStartDate.addEventListener('change', applyFiltersAndRender);
  if (filterEndDate) filterEndDate.addEventListener('change', applyFiltersAndRender);

  // Submit & Skip Handlers
  setupFormHandlers();
});


// ====================================================================
// 3. TAGGER NAME MODAL LOGIC
// ====================================================================
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
      console.log("Start Tagging button clicked!");
      
      const inputVal = taggerInput ? taggerInput.value.trim() : '';
      if (!inputVal) {
        alert("Please enter your name before starting!");
        return;
      }

      taggerName = inputVal;
      localStorage.setItem('taggerName', taggerName);
      console.log("Tagger name saved:", taggerName);

      updateTaggerUI();
      applyFiltersAndRender();
    });
  } else {
    console.error("Missing #save-name-btn in HTML!");
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


// ====================================================================
// 4. FILTERING LOGIC
// ====================================================================
function applyFiltersAndRender() {
  const selectedPlatform = document.getElementById('filter-platform')?.value || 'all';
  const selectedPostType = document.getElementById('filter-post-type')?.value || 'all';
  const selectedStatus = document.getElementById('filter-status')?.value || 'untagged';
  const startDate = document.getElementById('filter-start-date')?.value || '';
  const endDate = document.getElementById('filter-end-date')?.value || '';

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

  if (currentPostIndex >= FILTERED_POSTS.length) {
    currentPostIndex = Math.max(0, FILTERED_POSTS.length - 1);
  }

  renderCurrentPost();
}


// ====================================================================
// 5. RENDER CURRENT POST IN UI
// ====================================================================
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
    // Direct TikTok iframe player embed using currentPost.post_id
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


// ====================================================================
// 6. FORM HANDLERS (SUBMIT & SKIP)
// ====================================================================
function setupFormHandlers() {
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', function() {
      if (!FILTERED_POSTS || FILTERED_POSTS.length === 0) return;

      const selectedObjective = document.querySelector('input[name="objective"]:checked');
      const currentPost = FILTERED_POSTS[currentPostIndex];

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


// ====================================================================
// 7. HELPERS
// ====================================================================
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

  const checkedRadio = document.querySelector('input[name="objective"]:checked');
  if (checkedRadio) checkedRadio.checked = false;
}

function hidePlayerHeadshot() {
  const containerElem = document.getElementById('player-headshot-container');
  const imgElem = document.getElementById('player-headshot-img');
  if (containerElem) containerElem.style.display = 'none';
  if (imgElem) imgElem.src = '';
}