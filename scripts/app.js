// Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, collection, onSnapshot, getDocs, query, where, arrayUnion, deleteDoc, arrayRemove } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// Firebase configuration
// مهم: قم باستبدال هذه القيم بقيم مشروعك على Firebase
const firebaseConfig = {
    apiKey: "AIzaSyBQOYfNpEnrW5a5k8yp0mezXWdOZCgGR_A",
    authDomain: "badr-23612.firebaseapp.com",
    projectId: "badr-23612",
    storageBucket: "badr-23612.firebase-app.com",
    messagingSenderId: "75263319914",
    appId: "1:75263319914:web:e99f09e8ee494fbc65cf13",
    measurementId: "G-W0Q11GPSJ8"
};
const appId = "default-app-id";
let unsubscribeGroupListener = null;

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentGroupId = null;
let currentGroupData = null;
let timer = null;
const roundTime = 30; // 30 seconds per round

// Game 1: Memory Game variables and logic
const EMOJIS = ["🦁","🐼","🐶","🐱","🐵","🦊","🐸","🐯","🐨","🐷","🦄","🐰"];
const state = {
  grid: '3x3',
  first: null,
  second: null,
  lock: false,
  moves: 0,
  matchedCount: 0,
  totalPairs: 0,
  timerId: null,
  startTime: null,
};
const game1BoardEl = document.getElementById('board');
const game1MovesEl = document.getElementById('moves');
const game1TimeEl = document.getElementById('time');
const game1RevealedEl = document.getElementById('revealed');
const game1WinBox = document.getElementById('winBox');
const game1WinMoves = document.getElementById('winMoves');
const game1WinTime = document.getElementById('winTime');
const game1ModeSelect = document.getElementById('modeSelect');
const game1RestartBtn = document.getElementById('restartBtn');
const game1WinBoxCloseBtn = document.getElementById('closeWinBox');


// Function to show/hide loading spinner
function showLoading(buttonId, spinnerId) {
    const button = document.getElementById(buttonId);
    const spinner = document.getElementById(spinnerId);
    if (button && spinner) {
        button.disabled = true;
        spinner.classList.remove('hidden');
    }
}

function hideLoading(buttonId, spinnerId) {
    const button = document.getElementById(buttonId);
    const spinner = document.getElementById(spinnerId);
    if (button && spinner) {
        button.disabled = false;
        spinner.classList.add('hidden');
    }
}

// Function to start a timer
function startTimer(timerElementId, onTimerEnd) {
    stopTimer();
    let timeLeft = roundTime;
    const timerElement = document.getElementById(timerElementId);
    if (!timerElement) return;

    timerElement.textContent = timeLeft;

    timer = setInterval(() => {
        timeLeft--;
        timerElement.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timer);
            onTimerEnd();
        }
    }, 1000);
}

// Function to stop the timer
function stopTimer() {
    if (timer) {
        clearInterval(timer);
        timer = null;
    }
}

// Function to display a specific screen and hide the rest
function showScreen(screenId) {
    stopTimer();
    document.querySelectorAll('.screen').forEach(screen => {
        screen.style.display = 'none';
    });
    document.getElementById(screenId).style.display = 'flex';
}

// Function to display status or error messages
function showMessage(elementId, message, type = 'status') {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = message;
        element.style.display = 'block';
        if (type === 'error') {
            element.classList.remove('bg-d1fae5', 'text-065f46');
            element.classList.add('bg-fecaca', 'text-b91c1c');
        } else {
            element.classList.remove('bg-fecaca', 'text-b91c1c');
            element.classList.add('bg-d1fae5', 'text-065f46');
        }
        setTimeout(() => { element.style.display = 'none'; }, 5000);
    }
}

// Function to generate a unique group code
async function generateGroupCode() {
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const numbers = '0123456789';
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    for (let i = 0; i < 2; i++) {
        code += numbers.charAt(Math.floor(Math.random() * numbers.length));
    }
    const groupsRef = collection(db, `groups`);
    const q = query(groupsRef, where("__name__", "==", code));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) {
        return generateGroupCode();
    }
    return code;
}

