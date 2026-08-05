/* BASEBALL TAGGER - MAIN APPLICATION LOGIC (app.js) */


// 1. GLOBAL CONFIGURATION & STATE VARIABLES
// Stores app-wide settings, user preferences, and data lists in memory

// The Google Apps Script web links used to read/write spreadsheet data
const SHEET_URL_SOURCE_OF_TRUTH = "https://script.google.com/macros/s/AKfycbzSi0TcBOOq7GHW7cwC-_y5Q48m3jL4xEYO0DaM3PtnRRmXKpU5BjfJMnrgGqRd0v3a_w/exec";
const SHEET_URL_AI_EVALUATION   = "https://script.google.com/macros/s/AKfycbzSi0TcBOOq7GHW7cwC-_y5Q48m3jL4xEYO0DaM3PtnRRmXKpU5BjfJMnrgGqRd0v3a_w/exec";

// Holds all raw post objects loaded from the JSON file
let ALL_POSTS = [];

// Holds only the posts that match the user's active filter settings
let FILTERED_POSTS = [];

// Keeps track of which post number in the filtered list is currently being shown
let currentPostIndex = 0;

// Holds team roster data (teams and their player lists with MLB IDs)
let ROSTER_DATABASE = {};

// Gets the tagger's saved name from browser memory (or sets it to blank if not saved)
let taggerName = localStorage.getItem('taggerName') || '';

// Global variables to hold the searchable dropdown component instances
let clubTomSelect = null;
let playerTomSelect = null;

// Holds a unique list of post IDs that have already been tagged in Google Sheets
let TAGGED_POST_IDS = new Set();

// Remembers the active tagging mode ('source_of_truth' or 'evaluate_ai') from browser memory
let taggingMode = localStorage.getItem('taggingMode') || 'source_of_truth'; 

// ============================================================================
// 2. TOP-LEVEL ASYNC & DATA FETCHING FUNCTIONS
// Handles downloading data from Google Sheets and local JSON files
// ============================================================================

// Asks Google Sheets for the list of post IDs that are already tagged in the active mode
async function fetchTaggedPostIds() {
  // Build the web link with the current mode as a URL parameter
  const url = SHEET_URL_SOURCE_OF_TRUTH + `?mode=${taggingMode}`;

  try {
    // Send a request to Google Sheets
    const response = await fetch(url);
    // Convert the incoming response into a JavaScript object
    const data = await response.json();

    // Check if the server returned a valid array of tagged post IDs
    if (data.status === 'success' && Array.isArray(data.taggedPostIds)) {
      // Save the cleaned post IDs into our Set variable
      TAGGED_POST_IDS = new Set(data.taggedPostIds.map(id => String(id).trim()));
      console.log(`Loaded ${TAGGED_POST_IDS.size} tagged post IDs for mode [${taggingMode}]`);
    }
  } catch (err) {
    // Log an error if the request fails
    console.error("Error fetching tagged post IDs from Google Sheets:", err);
  }
}

// Downloads the correct JSON post dataset based on the selected mode
async function loadPostsForCurrentMode() {
  // Choose 'ai_posts.json' for AI Evaluation mode, or 'posts.json' for Source of Truth mode
  const dataFile = (taggingMode === 'evaluate_ai') ? 'ai_posts.json' : 'posts.json';
  console.log(`Loading posts from: ${dataFile} (Mode: ${taggingMode})`);

  try {
    // Fetch the JSON file
    const response = await fetch(dataFile);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    // Save the loaded posts array into ALL_POSTS
    ALL_POSTS = await response.json();
    console.log(`Successfully loaded ${ALL_POSTS.length} posts from ${dataFile}.`);
    
    // Reset the active post position back to the start
    currentPostIndex = 0;
    // Apply filters and render the first post
    await applyFiltersAndRender();
  } catch (err) {
    console.error(`Error loading dataset (${dataFile}):`, err);
  }
}

