// Game State
let gameState = {
    monsters: [],
    trainerCharacters: [],
    unlockedMonsters: new Set(),
    currentBoard: [],
    boardMonsters: [],
    trainers: [],
    selectedSlot: null,
    selectedMonster: null,
    draggedMonster: null,
    difficulty: 1
};

// Load unlocked monsters from localStorage
function loadUnlockedMonsters() {
    const saved = localStorage.getItem('unlockedMonsters');
    if (saved) {
        try {
            const unlockedArray = JSON.parse(saved);
            gameState.unlockedMonsters = new Set(unlockedArray);
            console.log(`Loaded ${gameState.unlockedMonsters.size} unlocked Combomon from save`);
        } catch (error) {
            console.error('Error loading unlocked monsters:', error);
            gameState.unlockedMonsters = new Set();
        }
    }
}

// Save unlocked monsters to localStorage
function saveUnlockedMonsters() {
    const unlockedArray = Array.from(gameState.unlockedMonsters);
    localStorage.setItem('unlockedMonsters', JSON.stringify(unlockedArray));
}

// Load monster data
async function loadMonsters() {
    try {
        const response = await fetch('MonsterArray.json');
        const data = await response.json();
        gameState.monsters = data.monsters;

        // Load trainer characters
        const charResponse = await fetch('TrainerCharacters.json');
        const charData = await charResponse.json();
        gameState.trainerCharacters = charData.characters;

        // Load saved progress
        loadUnlockedMonsters();

        initializeCombodex();
        setupNewBoard();
    } catch (error) {
        console.error('Error loading data:', error);
    }
}

// Initialize Combodex
function initializeCombodex() {
    const combodexGrid = document.getElementById('combodex-grid');
    combodexGrid.innerHTML = '';

    gameState.monsters.forEach(monster => {
        const entry = document.createElement('div');
        entry.className = 'combodex-entry locked';
        entry.id = `combodex-${monster.number}`;
        entry.innerHTML = `
            <div class="combodex-number">#${String(monster.number).padStart(3, '0')}</div>
            <div class="combodex-icon">?</div>
            <div class="combodex-name">Combomon ${String(monster.number).padStart(3, '0')}</div>
        `;
        combodexGrid.appendChild(entry);
    });

    // Restore unlocked monsters from save
    gameState.unlockedMonsters.forEach(monsterNumber => {
        const monster = gameState.monsters.find(m => m.number === monsterNumber);
        if (monster) {
            // Manually update the entry without calling unlockMonster to avoid saving again
            const entry = document.getElementById(`combodex-${monsterNumber}`);
            if (entry) {
                entry.className = 'combodex-entry unlocked';
                const iconHTML = monster.spriteFile
                    ? `<img src="${monster.spriteFile}" alt="${monster.name}" class="combodex-sprite">`
                    : getMonsterIcon(monster);
                const typeEmoji = getMonsterIcon(monster);
                const evolutionText = monster.evolution === 'Base' ? 'Base' : `Stage ${monster.evolution}`;
                entry.innerHTML = `
                    <div class="combodex-number">#${String(monster.number).padStart(3, '0')}</div>
                    <div class="card-corner top-left">${evolutionText}</div>
                    <div class="card-corner top-right">${typeEmoji} ${monster.type}</div>
                    <div class="card-center">
                        <div class="combodex-icon">${iconHTML}</div>
                        <div class="combodex-name">${monster.name}</div>
                    </div>
                    <div class="card-corner bottom-left">${monster.personality}</div>
                    <div class="card-corner bottom-right">${monster.region}</div>
                `;
            }
        }
    });

    updateCombodexStatus();
}

// Update Combodex status
function updateCombodexStatus() {
    document.getElementById('unlocked-count').textContent = gameState.unlockedMonsters.size;
    document.getElementById('total-count').textContent = gameState.monsters.length;
}