// Function to start the game
async function startGame() {
    if (!currentGroupId || !currentGroupData) return;

    showLoading('start-game-btn', 'start-game-spinner');
    showMessage('group-details-message', 'جاري بدء اللعبة...');

    const groupRef = doc(db, `groups`, currentGroupId);
    try {
        const playerIds = currentGroupData.players.map(p => p.id);
        
        await updateDoc(groupRef, {
            gameStatus: 'asking',
            playersOrder: playerIds,
            currentPlayerId: playerIds[0],
            currentRound: 1,
            currentPlayerIndex: 0
        });

        hideLoading('start-game-btn', 'start-game-spinner');
        showMessage('group-details-message', 'تم بدء اللعبة بنجاح!');
    } catch (error) {
        console.error("Error starting game:", error);
        hideLoading('start-game-btn', 'start-game-spinner');
        showMessage('error-message', 'فشل بدء اللعبة. حاول مرة أخرى.', 'error');
    }
}

// Function to update the UI based on the game state in Firestore
function handleGameStateChange() {
    const user = auth.currentUser;
    if (!user || !currentGroupId || !currentGroupData) return;

    const groupData = currentGroupData;
    const startGameBtn = document.getElementById('start-game-btn');
    const spinner = document.getElementById('start-game-spinner');
    const creatorMessage = document.getElementById('creator-message');
    const playerCountSpan = document.getElementById('player-count');

    // Show/hide start button based on creator ID
    if (groupData.creatorId === user.uid) {
        startGameBtn.classList.remove('hidden');
        creatorMessage.classList.add('hidden');
        if (groupData.players.length >= 4) {
            startGameBtn.disabled = false;
        } else {
            startGameBtn.disabled = true;
        }
    } else {
        startGameBtn.classList.add('hidden');
        creatorMessage.classList.remove('hidden');
    }
    
    const playersList = document.getElementById('players-list');
    if (playersList) {
        playersList.innerHTML = '';
        groupData.players.forEach(player => {
            const li = document.createElement('li');
            li.textContent = `${player.name}: ${player.score} نقطة`;
            playersList.appendChild(li);
        });
    }

    if (playerCountSpan) {
        playerCountSpan.textContent = groupData.players.length;
    }
    
    if (groupData.gameStatus === 'voting') {
        const votedCount = groupData.players.filter(p => p.hasVoted).length;
        const totalPlayers = groupData.players.length;
        const votingStatusText = `تم التصويت: ${votedCount} من ${totalPlayers}`;
        
        const votingStatusWaiting = document.getElementById('voting-status-waiting');
        if (votingStatusWaiting) votingStatusWaiting.textContent = votingStatusText;

        const votingStatusVoting = document.getElementById('voting-status-voting');
        if (votingStatusVoting) votingStatusVoting.textContent = votingStatusText;
    } else {
        const votingStatusWaiting = document.getElementById('voting-status-waiting');
        if (votingStatusWaiting) votingStatusWaiting.textContent = '';
        const votingStatusVoting = document.getElementById('voting-status-voting');
        if (votingStatusVoting) votingStatusVoting.textContent = '';
    }

    // New logic for exit/leave buttons
    const exitGroupBtn = document.getElementById('exit-group-btn');
    const leaveGroupBtn = document.getElementById('leave-group-btn');

    if (groupData.creatorId === user.uid) {
        exitGroupBtn.classList.remove('hidden');
        leaveGroupBtn.classList.add('hidden');
    } else {
        exitGroupBtn.classList.add('hidden');
        leaveGroupBtn.classList.remove('hidden');
    }

    switch (groupData.gameStatus) {
        case 'waiting':
            break;
        case 'pre-game':
            document.getElementById('group-name').textContent = groupData.groupName;
            document.getElementById('group-code').textContent = currentGroupId;
            showScreen('group-details-screen');
            break;
        case 'asking':
            document.getElementById('current-round').textContent = groupData.currentRound;
            document.getElementById('waiting-round').textContent = groupData.currentRound;
            if (groupData.currentPlayerId === user.uid) {
                showScreen('ask-screen');
                startTimer('ask-timer', () => submitQuestion('auto'));
            } else {
                document.getElementById('waiting-player-name').textContent = 'شخص ما يطرح السؤال';
                showScreen('waiting-screen');
            }
            break;
        case 'voting':
            document.getElementById('voting-round').textContent = groupData.currentRound;
            showVotingScreen(groupData);
            startTimer('voting-timer', () => startNextRoundOrEndGame());
            break;
        case 'summary':
            showSummaryScreen(groupData);
            break;
        case 'statistics':
            showStatisticsScreen(groupData);
            break;
    }
}

// Function to start listening for group changes in real-time
function startGroupListener(groupId) {
    if (unsubscribeGroupListener) {
        unsubscribeGroupListener();
    }
    const groupRef = doc(db, `groups`, groupId);
    unsubscribeGroupListener = onSnapshot(groupRef, (docSnap) => {
        if (docSnap.exists()) {
            currentGroupData = docSnap.data();
            handleGameStateChange();
        } else {
            console.log("Group does not exist or has been deleted.");
            showScreen('main-menu-screen');
        }
    });
}