// Downloads team roster data from rosters.json and populates the team database
function loadRosters() {
  fetch('rosters.json')
    .then(res => res.json())
    .then(data => {
      // Clear out any old options in the club dropdown
      if (clubTomSelect) clubTomSelect.clearOptions();
      
      // Loop through each team row in the roster JSON
      data.forEach(row => {
        const clubName = row.home_team_full_name || row.home_Team_full_name;
        
        if (clubName) {
          // Get raw player list string or array
          let rawPlayers = Array.isArray(row.player_list) ? row.player_list : (row.player_list || '').split(',');
          
          // Format each player into a clean object with a name and MLB ID
          const teamPlayers = rawPlayers.map(pString => {
            const displayName = pString.split('-')[0].trim();
            const idMatch = pString.match(/ID:\s*(\d+)/i);

            return { 
              name: displayName, 
              id: idMatch ? idMatch[1] : null
            };
          });

          // Store team players under the team name key in our roster database
          ROSTER_DATABASE[clubName] = teamPlayers;
          
          // Add this team to the Club dropdown options
          if (clubTomSelect) {
            clubTomSelect.addOption({ value: clubName, text: clubName });
          }
        }
      });

      // Refresh the dropdown UI so options display
      if (clubTomSelect) clubTomSelect.refreshOptions(false);
      console.log("Loaded rosters for " + Object.keys(ROSTER_DATABASE).length + " teams.");
    })
    .catch(err => console.error("Error loading rosters.json:", err));
}

// ============================================================================
// 3. MAIN INITIALIZATION (DOMContentLoaded)
// Runs automatically when the webpage finishes loading in the browser
// ============================================================================

document.addEventListener('DOMContentLoaded', async function() {
  console.log("DOM loaded. Initializing app...");

  // 1. Show the tagger name modal if needed and load baseball rosters
  initTaggerName();
  loadRosters();

  // 2. Set up searchable dropdown for MLB Clubs
  const clubElem = document.getElementById('club-dropdown');
  if (clubElem) {
    clubTomSelect = new TomSelect('#club-dropdown', {
      create: false,
      openOnFocus: true,
      placeholder: "Search or select MLB club...",
      sortField: { field: "text", order: "asc" },
      maxOptions: 50
    });
  }

  // Set up searchable dropdown for MLB Players
  const playerElem = document.getElementById('player-dropdown');
  if (playerElem) {
    playerTomSelect = new TomSelect('#player-dropdown', {
      create: false,
      openOnFocus: true,
      placeholder: "Select a Club first...",
      sortField: { field: "text", order: "asc" },
      maxOptions: 200
    });
    
    // Update player headshot when a player is picked
    playerTomSelect.on('change', function(playerName) {
      const selectedClub = clubTomSelect ? clubTomSelect.getValue() : null;
      updatePlayerHeadshot(playerName, selectedClub);
    });
  }

  // 3. Listen for changes on the Club dropdown to populate that team's players
  if (clubTomSelect) {
    clubTomSelect.on('change', function(selectedClub) {
      if (!playerTomSelect) return;
      
      // Reset player dropdown and hide headshot image
      playerTomSelect.clear();
      playerTomSelect.clearOptions();
      hidePlayerHeadshot();

      // If a valid team was selected, populate player dropdown with its players
      if (selectedClub && ROSTER_DATABASE[selectedClub]) {
        ROSTER_DATABASE[selectedClub].forEach(p => {
          playerTomSelect.addOption({ value: p.name, text: p.name, playerId: p.id });
        });
        playerTomSelect.enable();
        playerTomSelect.refreshOptions(false);
      } else {
        // Disable player dropdown if no team is selected
        playerTomSelect.disable();
      }
    });
  }

  // 4. Attach event listeners to all filter controls above the post view
  const filterPlatform  = document.getElementById('filter-platform');
  const filterPostType  = document.getElementById('filter-post-type');
  const filterStatus    = document.getElementById('filter-status');
  const filterStartDate = document.getElementById('filter-start-date');
  const filterEndDate   = document.getElementById('filter-end-date');
  const filterSort      = document.getElementById('filter-sort');

  if (filterPlatform)  filterPlatform.addEventListener('change', applyFiltersAndRender);
  if (filterPostType)  filterPostType.addEventListener('change', applyFiltersAndRender);
  if (filterStatus)    filterStatus.addEventListener('change', applyFiltersAndRender);
  if (filterStartDate) filterStartDate.addEventListener('change', applyFiltersAndRender);
  if (filterEndDate)   filterEndDate.addEventListener('change', applyFiltersAndRender);
  if (filterSort)      filterSort.addEventListener('change', applyFiltersAndRender);

  // Attach button listeners for Save and Skip actions
  setupFormHandlers();

  // 5. Load the post queue and sync live tagged IDs from Google Sheets
  await loadPostsForCurrentMode();
});