// Unlock monster in Combodex
function unlockMonster(monsterNumber) {
    if (gameState.unlockedMonsters.has(monsterNumber)) return;

    gameState.unlockedMonsters.add(monsterNumber);
    const monster = gameState.monsters.find(m => m.number === monsterNumber);
    const entry = document.getElementById(`combodex-${monsterNumber}`);

    if (entry && monster) {
        entry.className = 'combodex-entry unlocked';

        // Use sprite if available, otherwise fall back to emoji
        const iconHTML = monster.spriteFile
            ? `<img src="${monster.spriteFile}" alt="${monster.name}" class="combodex-sprite">`
            : getMonsterIcon(monster);

        const typeEmoji = getMonsterIcon(monster);
        const evolutionText = monster.evolution === 'Base' ? 'Base' : `Stage ${monster.evolution}`;

        entry.innerHTML = `
            <div class="combodex-number">#${String(monster.number).padStart(3, '0')}</div>
            <div class="card-corner top-left">${evolutionText}</div>
            <div class="card-corner top-right">${typeEmoji} ${monster.type}</div>
            <div class="card-center">
                <div class="combodex-icon">${iconHTML}</div>
                <div class="combodex-name">${monster.name}</div>
            </div>
            <div class="card-corner bottom-left">${monster.personality}</div>
            <div class="card-corner bottom-right">${monster.region}</div>
        `;
    }

    updateCombodexStatus();
    saveUnlockedMonsters();
}

// Get monster icon (text representation based on type)
function getMonsterIcon(monster) {
    const icons = {
        'Bug': '🐛',
        'Fire': '🔥',
        'Grass': '🌿',
        'Electric': '⚡',
        'Water': '💧'
    };
    return icons[monster.type] || '❓';
}

// Setup new board
function setupNewBoard() {
    // STEP 1: Fill the board first
    // Get all monsters NOT yet unlocked
    const lockedMonsters = gameState.monsters.filter(m =>
        !gameState.unlockedMonsters.has(m.number)
    );

    // Pick 2 random locked monsters as "seed" monsters
    const seedMonsters = getRandomElements(lockedMonsters, Math.min(2, lockedMonsters.length));

    // Find all monsters that share at least one trait with the seed monsters
    const relatedMonsters = gameState.monsters.filter(m => {
        // Skip if already in seed
        if (seedMonsters.some(s => s.number === m.number)) return false;

        // Check if shares any trait with any seed monster
        return seedMonsters.some(seed =>
            m.type === seed.type ||
            m.personality === seed.personality ||
            m.region === seed.region ||
            m.evolution === seed.evolution
        );
    });

    // Pick 10 more from related monsters
    const remainingMonsters = getRandomElements(relatedMonsters, Math.min(10, relatedMonsters.length));

    // Combine to create the 12-monster board
    gameState.boardMonsters = [...seedMonsters, ...remainingMonsters];

    // If we don't have enough (e.g., not enough locked monsters), fill with random
    while (gameState.boardMonsters.length < 12) {
        const available = gameState.monsters.filter(m =>
            !gameState.boardMonsters.some(b => b.number === m.number)
        );
        if (available.length === 0) break;
        gameState.boardMonsters.push(available[Math.floor(Math.random() * available.length)]);
    }

    // Shuffle the board
    gameState.boardMonsters = shuffleArray(gameState.boardMonsters);

    // STEP 2: Find 3 non-overlapping combos from the board
    const trainerCombos = find3NonOverlappingCombos(gameState.boardMonsters);

    if (!trainerCombos) {
        console.error('Failed to find 3 non-overlapping combos, regenerating board');
        setupNewBoard();
        return;
    }

    // STEP 3: Generate trainer requirements based on each combo
    gameState.trainers = [];

    for (let i = 0; i < 3; i++) {
        const combo = trainerCombos[i];
        const requirements = generateRequirementsForCombo(combo, gameState.difficulty);
        const request = generateRequestText(requirements);

        // Assign random character to trainer
        const randomCharacter = gameState.trainerCharacters[
            Math.floor(Math.random() * gameState.trainerCharacters.length)
        ];

        gameState.trainers.push({
            requirements,
            request,
            team: [null, null, null],
            character: randomCharacter
        });

        document.getElementById(`trainer-request-${i}`).textContent = request;
    }

    renderBoard();
}

// Helper function to count how many valid requirements a combo can satisfy
function countValidRequirements(combo) {
    let count = 0;
    const attributes = ['type', 'personality', 'region', 'evolution'];

    for (let attr of attributes) {
        const values = combo.map(m => m[attr]);
        const uniqueValues = new Set(values);

        // All same or all different = valid requirement
        if (uniqueValues.size === 1 || uniqueValues.size === 3) {
            count++;
        }
    }

    return count;
}