// Function to display the voting screen
function showVotingScreen(groupData) {
    showScreen('voting-screen');
    document.getElementById('voting-question').textContent = groupData.currentQuestion;
    const votingContainer = document.getElementById('voting-container');
    votingContainer.innerHTML = '';
    
    groupData.players.forEach(player => {
        const button = document.createElement('button');
        button.textContent = player.name;
        button.classList.add('answer-btn');
        button.addEventListener('click', () => submitVote(player.id));
        votingContainer.appendChild(button);
    });

    const user = auth.currentUser;
    const myPlayer = groupData.players.find(p => p.id === user.uid);
    if (myPlayer && myPlayer.hasVoted) {
        document.getElementById('vote-status').textContent = 'لقد قمت بالتصويت بالفعل في هذه الجولة.';
        const allVotingButtons = document.getElementById('voting-container').querySelectorAll('.answer-btn');
        allVotingButtons.forEach(btn => {
            btn.disabled = true;
            if (btn.textContent === myPlayer.name) {
                btn.classList.add('voted-btn');
            }
        });
    } else {
        document.getElementById('vote-status').textContent = "";
        const allVotingButtons = document.getElementById('voting-container').querySelectorAll('.answer-btn');
        allVotingButtons.forEach(btn => btn.disabled = false);
    }
}

// Function to submit a vote
async function submitVote(playerId) {
    const user = auth.currentUser;
    if (!user || !currentGroupId || !currentGroupData) return;
    
    const groupRef = doc(db, `groups`, currentGroupId);
    const myPlayer = currentGroupData.players.find(p => p.id === user.uid);
    
    if (myPlayer.hasVoted) {
        showMessage('vote-status', 'لقد قمت بالتصويت بالفعل في هذه الجولة.', 'error');
        return;
    }
    
    try {
        const votes = currentGroupData.currentVotes || {};
        votes[playerId] = (votes[playerId] || 0) + 1;
        
        const playersUpdated = currentGroupData.players.map(p => {
            if (p.id === user.uid) {
                return { ...p, hasVoted: true };
            }
            return p;
        });

        await updateDoc(groupRef, { 
            currentVotes: votes,
            players: playersUpdated
        });
        
        document.getElementById('vote-status').textContent = 'تم تسجيل صوتك بنجاح!';
        const allVotingButtons = document.getElementById('voting-container').querySelectorAll('.answer-btn');
        allVotingButtons.forEach(btn => btn.disabled = true);
    } catch (error) {
        console.error("Error submitting vote:", error);
        document.getElementById('vote-status').textContent = 'فشل تسجيل الصوت. حاول مرة أخرى.';
    }
}

// Function to submit a question
async function submitQuestion(origin = 'user') {
    const questionInput = document.getElementById('question-input');
    const question = questionInput.value.trim();
    if (origin === 'user' && question.length < 5) {
        showMessage('error-message', 'الرجاء كتابة سؤال أطول.', 'error');
        return;
    }

    showLoading('submit-question-btn', 'submit-question-spinner');

    try {
        const groupRef = doc(db, `groups`, currentGroupId);
        await updateDoc(groupRef, {
            gameStatus: 'voting',
            currentQuestion: question
        });
        hideLoading('submit-question-btn', 'submit-question-spinner');
    } catch (error) {
        console.error("Error submitting question:", error);
        hideLoading('submit-question-btn', 'submit-question-spinner');
    }
}

// Function to display the final summary screen
function showSummaryScreen(groupData) {
    showScreen('summary-screen');
    const summaryContainer = document.getElementById('summary-container');
    summaryContainer.innerHTML = '';
    groupData.roundsData.forEach((round, index) => {
        const roundCard = document.createElement('div');
        roundCard.classList.add('summary-card');
        const roundTitle = document.createElement('h3');
        roundTitle.classList.add('text-lg', 'font-bold', 'mb-2');
        roundTitle.textContent = `الجولة ${index + 1}:`;
        roundCard.appendChild(roundTitle);
        const questionP = document.createElement('p');
        questionP.classList.add('font-semibold', 'mb-2');
        questionP.textContent = `السؤال: ${round.question}`;
        roundCard.appendChild(questionP);
        const votes = round.votes;
        const sortedPlayers = Object.keys(votes).sort((a, b) => votes[b] - votes[a]);
        if (sortedPlayers.length > 0) {
            const winnerId = sortedPlayers[0];
            const winnerName = groupData.players.find(p => p.id === winnerId)?.name || 'غير معروف';
            const winnerVotes = votes[winnerId];
            const winnerP = document.createElement('p');
            winnerP.classList.add('text-md', 'text-blue-600');
            winnerP.textContent = `أكثر تصويت: ${winnerName} (${winnerVotes} صوت)`;
            roundCard.appendChild(winnerP);
        }
        summaryContainer.appendChild(roundCard);
    });
}

