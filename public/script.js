const socket = io();

// UI Elements
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const usernameInput = document.getElementById('username-input');
const roomInput = document.getElementById('room-input');
const joinBtn = document.getElementById('join-btn');
const playersList = document.getElementById('players-list');
const lobbyControls = document.getElementById('lobby-controls');
const readyBtn = document.getElementById('ready-btn');
const readyBtnText = document.getElementById('ready-btn-text');
const sentenceDisplay = document.getElementById('sentence-display');
const gameInput = document.getElementById('game-input');
const wpmDisplay = document.getElementById('wpm-display');
const accuracyDisplay = document.getElementById('accuracy-display');
const timerDisplay = document.getElementById('timer-display');
const resultModal = document.getElementById('result-modal');
const finalWpm = document.getElementById('final-wpm');
const finalAccuracy = document.getElementById('final-accuracy');
const countdownOverlay = document.getElementById('countdown-overlay');
const countdownNumber = document.getElementById('countdown-number');
const rematchBtn = document.getElementById('rematch-btn');
const rematchBtnBottom = document.getElementById('rematch-btn-bottom');
const waitingOpponent = document.getElementById('waiting-opponent');
const resultActions = document.getElementById('result-actions');
const matchActions = document.getElementById('match-actions');
const battleRankingSection = document.getElementById('battle-ranking-section');
const battleRankingBody = document.getElementById('battle-ranking-body');
const matchResultsSection = document.getElementById('match-results-section');
const matchComparisonCards = document.getElementById('match-comparison-cards');

// Game State
let currentUsername = '';
let currentRoom = '';
let targetSentence = '';
let startTime = null;
let timerInterval = null;
let isGameActive = false;

// Join Room Logic
joinBtn.addEventListener('click', () => {
    currentUsername = usernameInput.value.trim();
    currentRoom = roomInput.value.trim();

    if (currentUsername && currentRoom) {
        socket.emit('join-room', { username: currentUsername, roomCode: currentRoom });
        setupScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        
        // Langsung tampilkan ranking global saat baru masuk ke room
        updateBattleRanking();
    }
});

// Lobby Updates
socket.on('update-players', (players) => {
    console.log('Update Players received:', players);
    playersList.innerHTML = '';
    const playerArray = Object.entries(players);
    
    // Show lobby controls if more than 1 player (or for test purposes always)
    if (playerArray.length >= 1) {
        lobbyControls.classList.remove('hidden');
    }

    playerArray.forEach(([id, player]) => {
        const playerDiv = document.createElement('div');
        playerDiv.className = `bg-slate-800/50 p-4 rounded-xl space-y-2 border ${player.isReady ? 'border-emerald-500/50' : 'border-transparent'}`;
        playerDiv.innerHTML = `
            <div class="flex justify-between items-center text-sm">
                <span class="font-bold text-slate-300">
                    ${player.username} ${id === socket.id ? '(Kamu)' : ''}
                    ${player.isReady ? '<i class="fas fa-check-circle text-emerald-400 ml-1"></i>' : ''}
                </span>
                <span class="${player.isFinished ? 'text-emerald-400' : 'text-blue-400'} font-mono">${player.wpm} WPM</span>
            </div>
            <div class="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                <div class="bg-blue-500 h-full transition-all duration-300" style="width: ${player.progress}%"></div>
            </div>
        `;
        playersList.appendChild(playerDiv);

        // Update local ready button text if this is us
        if (id === socket.id) {
            if (player.isReady) {
                readyBtn.classList.replace('bg-blue-600', 'bg-emerald-600');
                readyBtn.classList.replace('hover:bg-blue-700', 'hover:bg-emerald-700');
                readyBtnText.innerText = 'Sudah Siap';
            } else {
                readyBtn.classList.replace('bg-emerald-600', 'bg-blue-600');
                readyBtn.classList.replace('hover:bg-emerald-700', 'hover:bg-blue-700');
                readyBtnText.innerText = 'Siap Bertanding';
            }
        }
    });
});