// Find 3 non-overlapping combinations from the board
function find3NonOverlappingCombos(boardMonsters) {
    const requiredRequirements = gameState.difficulty;

    // Try multiple times to find non-overlapping combos
    for (let attempt = 0; attempt < 100; attempt++) {
        const usedIndices = new Set();
        const combos = [];

        for (let t = 0; t < 3; t++) {
            // Find 3 monsters not yet used
            const availableIndices = [];
            for (let i = 0; i < boardMonsters.length; i++) {
                if (!usedIndices.has(i)) {
                    availableIndices.push(i);
                }
            }

            if (availableIndices.length < 3) break;

            // Try to find a combo that can satisfy the required number of requirements
            let validCombo = null;
            let validIndices = null;

            // Try multiple combinations
            for (let comboAttempt = 0; comboAttempt < 20; comboAttempt++) {
                const selectedIndices = getRandomElements(availableIndices, 3);
                const combo = selectedIndices.map(i => boardMonsters[i]);

                // Check if this combo can satisfy enough requirements
                if (countValidRequirements(combo) >= requiredRequirements) {
                    validCombo = combo;
                    validIndices = selectedIndices;
                    break;
                }
            }

            // If we couldn't find a valid combo, break and retry
            if (!validCombo) break;

            // Mark as used
            validIndices.forEach(i => usedIndices.add(i));
            combos.push(validCombo);
        }

        if (combos.length === 3) {
            return combos;
        }
    }

    return null; // Failed to find
}

// Generate requirements for a combo based on difficulty
function generateRequirementsForCombo(combo, difficulty) {
    const possibleRequirements = [];
    const attributes = ['type', 'personality', 'region', 'evolution'];

    // Check each attribute to see what requirements this combo can satisfy
    for (let attr of attributes) {
        const values = combo.map(m => m[attr]);
        const uniqueValues = new Set(values);

        if (uniqueValues.size === 1) {
            // All same - can use "same" requirement
            possibleRequirements.push({
                attribute: attr,
                matchType: 'same',
                value: values[0]
            });
        }

        if (uniqueValues.size === 3) {
            // All different - can use "different" requirement
            possibleRequirements.push({
                attribute: attr,
                matchType: 'different',
                value: null
            });
        }
    }

    // If we don't have enough possible requirements, log error
    if (possibleRequirements.length < difficulty) {
        console.error('Combo cannot satisfy required number of requirements:', {
            combo,
            difficulty,
            possibleRequirements: possibleRequirements.length
        });
        // Return what we have, but this should never happen now
        const shuffled = shuffleArray(possibleRequirements);
        return shuffled.slice(0, possibleRequirements.length);
    }

    // Randomly pick 'difficulty' number of requirements
    const shuffled = shuffleArray(possibleRequirements);
    return shuffled.slice(0, difficulty);
}

// Generate request text from requirements
function generateRequestText(requirements) {
    if (requirements.length === 0) {
        return 'I want 3 Combomon!';
    }

    let request = 'I want ';
    const requestParts = [];

    for (let req of requirements) {
        if (req.matchType === 'same') {
            if (req.attribute === 'type') {
                requestParts.push(`all ${req.value} Combomon`);
            } else if (req.attribute === 'personality') {
                requestParts.push(`all ${req.value} Combomon`);
            } else if (req.attribute === 'region') {
                requestParts.push(`all ${req.value} Combomon`);
            } else if (req.attribute === 'evolution') {
                const evolutionText = req.value === 'Base' ? 'Base' : `Stage ${req.value}`;
                requestParts.push(`all ${evolutionText} Combomon`);
            }
        } else {
            if (req.attribute === 'type') {
                requestParts.push('all different types');
            } else if (req.attribute === 'personality') {
                requestParts.push('all different personalities');
            } else if (req.attribute === 'region') {
                requestParts.push('all different regions');
            } else if (req.attribute === 'evolution') {
                requestParts.push('all different evolution stages');
            }
        }
    }

    if (requestParts.length === 1) {
        request += requestParts[0] + '!';
    } else if (requestParts.length === 2) {
        request += requestParts[0] + ' and ' + requestParts[1] + '!';
    } else {
        request += requestParts.slice(0, -1).join(', ') + ', and ' + requestParts[requestParts.length - 1] + '!';
    }

    return request;
}

// Check if trainer's team is valid
function checkTrainerTeam(trainerIndex) {
    const trainer = gameState.trainers[trainerIndex];
    const team = trainer.team.filter(m => m !== null);

    if (team.length !== 3) return null;

    // Check each requirement
    for (let req of trainer.requirements) {
        const values = team.map(m => m[req.attribute]);

        if (req.matchType === 'same') {
            const allSame = values.every(v => v === req.value);
            if (!allSame) return false;
        } else {
            const uniqueValues = new Set(values);
            if (uniqueValues.size !== 3) return false;
        }
    }

    return true;
}