// ============================================================================
// 4. TAGGER NAME MODAL LOGIC
// Manages the name/mode modal window and updates local memory settings
// ============================================================================

function initTaggerName() {
  const modal = document.getElementById('name-modal');
  const taggerInput = document.getElementById('tagger-name-input');
  const saveBtn = document.getElementById('save-name-btn');
  const nameDisplay = document.getElementById('tagger-name-display');
  const changeNameBtn = document.getElementById('change-name-btn');

  // Updates the top header text to show tagger name and mode label
  function updateTaggerUI() {
    if (taggerName) {
      if (nameDisplay) {
        const modeLabel = taggingMode === 'evaluate_ai' ? ' [AI Eval Mode]' : ' [Source of Truth]';
        nameDisplay.textContent = taggerName + modeLabel;
      }
      if (modal) modal.style.display = 'none'; // Hide modal when name is set
    } else {
      if (nameDisplay) nameDisplay.textContent = 'Not Set';
      if (modal) modal.style.display = 'flex'; // Show modal if name is missing
    }
  }

  // Pre-select the matching radio button inside the modal based on saved mode
  const activeRadio = document.querySelector(`input[name="tagging-mode"][value="${taggingMode}"]`);
  if (activeRadio) activeRadio.checked = true;

  updateTaggerUI();

  // Handles clicking the Save button inside the modal
  if (saveBtn) {
    saveBtn.addEventListener('click', async function(e) {
      e.preventDefault();
      
      const inputVal = taggerInput ? taggerInput.value.trim() : '';
      if (!inputVal) {
        alert("Please enter your name before starting!");
        return;
      }

      // Read chosen mode radio selection
      const selectedModeRadio = document.querySelector('input[name="tagging-mode"]:checked');
      const selectedMode = selectedModeRadio ? selectedModeRadio.value : 'source_of_truth';

      // Save choices into global variables and browser local memory
      taggerName = inputVal;
      taggingMode = selectedMode;

      localStorage.setItem('taggerName', taggerName);
      localStorage.setItem('taggingMode', taggingMode);

      updateTaggerUI();

      // Reload dataset and sync Google Sheets IDs for the new mode
      await loadPostsForCurrentMode();
    });
  }

  // Handles clicking the "Change Name / Mode" button in the header
  if (changeNameBtn) {
    changeNameBtn.addEventListener('click', function(e) {
      e.preventDefault();
      if (modal) {
        if (taggerInput) taggerInput.value = taggerName;
        const radio = document.querySelector(`input[name="tagging-mode"][value="${taggingMode}"]`);
        if (radio) radio.checked = true;
        modal.style.display = 'flex'; // Open modal
      }
    });
  }
}

// ============================================================================
// 5. FILTERING & RENDER LOGIC
// Filters the raw post list and renders media embeds to the page
// ============================================================================