socket.on('room-info', ({ sentence, status }) => {
    console.log('Room Info received:', { sentence, status });
    targetSentence = sentence;
    renderSentence();
    
    // Tampilkan kalimat langsung agar pemain tahu apa yang akan diketik
    if (status === 'waiting') {
        sentenceDisplay.classList.remove('text-slate-500');
        sentenceDisplay.classList.add('text-slate-400');
    }
});

// Start Game Logic
readyBtn.addEventListener('click', () => {
    socket.emit('toggle-ready', currentRoom);
});

socket.on('game-started', () => {
    lobbyControls.classList.add('hidden');
    startCountdown();
});

function startCountdown() {
    countdownOverlay.classList.remove('hidden');
    let count = 3;
    countdownNumber.innerText = count;

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownNumber.innerText = count;
        } else {
            clearInterval(interval);
            countdownOverlay.classList.add('hidden');
            startGame();
        }
    }, 1000);
}

function startGame() {
    isGameActive = true;
    startTime = new Date();
    gameInput.value = '';
    gameInput.focus();
    
    // Auto focus on typing anywhere on screen
    document.addEventListener('keydown', () => gameInput.focus());

    timerInterval = setInterval(updateTimer, 1000);
}

function updateTimer() {
    const now = new Date();
    const diff = Math.floor((now - startTime) / 1000);
    const m = Math.floor(diff / 60).toString().padStart(2, '0');
    const s = (diff % 60).toString().padStart(2, '0');
    timerDisplay.innerText = `${m}:${s}`;
}

function renderSentence() {
    const currentInput = gameInput.value;
    sentenceDisplay.innerHTML = '';
    
    targetSentence.split('').forEach((char, index) => {
        const span = document.createElement('span');
        span.innerText = char;
        
        if (index < currentInput.length) {
            if (char === currentInput[index]) {
                span.className = 'correct';
            } else {
                span.className = 'incorrect';
            }
        } else if (index === currentInput.length) {
            span.className = 'current';
        }
        
        sentenceDisplay.appendChild(span);
    });
}

gameInput.addEventListener('input', () => {
    if (!isGameActive) return;

    const currentInput = gameInput.value;
    renderSentence();

    // Calculate Progress
    const progress = Math.min((currentInput.length / targetSentence.length) * 100, 100);
    
    // 1. Hitung WPM (Gross WPM)
    // Rumus: (Jumlah Karakter / 5) / Waktu (Menit)
    const timeElapsedMinutes = (new Date() - startTime) / 1000 / 60;
    const totalCharsTyped = currentInput.length;
    const grossWpm = (totalCharsTyped / 5) / timeElapsedMinutes;
    
    // 2. Hitung Akurasi (%)
    // Rumus: ((Total Karakter - Karakter Salah) / Total Karakter) * 100
    let incorrectChars = 0;
    for (let i = 0; i < currentInput.length; i++) {
        if (currentInput[i] !== targetSentence[i]) incorrectChars++;
    }
    const accuracy = totalCharsTyped > 0 
        ? Math.round(((totalCharsTyped - incorrectChars) / totalCharsTyped) * 100) 
        : 100;

    // 3. Hitung Net WPM
    // Rumus: WPM Kotor - Jumlah Kesalahan Kata
    // Kita estimasi kesalahan kata berdasarkan karakter yang salah (1 kata = 5 karakter)
    const wordErrors = incorrectChars / 5;
    const netWpm = Math.max(0, Math.round(grossWpm - wordErrors));

    wpmDisplay.innerText = netWpm; // Tampilkan Net WPM sebagai WPM utama
    accuracyDisplay.innerText = `${accuracy}%`;

    // Emit Progress
    socket.emit('typing-progress', {
        roomCode: currentRoom,
        progress,
        wpm: netWpm,
        accuracy
    });

    // Check Finish
    // Game selesai jika panjang input sudah sama dengan panjang kalimat target
    if (currentInput.length >= targetSentence.length) {
        finishGame(netWpm, accuracy);
    }
});