// Render board
function renderBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';

    for (let i = 0; i < 12; i++) {
        const slot = document.createElement('div');
        slot.className = 'board-slot';
        slot.dataset.slot = i;

        if (gameState.boardMonsters[i]) {
            const card = createMonsterCard(gameState.boardMonsters[i]);
            slot.appendChild(card);
        }

        slot.addEventListener('click', () => handleSlotClick('board', i));
        board.appendChild(slot);
    }

    // Update trainer icons and reset trainer slots
    for (let t = 0; t < 3; t++) {
        // Update trainer character sprite
        const trainerIcon = document.querySelector(`.trainer[data-trainer="${t}"] .trainer-icon`);
        if (trainerIcon && gameState.trainers[t] && gameState.trainers[t].character) {
            trainerIcon.innerHTML = `<img src="${gameState.trainers[t].character.spriteFile}" alt="${gameState.trainers[t].character.name}" class="trainer-character-sprite">`;
        }

        for (let s = 0; s < 3; s++) {
            const slot = document.querySelector(`.trainer-slot[data-trainer="${t}"][data-slot="${s}"]`);
            slot.innerHTML = '';
            slot.className = 'trainer-slot';

            if (gameState.trainers[t].team[s]) {
                const card = createMonsterCard(gameState.trainers[t].team[s]);
                slot.appendChild(card);
            }

            slot.addEventListener('click', () => handleSlotClick('trainer', t, s));
        }
    }

    updateTrainerValidation();
    updateSubmitButton();
}

// Create monster card element
function createMonsterCard(monster) {
    const card = document.createElement('div');
    card.className = 'combomon-card';
    card.draggable = true;
    card.dataset.monsterId = monster.number;

    // Use sprite if available, otherwise fall back to emoji
    const iconHTML = monster.spriteFile
        ? `<img src="${monster.spriteFile}" alt="${monster.name}" class="combomon-sprite">`
        : `<div class="combomon-icon">${getMonsterIcon(monster)}</div>`;

    const typeEmoji = getMonsterIcon(monster);
    const evolutionText = monster.evolution === 'Base' ? 'Base' : `Stage ${monster.evolution}`;

    card.innerHTML = `
        <div class="card-corner top-left">${evolutionText}</div>
        <div class="card-corner top-right">${typeEmoji} ${monster.type}</div>
        <div class="card-center">
            ${iconHTML}
            <div class="combomon-name">${monster.name}</div>
        </div>
        <div class="card-corner bottom-left">${monster.personality}</div>
        <div class="card-corner bottom-right">${monster.region}</div>
    `;

    // Drag events
    card.addEventListener('dragstart', (e) => handleDragStart(e, monster));
    card.addEventListener('dragend', handleDragEnd);
    card.addEventListener('click', (e) => {
        e.stopPropagation();
        handleMonsterClick(monster);
    });

    return card;
}

// Handle drag start
function handleDragStart(e, monster) {
    gameState.draggedMonster = monster;
    e.target.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
}

// Handle drag end
function handleDragEnd(e) {
    e.target.classList.remove('dragging');
    gameState.draggedMonster = null;
}

// Handle slot click
function handleSlotClick(type, index1, index2) {
    if (gameState.selectedMonster) {
        // Move selected monster to clicked slot
        const monsterToMove = gameState.selectedMonster;
        gameState.selectedMonster = null;
        clearSelection();
        moveMonsterToSlot(monsterToMove, type, index1, index2);
        return; // Exit early to prevent slot selection
    }

    // Select this slot
    clearSelection();
    gameState.selectedSlot = { type, index1, index2 };

    if (type === 'board') {
        const slot = document.querySelector(`.board-slot[data-slot="${index1}"]`);
        if (slot) slot.classList.add('active');
    } else {
        const slot = document.querySelector(`.trainer-slot[data-trainer="${index1}"][data-slot="${index2}"]`);
        if (slot) slot.classList.add('active');
    }
}

// Handle monster click
function handleMonsterClick(monster) {
    if (gameState.selectedSlot) {
        // Move monster to selected slot
        const slot = gameState.selectedSlot;
        gameState.selectedSlot = null;
        clearSelection();
        moveMonsterToSlot(monster, slot.type, slot.index1, slot.index2);
        return; // Exit early to prevent monster selection
    }

    // Select this monster
    clearSelection();
    gameState.selectedMonster = monster;
    document.querySelectorAll('.combomon-card').forEach(card => {
        if (parseInt(card.dataset.monsterId) === monster.number) {
            card.classList.add('selected');
        }
    });
}