async function applyFiltersAndRender() {
  // Read current filter values from the HTML dropdowns
  const selectedPlatform = document.getElementById('filter-platform')?.value || 'all';
  const selectedPostType = document.getElementById('filter-post-type')?.value || 'all';
  const selectedStatus   = document.getElementById('filter-status')?.value || 'untagged';
  const startDate        = document.getElementById('filter-start-date')?.value || '';
  const endDate          = document.getElementById('filter-end-date')?.value || '';
  const selectedSort     = document.getElementById('filter-sort')?.value || 'asc';

  // Fetch updated list of tagged post IDs directly from Google Sheets
  await fetchTaggedPostIds();

  // Filter ALL_POSTS array down to matching FILTERED_POSTS
  FILTERED_POSTS = ALL_POSTS.filter(post => {
    // Filter by social platform (TikTok, Instagram, Facebook, X)
    if (selectedPlatform !== 'all' && post.channel.toLowerCase() !== selectedPlatform.toLowerCase()) return false;
    // Filter by post content type (Reel, Video, Photo, etc.)
    if (selectedPostType !== 'all' && post.post_type.toLowerCase() !== selectedPostType.toLowerCase()) return false;

    // Filter by Tagged vs Untagged status matching Google Sheets records
    const isTagged = TAGGED_POST_IDS.has(String(post.post_id).trim());
    if (selectedStatus === 'untagged' && isTagged) return false;
    if (selectedStatus === 'tagged' && !isTagged) return false;

    // Filter by start and end publication date
    if (post.post_date_pt) {
      if (startDate && post.post_date_pt < startDate) return false;
      if (endDate && post.post_date_pt > endDate) return false;
    }

    return true; // Keep post if all conditions pass
  });

  // Sort filtered posts (Oldest First, Newest First, or Random)
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

  // Ensure current post index stays within valid array bounds
  if (currentPostIndex >= FILTERED_POSTS.length) {
    currentPostIndex = Math.max(0, FILTERED_POSTS.length - 1);
  }

  // Display the active post on the screen
  renderCurrentPost();
}

// Renders media embed, post details, pre-filled form fields, and queue counters
function renderCurrentPost() {
  const currentPost = FILTERED_POSTS[currentPostIndex];
  const embedContainer = document.getElementById('media-embed-container');
  const captionElem = document.getElementById('post-caption-text');
  const postIdElem = document.getElementById('post-id-display');
  const counterElem = document.querySelector('.counter-text');

  // Handle empty queue display if no posts match active filters
  if (FILTERED_POSTS.length === 0) {
    if (embedContainer) {
      embedContainer.innerHTML = "<div style='padding: 40px; text-align: center; color: #666;'><h3>No posts match your filters</h3><p>Try broadening your platform or date filters above.</p></div>";
    }
    if (captionElem) captionElem.textContent = "N/A";
    if (postIdElem) postIdElem.textContent = "N/A";
    if (counterElem) counterElem.textContent = "0 of 0 in Queue";
    return;
  }

  // Set post ID header and caption text
  if (postIdElem) postIdElem.textContent = `#${currentPost.post_id}`;
  if (captionElem) captionElem.textContent = currentPost.post_content || "No caption available.";
  if (counterElem) {
    counterElem.textContent = `Post ${currentPostIndex + 1} of ${FILTERED_POSTS.length} in Queue`;
  }

  const channel = currentPost.channel ? currentPost.channel.toLowerCase() : '';

  // Render social media player embed iframe based on platform type
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
    // Fallback card with direct link for other channels
    embedContainer.innerHTML = `
      <div style="padding: 30px; text-align: center;">
        <p><strong>Platform:</strong> ${currentPost.channel} (${currentPost.post_type})</p>
        <a href="${currentPost.post_url}" target="_blank" class="btn btn-primary" style="text-decoration: none; display: inline-block; margin-top: 10px;">
          Open Original Post ↗
        </a>
      </div>
    `;
  }
  
  // If evaluating AI, reset form and prefill fields with AI predictions
  if (taggingMode === 'evaluate_ai') {
    resetForm();
    prefillAiData(currentPost);
  } else {
    resetForm();
  }

  // Display or hide AI text description box depending on active mode
  const aiBox = document.getElementById('ai-description-box');
  const aiTextContent = document.getElementById('ai-text-description-content');
  const aiDescription = currentPost.text_description || currentPost.ai_text_description;

  if (taggingMode === 'evaluate_ai' && aiDescription) {
    if (aiTextContent) aiTextContent.textContent = aiDescription;
    if (aiBox) aiBox.style.display = 'block';
  } else {
    if (aiBox) aiBox.style.display = 'none';
  }
}