// Function to display player statistics screen
function showStatisticsScreen(groupData) {
    showScreen('statistics-screen');
    const statisticsContainer = document.getElementById('statistics-container');
    statisticsContainer.innerHTML = '';
    
    // Check if there is roundsData to display
    if (!groupData.roundsData || groupData.roundsData.length === 0) {
        const noStatsMessage = document.createElement('p');
        noStatsMessage.classList.add('text-center', 'text-gray-500');
        noStatsMessage.textContent = 'لا توجد إحصائيات لعرضها حتى الآن.';
        statisticsContainer.appendChild(noStatsMessage);
        return;
    }
    
    groupData.roundsData.forEach((round, index) => {
        const statCard = document.createElement('div');
        statCard.classList.add('statistics-card', 'p-4', 'bg-gray-100', 'rounded-lg', 'shadow-md', 'mb-4');
        
        const roundTitle = document.createElement('h3');
        roundTitle.classList.add('text-lg', 'font-bold', 'text-blue-600', 'mb-2');
        roundTitle.textContent = `الجولة ${index + 1}`;
        statCard.appendChild(roundTitle);
        
        const questionText = document.createElement('p');
        questionText.classList.add('font-semibold', 'text-gray-800', 'mb-2');
        questionText.textContent = `السؤال: ${round.question}`;
        statCard.appendChild(questionText);
        
        const votes = round.votes;
        const sortedPlayers = Object.keys(votes).sort((a, b) => votes[b] - votes[a]);
        
        if (sortedPlayers.length > 0) {
            const winnerId = sortedPlayers[0];
            const winnerName = groupData.players.find(p => p.id === winnerId)?.name || 'غير معروف';
            const winnerVotes = votes[winnerId];
            
            const winnerInfo = document.createElement('p');
            winnerInfo.classList.add('text-md', 'text-green-600');
            winnerInfo.textContent = `أكثر تصويت: ${winnerName} (${winnerVotes} صوت)`;
            statCard.appendChild(winnerInfo);
        } else {
            const noVotesMessage = document.createElement('p');
            noVotesMessage.classList.add('text-md', 'text-gray-500');
            noVotesMessage.textContent = 'لم يتم التصويت في هذه الجولة.';
            statCard.appendChild(noVotesMessage);
        }
        
        statisticsContainer.appendChild(statCard);
    });
}


// Function to start the next round or end the game
async function startNextRoundOrEndGame() {
    const groupRef = doc(db, `groups`, currentGroupId);
    const groupData = currentGroupData;
    const newRoundData = { question: groupData.currentQuestion, votes: groupData.currentVotes };
    const updatedRoundsData = groupData.roundsData ? [...groupData.roundsData, newRoundData] : [newRoundData];
    let currentPlayerIndex = groupData.currentPlayerIndex;
    let currentRound = groupData.currentRound;
    const nextPlayerIndex = (currentPlayerIndex + 1);
    if (nextPlayerIndex >= groupData.playersOrder.length) {
        currentRound++;
        currentPlayerIndex = 0;
    } else {
        currentPlayerIndex = nextPlayerIndex;
    }
    if (currentRound > 5) {
        await updateDoc(groupRef, { gameStatus: 'summary', roundsData: updatedRoundsData, });
    } else {
        await updateDoc(groupRef, {
            gameStatus: 'asking',
            currentPlayerId: groupData.playersOrder[currentPlayerIndex],
            currentQuestion: '',
            currentVotes: {},
            currentPlayerIndex: currentPlayerIndex,
            currentRound: currentRound,
            players: groupData.players.map(p => ({ ...p, hasVoted: false }))
        });
    }
}

// Function to end the game
async function endGame() {
    const groupRef = doc(db, `groups`, currentGroupId);
    try {
        await updateDoc(groupRef, {
            gameStatus: 'waiting',
            currentPlayerId: null,
            currentQuestion: '',
            currentVotes: {},
            currentPlayerIndex: 0,
            currentRound: 1,
            playersOrder: [],
            roundsData: []
        });
        showScreen('main-menu-screen');
        currentGroupId = null;
        if (unsubscribeGroupListener) {
            unsubscribeGroupListener();
        }
    } catch (error) {
        console.error("Error ending game:", error);
    }
}