// Move monster to slot
function moveMonsterToSlot(monster, type, index1, index2) {
    // Find where monster currently is
    let fromBoard = gameState.boardMonsters.indexOf(monster);
    let fromTrainer = -1;
    let fromTrainerSlot = -1;

    if (fromBoard === -1) {
        for (let t = 0; t < 3; t++) {
            for (let s = 0; s < 3; s++) {
                if (gameState.trainers[t].team[s] === monster) {
                    fromTrainer = t;
                    fromTrainerSlot = s;
                    break;
                }
            }
            if (fromTrainer !== -1) break;
        }
    }

    // Get existing monster at target slot
    let existingMonster = null;
    if (type === 'board') {
        existingMonster = gameState.boardMonsters[index1];
    } else {
        existingMonster = gameState.trainers[index1].team[index2];
    }

    // Remove monster from current location
    if (fromBoard !== -1) {
        gameState.boardMonsters[fromBoard] = null;
    } else if (fromTrainer !== -1) {
        gameState.trainers[fromTrainer].team[fromTrainerSlot] = null;
    }

    // If there's an existing monster, move it back to board or swap
    if (existingMonster) {
        if (fromBoard !== -1) {
            gameState.boardMonsters[fromBoard] = existingMonster;
        } else if (fromTrainer !== -1) {
            gameState.trainers[fromTrainer].team[fromTrainerSlot] = existingMonster;
        } else {
            // Find empty board slot
            const emptySlot = gameState.boardMonsters.indexOf(null);
            if (emptySlot !== -1) {
                gameState.boardMonsters[emptySlot] = existingMonster;
            }
        }
    }

    // Place monster in target slot
    if (type === 'board') {
        gameState.boardMonsters[index1] = monster;
    } else {
        gameState.trainers[index1].team[index2] = monster;
    }

    renderBoard();
}

// Clear selection
function clearSelection() {
    document.querySelectorAll('.board-slot, .trainer-slot').forEach(slot => {
        slot.classList.remove('active');
    });
    document.querySelectorAll('.combomon-card').forEach(card => {
        card.classList.remove('selected');
    });
}

// Update trainer validation
function updateTrainerValidation() {
    for (let t = 0; t < 3; t++) {
        const isValid = checkTrainerTeam(t);
        const teamFull = gameState.trainers[t].team.every(m => m !== null);

        for (let s = 0; s < 3; s++) {
            const slot = document.querySelector(`.trainer-slot[data-trainer="${t}"][data-slot="${s}"]`);
            slot.classList.remove('valid', 'invalid');

            if (teamFull) {
                if (isValid) {
                    slot.classList.add('valid');
                } else {
                    slot.classList.add('invalid');
                }
            }
        }
    }
}

// Update submit button
function updateSubmitButton() {
    const submitBtn = document.getElementById('submit-btn');
    const anyValid = gameState.trainers.some(t => checkTrainerTeam(gameState.trainers.indexOf(t)) === true);
    submitBtn.disabled = !anyValid;
}

// Handle submit
function handleSubmit() {
    // Check if all 3 trainers are satisfied
    const allValid = gameState.trainers.every((trainer, index) =>
        checkTrainerTeam(index) === true
    );

    // Unlock monsters from valid teams
    for (let t = 0; t < 3; t++) {
        if (checkTrainerTeam(t) === true) {
            gameState.trainers[t].team.forEach(monster => {
                if (monster) {
                    unlockMonster(monster.number);
                }
            });
        }
    }

    // Show perfect message and play sound if all trainers satisfied
    if (allValid) {
        showPerfectMessage();
        // Delay board reset to let the perfect message show
        setTimeout(() => {
            setupNewBoard();
        }, 3000);
    } else {
        // Setup new board immediately if not perfect
        setupNewBoard();
    }
}

// Show perfect message with animation
function showPerfectMessage() {
    const perfectMessage = document.getElementById('perfect-message');
    const windchimeSound = document.getElementById('windchime-sound');

    // Show the message
    perfectMessage.classList.remove('hidden');

    // Play windchime sound
    windchimeSound.currentTime = 0;
    windchimeSound.play().catch(e => console.log('Sound play prevented:', e));

    // Hide after 3 seconds
    setTimeout(() => {
        perfectMessage.classList.add('hidden');
    }, 3000);
}