// Prefills form dropdowns and inputs using predicted AI values from dataset
function prefillAiData(post) {
  if (!post) return;

  // 1. Prefill Team Club dropdown
  const clubVal = post.focal_club || post.ai_club;
  if (clubTomSelect && clubVal && clubVal !== "None") {
    clubTomSelect.setValue(clubVal);
    
    // 2. Prefill Player dropdown
    const rawPlayerVal = post.focal_player || post.ai_player;
    if (rawPlayerVal && rawPlayerVal !== "None") {
      setTimeout(() => {
        if (playerTomSelect) {
          playerTomSelect.enable();

          // Search roster for exact name match
          let targetPlayerName = rawPlayerVal;
          if (ROSTER_DATABASE && clubVal && ROSTER_DATABASE[clubVal]) {
            const matchedPlayer = ROSTER_DATABASE[clubVal].find(p => 
              p.name.toLowerCase().trim() === rawPlayerVal.toLowerCase().trim() ||
              p.name.toLowerCase().startsWith(rawPlayerVal.toLowerCase().trim())
            );
            
            if (matchedPlayer) {
              targetPlayerName = matchedPlayer.name;
            }
          }

          // Add player option if not already in dropdown list
          if (!playerTomSelect.options[targetPlayerName]) {
            playerTomSelect.addOption({ value: targetPlayerName, text: targetPlayerName });
          }

          playerTomSelect.setValue(targetPlayerName);
          updatePlayerHeadshot(targetPlayerName, clubVal);
        }
      }, 300);
    }
  }

  // 3. Prefill Objective radio button
  const rawObj = post.objective ?? post.ai_objective;
  let objectiveVal = "";
  if (rawObj === "1" || rawObj === 1) objectiveVal = "Reach new audience";
  if (rawObj === "0" || rawObj === 0) objectiveVal = "Target current audience";

  if (objectiveVal) {
    const radio = document.querySelector(`input[name="objective"][value="${objectiveVal}"]`);
    if (radio) radio.checked = true;
  }

  // 4. Prefill Score Graphic checkbox
  const rawScore = post.score_graphic ?? post.ai_score_graphic;
  const isScoreGraphic = (rawScore === "1" || rawScore === 1 || rawScore === true);
  const scoreCheckbox = document.getElementById('score-graphic-checkbox');
  if (scoreCheckbox) {
    scoreCheckbox.checked = isScoreGraphic;
  }
}

// ============================================================================
// 6. FORM HANDLERS (SUBMIT & SKIP)
// Binds click handlers for saving form submissions and skipping posts
// ============================================================================

function setupFormHandlers() {
  const submitBtn = document.getElementById('submit-btn');
  if (submitBtn) {
    submitBtn.addEventListener('click', function() {
      if (!FILTERED_POSTS || FILTERED_POSTS.length === 0) return;

      const selectedObjective = document.querySelector('input[name="objective"]:checked');
      const currentPost = FILTERED_POSTS[currentPostIndex];

      // Assemble tag payload object to send to Google Sheets
      const tagData = {
        taggedAt: new Date().toLocaleString(),
        taggerName: taggerName,
        taggingMode: taggingMode,
        postId: String(currentPost.post_id).trim(),
        pageAccount: currentPost.page_account || "",
        channel: currentPost.channel || "",
        postType: currentPost.post_type || "",
        postDate: currentPost.post_date_pt || "",
        club: clubTomSelect ? clubTomSelect.getValue() : null,
        player: playerTomSelect ? playerTomSelect.getValue() : null,
        event: document.getElementById('event-input')?.value.trim() || null,
        objective: selectedObjective ? selectedObjective.value : null,
        scoreGraphic: document.getElementById('score-graphic-checkbox')?.checked || false,
        freeform: document.getElementById('freeform-input')?.value.trim() || null,
        postUrl: currentPost.post_url || "",
        postContent: currentPost.post_content || ""
      };

      // Provide UI button feedback while saving
      submitBtn.disabled = true;
      submitBtn.textContent = "Saving to Google Sheet...";

      // Send payload via POST to Google Apps Script Web App
      fetch(SHEET_URL_SOURCE_OF_TRUTH, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(tagData)
      })
      .then(() => {
        console.log(`Saved tag [${currentPost.post_id}] under mode [${taggingMode}]`);
        // Save post ID locally to tagged set
        TAGGED_POST_IDS.add(String(currentPost.post_id).trim());
      })
      .catch(err => console.warn("Save warning:", err))
      .finally(() => {
        // Reset submit button state
        submitBtn.disabled = false;
        submitBtn.textContent = "Save Tag & Next ➔";
        resetForm();

        // Advance queue or refresh filters
        const selectedStatus = document.getElementById('filter-status')?.value;
        if (selectedStatus === 'untagged' || selectedStatus === 'tagged') {
          applyFiltersAndRender();
        } else {
          currentPostIndex++;
          if (currentPostIndex >= FILTERED_POSTS.length) currentPostIndex = 0;
          renderCurrentPost();
        }
      });
    });
  }

  // Handle clicking Skip Post button
  const skipBtn = document.getElementById('skip-button');
  if (skipBtn) {
    skipBtn.addEventListener('click', function(e) {
      e.preventDefault();

      if (!FILTERED_POSTS || FILTERED_POSTS.length === 0) return;
      if (FILTERED_POSTS.length === 1) {
        alert("Only 1 post in the active queue matching your filters.");
        return;
      }

      // Advance index to next post in queue
      currentPostIndex++;
      if (currentPostIndex >= FILTERED_POSTS.length) currentPostIndex = 0;

      resetForm();
      renderCurrentPost();
    });
  }
}