// New function to fetch and display user profile data
async function updateProfileScreen() {
    const user = auth.currentUser;
    if (user) {
        try {
            const userRef = doc(db, `users`, user.uid);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                document.getElementById('profile-name').textContent = userData.username;
                document.getElementById('profile-points').textContent = userData.points;
            } else {
                console.log("No such user document!");
            }
        } catch (error) {
            console.error("Error fetching user data:", error);
        }
    }
}

// User Authentication Functions
async function signup() {
    const email = document.getElementById('email-input-signup').value;
    const password = document.getElementById('password-input-signup').value;
    const username = document.getElementById('username-input-signup').value;
    if (!email || !password || !username) {
        showMessage('error-message', 'الرجاء إدخال جميع الحقول.', 'error');
        return;
    }
    showLoading('signup-btn', 'signup-spinner');
    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        const userRef = doc(db, `users`, user.uid);
        await setDoc(userRef, { username: username, points: 0, uid: user.uid });
        hideLoading('signup-btn', 'signup-spinner');
    } catch (error) {
        console.error("Error signing up:", error);
        showMessage('error-message', `فشل إنشاء الحساب: ${error.message}`, 'error');
        hideLoading('signup-btn', 'signup-spinner');
    }
}

async function login() {
    const email = document.getElementById('email-input-login').value;
    const password = document.getElementById('password-input-login').value;
    if (!email || !password) {
        showMessage('error-message', 'الرجاء إدخال البريد الإلكتروني وكلمة المرور.', 'error');
        return;
    }
    showLoading('login-btn', 'login-spinner');
    try {
        await signInWithEmailAndPassword(auth, email, password);
        // تم إضافة هذا السطر لعرض الشاشة الرئيسية مباشرة بعد تسجيل الدخول
        showScreen('main-menu-screen');
        hideLoading('login-btn', 'login-spinner');
    } catch (error) {
        console.error("Error logging in:", error);
        showMessage('error-message', `فشل تسجيل الدخول: ${error.message}`, 'error');
        hideLoading('login-btn', 'login-spinner');
    }
}

async function logout() {
    await signOut(auth);
    showScreen('auth-screen');
}

// Group Management Functions
async function createGroup() {
    const groupName = document.getElementById('group-name-input').value.trim();
    if (groupName.length < 3) {
        showMessage('error-message', 'يجب أن يكون اسم الجروب 3 أحرف على الأقل.', 'error');
        return;
    }
    showLoading('create-group-btn-final', 'create-group-spinner');
    try {
        const groupCode = await generateGroupCode();
        const user = auth.currentUser;
        if (!user) {
            showMessage('error-message', 'يجب أن تكون مسجلاً لإنشاء جروب.', 'error');
            hideLoading('create-group-btn-final', 'create-group-spinner');
            return;
        }

        const userRef = doc(db, `users`, user.uid);
        const userSnap = await getDoc(userRef);
        const username = userSnap.data()?.username || 'لاعب غير معروف';

        await setDoc(doc(db, `groups`, groupCode), {
            groupName: groupName,
            creatorId: user.uid,
            gameStatus: 'pre-game',
            players: [{ id: user.uid, name: username, score: 0 }],
            currentRound: 1,
            roundsData: []
        });

        currentGroupId = groupCode;
        startGroupListener(currentGroupId);
        
        // Update the UI directly after creating the group
        document.getElementById('group-name').textContent = groupName;
        document.getElementById('group-code').textContent = groupCode;
        showScreen('group-details-screen');

        hideLoading('create-group-btn-final', 'create-group-spinner');
    } catch (error) {
        console.error("Error creating group:", error);
        showMessage('error-message', 'فشل إنشاء الجروب. حاول مرة أخرى.', 'error');
        hideLoading('create-group-btn-final', 'create-group-spinner');
    }
}