// Utility functions
function getRandomElements(array, count) {
    const shuffled = [...array].sort(() => 0.5 - Math.random());
    return shuffled.slice(0, count);
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// Event listeners
document.getElementById('submit-btn').addEventListener('click', handleSubmit);

document.getElementById('reset-btn').addEventListener('click', () => {
    // Move all monsters from trainer slots back to the board
    gameState.trainers.forEach((trainer, trainerIndex) => {
        trainer.team.forEach((monster, slotIndex) => {
            if (monster) {
                // Find an empty board slot
                const emptyBoardIndex = gameState.boardMonsters.findIndex(m => m === null);
                if (emptyBoardIndex !== -1) {
                    gameState.boardMonsters[emptyBoardIndex] = monster;
                    trainer.team[slotIndex] = null;
                }
            }
        });
    });

    clearSelection();
    renderBoard();
});

document.getElementById('combodex-btn').addEventListener('click', () => {
    document.getElementById('combodex-modal').classList.remove('hidden');
});

document.getElementById('close-combodex').addEventListener('click', () => {
    document.getElementById('combodex-modal').classList.add('hidden');
});

// Close modal when clicking outside
document.getElementById('combodex-modal').addEventListener('click', (e) => {
    if (e.target.id === 'combodex-modal') {
        document.getElementById('combodex-modal').classList.add('hidden');
    }
});

// Help modal
document.getElementById('help-btn').addEventListener('click', () => {
    document.getElementById('help-modal').classList.remove('hidden');
});

document.getElementById('close-help').addEventListener('click', () => {
    document.getElementById('help-modal').classList.add('hidden');
});

document.getElementById('help-modal').addEventListener('click', (e) => {
    if (e.target.id === 'help-modal') {
        document.getElementById('help-modal').classList.add('hidden');
    }
});

// Reset Combodex Progress
document.getElementById('reset-combodex-btn').addEventListener('click', () => {
    const confirmed = confirm('Are you sure you want to reset your Combodex progress? This will lock all Combomon and cannot be undone!');

    if (confirmed) {
        // Clear the unlocked monsters set
        gameState.unlockedMonsters.clear();

        // Clear localStorage
        localStorage.removeItem('unlockedMonsters');

        // Re-initialize Combodex to show all as locked
        initializeCombodex();

        // Update the unlock count display
        updateCombodexStatus();

        console.log('Combodex progress has been reset');
    }
});

// Music toggle
const music = document.getElementById('background-music');
const musicToggle = document.getElementById('music-toggle');
let isMusicPlaying = false;

// Load music preference from localStorage
const savedMusicPref = localStorage.getItem('musicEnabled');
if (savedMusicPref === 'true') {
    music.play().catch(e => console.log('Music autoplay prevented by browser'));
    isMusicPlaying = true;
    musicToggle.textContent = '🔊';
} else {
    musicToggle.textContent = '🔇';
    musicToggle.classList.add('muted');
}

musicToggle.addEventListener('click', () => {
    if (isMusicPlaying) {
        music.pause();
        musicToggle.textContent = '🔇';
        musicToggle.classList.add('muted');
        isMusicPlaying = false;
        localStorage.setItem('musicEnabled', 'false');
    } else {
        music.play();
        musicToggle.textContent = '🔊';
        musicToggle.classList.remove('muted');
        isMusicPlaying = true;
        localStorage.setItem('musicEnabled', 'true');
    }
});

// Add drag and drop to slots
document.addEventListener('DOMContentLoaded', () => {
    loadMonsters();

    // Difficulty buttons
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const difficulty = parseInt(btn.dataset.difficulty);
            gameState.difficulty = difficulty;

            // Update active button
            document.querySelectorAll('.difficulty-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');

            // Generate new board with new difficulty
            setupNewBoard();
        });
    });

    // Enable drop on slots
    document.addEventListener('dragover', (e) => {
        e.preventDefault();
    });

    document.addEventListener('drop', (e) => {
        e.preventDefault();
        const target = e.target.closest('.board-slot, .trainer-slot');

        if (target && gameState.draggedMonster) {
            if (target.classList.contains('board-slot')) {
                const slot = parseInt(target.dataset.slot);
                moveMonsterToSlot(gameState.draggedMonster, 'board', slot);
            } else if (target.classList.contains('trainer-slot')) {
                const trainer = parseInt(target.dataset.trainer);
                const slot = parseInt(target.dataset.slot);
                moveMonsterToSlot(gameState.draggedMonster, 'trainer', trainer, slot);
            }
        }
    });
});