// ============================================================================
// 7. HELPER FUNCTIONS
// Clears form fields and manages player headshot image displays
// ============================================================================

// Resets all tag input fields back to their blank default state
function resetForm() {
  if (clubTomSelect) clubTomSelect.clear(true);

  if (playerTomSelect) {
    playerTomSelect.clear(true);
    playerTomSelect.clearOptions();
    playerTomSelect.disable();
  }

  const headshotContainer = document.getElementById('player-headshot-container');
  const headshotImg = document.getElementById('player-headshot-img');

  if (headshotImg) {
    headshotImg.src = '';
    headshotImg.style.display = 'none';
  }

  if (headshotContainer) {
    headshotContainer.style.display = 'none';
  }

  const eventInput = document.getElementById('event-input');
  if (eventInput) eventInput.value = '';

  const freeformInput = document.getElementById('freeform-input');
  if (freeformInput) freeformInput.value = '';

  const scoreCheckbox = document.getElementById('score-graphic-checkbox');
  if (scoreCheckbox) scoreCheckbox.checked = false;

  const checkedRadio = document.querySelector('input[name="objective"]:checked');
  if (checkedRadio) checkedRadio.checked = false;
}

// Hides the MLB player headshot image element
function hidePlayerHeadshot() {
  const headshotImg = document.getElementById('player-headshot') || document.getElementById('headshot-img');
  if (headshotImg) {
    headshotImg.style.display = 'none';
    headshotImg.src = '';
  }
}

// Looks up MLB player ID and updates headshot image URL
function updatePlayerHeadshot(playerName, clubName) {
  const headshotContainer = document.getElementById('player-headshot-container');
  const headshotImg = document.getElementById('player-headshot-img');

  if (!headshotImg) return;

  let playerId = null;

  // Search roster database for player's MLB ID
  if (ROSTER_DATABASE && clubName && ROSTER_DATABASE[clubName] && playerName) {
    const playerObj = ROSTER_DATABASE[clubName].find(p => 
      p.name.toLowerCase().trim() === playerName.toLowerCase().trim() ||
      p.name.toLowerCase().startsWith(playerName.toLowerCase().trim())
    );
    if (playerObj) playerId = playerObj.id;
  }

  // If MLB ID exists, show official headshot photo
  if (playerId) {
    const photoUrl = `https://img.mlbstatic.com/mlb-photos/image/upload/d_people:generic:headshot:silo:current.png/v1/people/${playerId}/headshot/67/current`;
    headshotImg.src = photoUrl;
    headshotImg.style.display = 'block';
    if (headshotContainer) headshotContainer.style.display = 'block';
  } else {
    // Hide image container if no player photo exists
    headshotImg.src = '';
    headshotImg.style.display = 'none';
    if (headshotContainer) headshotContainer.style.display = 'none';
  }
}