async function joinGroup() {
    const groupCode = document.getElementById('group-code-input').value.trim().toUpperCase();
    if (groupCode.length !== 6) {
        showMessage('error-message', 'الرجاء إدخال رمز جروب صحيح.', 'error');
        return;
    }
    showLoading('join-group-btn-final', 'join-group-spinner');
    try {
        const groupRef = doc(db, `groups`, groupCode);
        const groupSnap = await getDoc(groupRef);

        if (!groupSnap.exists()) {
            showMessage('error-message', 'رمز الجروب غير صالح.', 'error');
            hideLoading('join-group-btn-final', 'join-group-spinner');
            return;
        }

        const groupData = groupSnap.data();
        const user = auth.currentUser;
        if (!user) {
            showMessage('error-message', 'يجب أن تكون مسجلاً للانضمام إلى جروب.', 'error');
            hideLoading('join-group-btn-final', 'join-group-spinner');
            return;
        }

        if (groupData.players.length >= 10) {
            showMessage('error-message', 'الجروب ممتلئ.', 'error');
            hideLoading('join-group-btn-final', 'join-group-spinner');
            return;
        }

        if (groupData.players.some(p => p.id === user.uid)) {
            currentGroupId = groupCode;
            startGroupListener(currentGroupId);
            // Update the UI directly when rejoining a group
            document.getElementById('group-name').textContent = groupData.groupName;
            document.getElementById('group-code').textContent = groupCode;
            showScreen('group-details-screen');
            hideLoading('join-group-btn-final', 'join-group-spinner');
            return;
        }

        const userRef = doc(db, `users`, user.uid);
        const userSnap = await getDoc(userRef);
        const username = userSnap.data()?.username || 'لاعب غير معروف';

        await updateDoc(groupRef, {
            players: arrayUnion({ id: user.uid, name: username, score: 0 })
        });

        currentGroupId = groupCode;
        startGroupListener(currentGroupId);
        
        // Update the UI directly after joining a group
        document.getElementById('group-name').textContent = groupData.groupName;
        document.getElementById('group-code').textContent = groupCode;
        showScreen('group-details-screen');

        hideLoading('join-group-btn-final', 'join-group-spinner');
    } catch (error) {
        console.error("Error joining group:", error);
        showMessage('error-message', 'فشل الانضمام إلى الجروب. حاول مرة أخرى.', 'error');
        hideLoading('join-group-btn-final', 'join-group-spinner');
    }
}

// New function to delete the group and exit for the creator
async function deleteGroupAndExit() {
    if (!currentGroupId) return;
    try {
        await deleteDoc(doc(db, "groups", currentGroupId));
        currentGroupId = null;
        if (unsubscribeGroupListener) {
            unsubscribeGroupListener();
        }
        showScreen('main-menu-screen');
    } catch (error) {
        console.error("Error deleting group:", error);
        showMessage('error-message', 'فشل حذف الجروب. حاول مرة أخرى.', 'error');
    }
}

// New function for players to leave the group
async function leaveGroup() {
    const user = auth.currentUser;
    if (!user || !currentGroupId || !currentGroupData) return;
    try {
        const groupRef = doc(db, `groups`, currentGroupId);
        const playerToRemove = currentGroupData.players.find(p => p.id === user.uid);
        if (playerToRemove) {
            await updateDoc(groupRef, {
                players: arrayRemove(playerToRemove)
            });
            currentGroupId = null;
            if (unsubscribeGroupListener) {
                unsubscribeGroupListener();
            }
            showScreen('main-menu-screen');
        }
    } catch (error) {
        console.error("Error leaving group:", error);
        showMessage('error-message', 'فشل ترك الجروب. حاول مرة أخرى.', 'error');
    }
}

// Memory Game Functions (Integrated from the new file)
function restartMemoryGame(){
    clearInterval(state.timerId); state.timerId = null; state.startTime = null;
    state.first = state.second = null; state.lock = false; state.moves = 0; state.matchedCount = 0;
    state.totalPairs = 0;
    if (game1MovesEl) game1MovesEl.textContent = '0';
    if (game1RevealedEl) game1RevealedEl.textContent = '0/2';
    if (game1TimeEl) game1TimeEl.textContent = '0s';
    if (game1WinBox) game1WinBox.classList.remove('show');
    buildMemoryBoard(state.grid);
}

function startMemoryTimer(){
    if(state.timerId) return;
    state.startTime = Date.now();
    state.timerId = setInterval(()=>{
        const s = Math.floor((Date.now()-state.startTime)/1000);
        if (game1TimeEl) game1TimeEl.textContent = s + 's';
    }, 250);
}