function finishGame(wpm, accuracy) {
    if (!isGameActive) return; // Prevent double trigger
    
    isGameActive = false;
    clearInterval(timerInterval);
    
    const stats = {
        wpm,
        accuracy,
        errorRate: Math.max(0, 100 - accuracy)
    };

    console.log('Finishing game with stats:', stats);
    socket.emit('finish-game', { roomCode: currentRoom, stats });
    
    // Show Result Modal
    finalWpm.innerText = wpm;
    finalAccuracy.innerText = `${accuracy}%`;
    resultModal.classList.remove('hidden');
    
    // Tampilkan pesan menunggu lawan
    waitingOpponent.classList.remove('hidden');
    resultActions.classList.add('hidden');
    
    // Disable input
    gameInput.disabled = true;
}

socket.on('all-players-finished', (players) => {
    console.log('Semua pemain selesai!', players);
    
    // Pastikan timer berhenti secara total untuk semua pemain di tampilan ini
    isGameActive = false;
    clearInterval(timerInterval);
    
    // Sembunyikan modal individual agar tidak menghalangi hasil pertandingan
    resultModal.classList.add('hidden');
    waitingOpponent.classList.add('hidden');
    
    // Tampilkan tombol aksi di area hasil pertandingan
    if (matchActions) matchActions.classList.remove('hidden');
    
    // Bandingkan hasil pemain dalam match ini
    showMatchResults(players);
    
    // Tampilkan leaderboard global di bawah area game
    updateBattleRanking();

    // Otomatis scroll ke bagian hasil permainan agar pemain langsung melihat perbandingannya
    setTimeout(() => {
        matchResultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
});

function showMatchResults(players) {
    if (!matchComparisonCards) return;
    
    matchComparisonCards.innerHTML = '';
    
    // Ubah object players ke array dan hitung Performance Score
    // Rumus: (Net WPM * 0.8) + (Accuracy * 0.2) 
    const playerEntries = Object.entries(players)
        .map(([id, data]) => {
            const performanceScore = (data.wpm * 0.8) + (data.accuracy * 0.2);
            return { id, ...data, performanceScore };
        })
        .sort((a, b) => b.performanceScore - a.performanceScore);
    
    playerEntries.forEach((player, index) => {
        const isWinner = index === 0 && playerEntries.length > 1;
        const card = document.createElement('div');
        
        // Style kartu pemenang vs lainnya
        card.className = `p-8 rounded-[32px] border transition-all duration-500 transform hover:scale-[1.02] ${
            isWinner 
            ? 'bg-gradient-to-br from-yellow-500/20 to-orange-500/10 border-yellow-500/50 shadow-lg shadow-yellow-500/10' 
            : 'bg-slate-800/40 border-slate-700'
        }`;
        
        card.innerHTML = `
            <div class="flex justify-between items-start mb-6">
                <div class="flex items-center">
                    <div class="w-14 h-14 rounded-full ${isWinner ? 'bg-yellow-500/20' : 'bg-slate-800'} flex items-center justify-center mr-4 text-2xl border-2 ${isWinner ? 'border-yellow-500/50' : 'border-slate-700'}">
                        ${isWinner ? '👑' : player.username.charAt(0).toUpperCase()}
                    </div>
                    <div>
                        <h3 class="text-xl font-black ${isWinner ? 'text-yellow-400' : 'text-white'}">
                            ${player.username} ${player.id === socket.id ? '(Kamu)' : ''}
                        </h3>
                        <p class="text-xs font-bold uppercase tracking-widest text-slate-500">
                            ${isWinner ? 'WINNER!' : `Peringkat ${index + 1}`}
                        </p>
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Perf. Score</div>
                    <div class="text-xl font-black ${isWinner ? 'text-yellow-400' : 'text-blue-400'}">${Math.round(player.performanceScore)}</div>
                </div>
            </div>
            
            <div class="grid grid-cols-2 gap-4">
                <div class="bg-slate-900/50 p-4 rounded-2xl border ${isWinner && player.wpm > 100 ? 'border-blue-500/30' : 'border-transparent'}">
                    <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Kecepatan</div>
                    <div class="text-3xl font-black text-blue-400">${Math.round(player.wpm)} <span class="text-xs font-normal text-slate-500">WPM</span></div>
                </div>
                <div class="bg-slate-900/50 p-4 rounded-2xl border ${isWinner && player.accuracy > 95 ? 'border-purple-500/30' : 'border-transparent'}">
                    <div class="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Akurasi</div>
                    <div class="text-3xl font-black text-purple-400">${Math.round(player.accuracy)}%</div>
                </div>
            </div>
            <p class="mt-4 text-[10px] text-slate-500 italic text-center">
                Peringkat dihitung berdasarkan kombinasi Kecepatan (70%) dan Akurasi (30%).
            </p>
        `;
        
        matchComparisonCards.appendChild(card);
    });
    
    matchResultsSection.classList.remove('hidden');
}

async function updateBattleRanking() {
    try {
        const response = await fetch('/api/ranking');
        const data = await response.json();
        
        if (!battleRankingBody) return;
        
        battleRankingBody.innerHTML = '';
        battleRankingSection.classList.remove('hidden');

        if (data.length === 0) {
            battleRankingBody.innerHTML = `
                <tr>
                    <td colspan="4" class="px-8 py-10 text-center text-slate-500 italic text-sm">
                        Belum ada data statistik global.
                    </td>
                </tr>
            `;
            return;
        }
        
        data.forEach(player => {
            const tr = document.createElement('tr');
            tr.className = 'border-b border-slate-800 hover:bg-slate-800/30 transition';
            tr.innerHTML = `
                <td class="px-8 py-4 font-semibold text-slate-300">
                    <div class="flex items-center">
                        <div class="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center mr-2 text-[10px] text-slate-500 font-bold border border-slate-700">
                            ${player.username.charAt(0).toUpperCase()}
                        </div>
                        ${player.username}
                    </div>
                </td>
                <td class="px-8 py-4 text-center text-blue-400 font-bold">${Math.round(player.top_wpm)}</td>
                <td class="px-8 py-4 text-center text-purple-400 font-medium">${Math.round(player.avg_accuracy)}%</td>
                <td class="px-8 py-4 text-center text-slate-500 font-mono text-xs">${player.total_games}</td>
            `;
            battleRankingBody.appendChild(tr);
        });
        
    } catch (error) {
        console.error('Error updating battle ranking:', error);
    }
}

rematchBtn.addEventListener('click', () => {
    socket.emit('rematch', currentRoom);
});

if (rematchBtnBottom) {
    rematchBtnBottom.addEventListener('click', () => {
        socket.emit('rematch', currentRoom);
    });
}

socket.on('rematch-started', () => {
    // Reset UI untuk rematch
    resultModal.classList.add('hidden');
    if (matchActions) matchActions.classList.add('hidden');
    gameInput.disabled = false;
    gameInput.value = '';
    wpmDisplay.innerText = '0';
    accuracyDisplay.innerText = '100%';
    timerDisplay.innerText = '00:00';
    
    // Kembali ke lobby waiting
    lobbyControls.classList.remove('hidden');
    battleRankingSection.classList.add('hidden');
    matchResultsSection.classList.add('hidden');
    isGameActive = false;
    renderSentence();
    
    // Scroll back to top
    window.scrollTo({ top: 0, behavior: 'smooth' });
});

socket.on('player-finished', ({ id, stats }) => {
    // Optional: show a small toast notification when someone finishes
});