function buildMemoryBoard(grid){
    if (!game1BoardEl) return;
    game1BoardEl.innerHTML = '';
    const is3x3 = grid === '3x3';
    game1BoardEl.style.gridTemplateColumns = `repeat(${is3x3 ? 3 : 4}, 1fr)`;

    const pairsNeeded = is3x3 ? 4 : 6;
    state.totalPairs = pairsNeeded;

    const shuffledEmojis = shuffle(EMOJIS.slice());
    if(!shuffledEmojis.includes('🦁')) shuffledEmojis[0] = '🦁';
    const chosen = shuffledEmojis.slice(0, pairsNeeded);
    const deck = shuffle([...chosen, ...chosen]);

    const cards = [];
    for(let i=0;i<deck.length;i++){
        cards.push(createMemoryCard(deck[i]));
    }
    if(is3x3){
        cards.splice(Math.floor(Math.random()*9), 0, createBlockedCard());
    }

    cards.forEach(c => game1BoardEl.appendChild(c));
}

function createMemoryCard(symbol){
    const card = document.createElement('button');
    card.className = 'card';
    card.type = 'button';
    card.setAttribute('aria-label','بطاقة مخفية');
    card.dataset.symbol = symbol;

    const inner = document.createElement('div');
    inner.className = 'card-inner';

    const front = document.createElement('div');
    front.className = 'face front';
    front.textContent = '❓';

    const back = document.createElement('div');
    back.className = 'face back';
    back.textContent = symbol;

    inner.appendChild(front); inner.appendChild(back);
    card.appendChild(inner);

    card.addEventListener('click', ()=> onFlipMemoryCard(card));
    return card;
}

function createBlockedCard(){
    const card = document.createElement('div');
    card.className = 'card blocked';
    const inner = document.createElement('div'); inner.className = 'card-inner';
    const front = document.createElement('div'); front.className = 'face front';
    const back  = document.createElement('div'); back.className  = 'face back';
    inner.appendChild(front); inner.appendChild(back); card.appendChild(inner);
    return card;
}

function onFlipMemoryCard(card){
    if(card.classList.contains('matched') || card.classList.contains('flipped') || state.lock) return;
    if(card.classList.contains('blocked')) return;

    startMemoryTimer();
    flipMemoryCard(card, true);

    if(!state.first){
        state.first = card;
        if (game1RevealedEl) game1RevealedEl.textContent = '1/2';
    } else if(!state.second && card !== state.first){
        state.second = card;
        if (game1RevealedEl) game1RevealedEl.textContent = '2/2';
        state.moves++;
        if (game1MovesEl) game1MovesEl.textContent = state.moves;
        checkMemoryMatch();
    }
}

function flipMemoryCard(card, show){
    if(show){ card.classList.add('flipped'); card.setAttribute('aria-label','بطاقة مكشوفة'); }
    else     { card.classList.remove('flipped'); card.setAttribute('aria-label','بطاقة مخفية'); }
}

function checkMemoryMatch(){
    const a = state.first.dataset.symbol;
    const b = state.second.dataset.symbol;
    state.lock = true;

    if(a === b){
        setTimeout(()=>{
            state.first.classList.add('matched');
            state.second.classList.add('matched');
            resetMemoryPick();
            state.matchedCount++;
            if(state.matchedCount === state.totalPairs){ onWinMemoryGame(); }
        }, 250);
    } else {
        setTimeout(()=>{
            flipMemoryCard(state.first, false);
            flipMemoryCard(state.second, false);
            resetMemoryPick();
        }, 700);
    }
}

function resetMemoryPick(){
    state.first = state.second = null; state.lock = false;
    if (game1RevealedEl) game1RevealedEl.textContent = '0/2';
}

function onWinMemoryGame(){
    clearInterval(state.timerId); state.timerId = null;
    const totalS = Math.floor((Date.now()-state.startTime)/1000);
    if (game1WinMoves) game1WinMoves.textContent = state.moves;
    if (game1WinTime) game1WinTime.textContent = totalS;
    if (game1WinBox) game1WinBox.classList.add('show');
}

function quickHintMemoryGame(){
    const cards = [...document.querySelectorAll('#board .card:not(.blocked):not(.matched)')];
    if(!cards.length) return;
    cards.forEach(c => c.classList.add('flipped'));
    setTimeout(()=>{ cards.forEach(c => c.classList.remove('flipped')); }, 800);
}

function shuffle(arr){
    for(let i = arr.length - 1; i > 0; i--){
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

// Event Listeners
document.getElementById('show-login-btn')?.addEventListener('click', () => showScreen('login-form'));
document.getElementById('show-signup-btn')?.addEventListener('click', () => showScreen('signup-form'));
document.getElementById('back-to-auth-btn-1')?.addEventListener('click', () => showScreen('auth-screen'));
document.getElementById('back-to-auth-btn-2')?.addEventListener('click', () => showScreen('auth-screen'));
document.getElementById('login-btn')?.addEventListener('click', () => login());
document.getElementById('signup-btn')?.addEventListener('click', () => signup());
document.getElementById('logout-btn')?.addEventListener('click', () => logout());
document.getElementById('profile-btn')?.addEventListener('click', () => {
    showScreen('profile-screen');
    updateProfileScreen();
});
document.getElementById('create-group-btn')?.addEventListener('click', () => showScreen('create-group-screen'));
document.getElementById('join-group-btn')?.addEventListener('click', () => showScreen('join-group-screen'));
document.getElementById('games-btn')?.addEventListener('click', () => showScreen('games-screen'));
document.getElementById('game-1-btn')?.addEventListener('click', () => {
    showScreen('game-1-screen');
    restartMemoryGame();
});
document.getElementById('game-2-btn')?.addEventListener('click', () => showScreen('game-2-screen'));
document.getElementById('game-3-btn')?.addEventListener('click', () => showScreen('game-3-screen'));
document.getElementById('game-4-btn')?.addEventListener('click', () => showScreen('game-4-screen'));
document.getElementById('create-group-btn-final')?.addEventListener('click', () => createGroup());
document.getElementById('join-group-btn-final')?.addEventListener('click', () => joinGroup());
document.getElementById('start-game-btn')?.addEventListener('click', () => startGame());
document.getElementById('submit-question-btn')?.addEventListener('click', () => submitQuestion());
document.getElementById('end-game-btn')?.addEventListener('click', () => endGame());
document.getElementById('back-to-main-menu-1')?.addEventListener('click', () => showScreen('main-menu-screen'));
document.getElementById('back-to-main-menu-2')?.addEventListener('click', () => showScreen('main-menu-screen'));
document.getElementById('back-to-main-menu-3')?.addEventListener('click', () => showScreen('main-menu-screen'));
document.getElementById('back-to-main-menu-4')?.addEventListener('click', () => showScreen('main-menu-screen'));
document.getElementById('back-to-main-menu-5')?.addEventListener('click', () => showScreen('main-menu-screen'));
document.getElementById('back-to-main-menu-6')?.addEventListener('click', () => showScreen('main-menu-screen'));
document.getElementById('back-to-main-menu-7')?.addEventListener('click', () => showScreen('main-menu-screen'));
document.querySelectorAll('.back-to-games-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      showScreen('games-screen');
      // Stop the game timer when leaving the game screen
      clearInterval(state.timerId);
      state.timerId = null;
    });
});
document.getElementById('back-to-main-menu-from-games')?.addEventListener('click', () => showScreen('main-menu-screen'));

// Add copy button functionality
document.getElementById('copy-btn')?.addEventListener('click', () => {
    const groupCode = document.getElementById('group-code').textContent;
    navigator.clipboard.writeText(groupCode).then(() => {
        const copyStatus = document.getElementById('copy-status');
        copyStatus.style.display = 'block';
        setTimeout(() => {
            copyStatus.style.display = 'none';
        }, 2000);
    }).catch(err => {
        console.error('Failed to copy text: ', err);
    });
});

// Event listeners for the new buttons
document.getElementById('exit-group-btn')?.addEventListener('click', () => {
    document.getElementById('confirm-modal').classList.remove('hidden');
});
document.getElementById('confirm-yes')?.addEventListener('click', () => {
    document.getElementById('confirm-modal').classList.add('hidden');
    deleteGroupAndExit();
});
document.getElementById('confirm-no')?.addEventListener('click', () => {
    document.getElementById('confirm-modal').classList.add('hidden');
});
document.getElementById('leave-group-btn')?.addEventListener('click', () => {
    leaveGroup();
});

// Memory game specific event listeners
if (game1ModeSelect) {
  game1ModeSelect.addEventListener('change', (e) => {
    state.grid = e.target.value;
    restartMemoryGame();
  });
}
if (game1RestartBtn) {
  game1RestartBtn.addEventListener('click', restartMemoryGame);
}
document.getElementById('hintBtn')?.addEventListener('click', quickHintMemoryGame);
if (game1WinBoxCloseBtn) {
  game1WinBoxCloseBtn.addEventListener('click', () => {
    game1WinBox.classList.remove('show');
  });
}

auth.onAuthStateChanged(user => {
    if (user) {
        showScreen('main-menu-screen');
        // Initial profile data load
        updateProfileScreen();
    } else {
        showScreen('auth-screen');
    }
});
