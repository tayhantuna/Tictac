import { initializeApp } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js';
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, onSnapshot, arrayUnion, collection, getDocs, addDoc, serverTimestamp, runTransaction } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-firestore.js';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'https://www.gstatic.com/firebasejs/9.6.1/firebase-storage.js';

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyC4vrcSQADWUkej9as6c0-xXGaKZua658Y",
  authDomain: "pekunotdefteri.firebaseapp.com",
  projectId: "pekunotdefteri",
  storageBucket: "pekunotdefteri.appspot.com",
  messagingSenderId: "745858281395",
  appId: "1:745858281395:web:3bc79f15d421027c4425c6",
  measurementId: "G-4GG01LS0E5"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const storage = getStorage(app);
let userId;
let roomName = "";
onAuthStateChanged(auth, (user) => {
    if (user) {
        console.log('User signed in:', user.uid);
    userId = auth.currentUser.uid;
        
    } else {
        console.log('User signed out');
    }
});

const cells = document.querySelectorAll('.cell');
const resetBtn = document.getElementById('resetBtn');
const messageEl = document.getElementById('message');
const roomInput = document.getElementById('roomInput');
const joinRoomBtn = document.getElementById('joinRoomBtn');
const chatMessages = document.getElementById('chatMessages');
const chatInput = document.getElementById('chatInput');
const sendChatBtn = document.getElementById('sendChatBtn');
const signUpBtn = document.getElementById('signUpBtn');
const signInBtn = document.getElementById('signInBtn');
const signOutBtn = document.getElementById('signOutBtn');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const displayNameInput = document.getElementById('displayName');
const profileImageInput = document.getElementById('profileImage');
let currentPlayer = 'X';
let gameActive = true;
let playerSymbol = '';

joinRoomBtn.addEventListener('click', joinRoom);
sendChatBtn.addEventListener('click', sendMessage);
signUpBtn.addEventListener('click', signUp);
signInBtn.addEventListener('click', signIn);
signOutBtn.addEventListener('click', signOutUser);

async function joinRoom() {
    roomName = roomInput.value.trim();
            // Kullanıcının bağlantısını izleme işlemi başlatma
    if (!roomName) return;

    roomInput.disabled = true;
    joinRoomBtn.disabled = true;

    try {
        const roomRef = doc(db, 'rooms', roomName);

        await runTransaction(db, async (transaction) => {
            const roomDoc = await transaction.get(roomRef);

            if (roomDoc.exists()) {
                const roomData = roomDoc.data();
                if (roomData.players.length < 2) {
                    playerSymbol = roomData.players.includes('X') ? 'O' : 'X';
                    transaction.update(roomRef, {
                        players: arrayUnion(playerSymbol)
                    });
                } else {
                    throw new Error('Room is full. please try another roomcode ');
                }
            } else {
                playerSymbol = 'X';
                transaction.set(roomRef, {
                    board: ['', '', '', '', '', '', '', '', ''],
                    currentPlayer: 'X',
                    gameActive: true,
                    players: ['X']
                });
            }
        });

        startGame(roomRef);
    } catch (e) {
        alert(e.message);
        roomInput.disabled = false;
        joinRoomBtn.disabled = false;
    }
}

function startGame(roomRef) {
    onSnapshot(roomRef, (doc) => {
        const data = doc.data();
        updateBoard(data.board);
        currentPlayer = data.currentPlayer;
        gameActive = data.gameActive;
        messageEl.innerText = gameActive ? `Player ${currentPlayer}'s turn` : '';
    });

    onSnapshot(collection(roomRef, 'chat'), renderMessages);

    cells.forEach(cell => cell.addEventListener('click', (event) => handleCellClick(event, roomRef)));
    resetBtn.addEventListener('click', () => resetGame(roomRef));

    document.getElementById('board').classList.remove('hidden');
    resetBtn.classList.remove('hidden');
    document.getElementById('chat').classList.remove('hidden');
}

async function handleCellClick(event, roomRef) {
    const index = parseInt(event.target.getAttribute('data-index'));
    const docSnap = await getDoc(roomRef);

    if (docSnap.exists() && gameActive) {
        const data = docSnap.data();
        const board = data.board;

        if (board[index] !== '' || !gameActive || currentPlayer !== playerSymbol) {
            return;
        }

        board[index] = playerSymbol;
        if (checkWin(board)) {
            gameActive = false;
            messageEl.innerText = `Player ${playerSymbol} wins!`;
        } else if (!board.includes('')) {
            gameActive = false;
            messageEl.innerText = `It's a draw!`;
        } else {
            currentPlayer = currentPlayer === 'X' ? 'O' : 'X';
            messageEl.innerText = `Player ${currentPlayer}'s turn`;
        }

        await updateDoc(roomRef, {
            board: board,
            currentPlayer: currentPlayer,
            gameActive: gameActive
        });
    }
}

function updateBoard(board) {
    board.forEach((cell, index) => {
        cells[index].innerText = cell;
    });
}

function checkWin(board) {
    const winningConditions = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];

    for (let i = 0; i < winningConditions.length; i++) {
        const [a, b, c] = winningConditions[i];
        if (board[a] !== '' && board[a] === board[b] && board[a] === board[c]) {
            return true;
        }
    }
    return false;
}

async function resetGame(roomRef) {
    const board = ['', '', '', '', '', '', '', '', ''];
    currentPlayer = 'X';
    gameActive = true;
    await updateDoc(roomRef, {
        board: board,
        currentPlayer: currentPlayer,
        gameActive: gameActive
    });
}

async function sendMessage() {
    const message = chatInput.value.trim();
    if (!message) return;

    const roomRef = doc(db, 'rooms', roomName);
    const user = auth.currentUser;

    if (user) {
        const displayName = user.displayName || 'Anonymous';
        const photoURL = user.photoURL || '';

        await addDoc(collection(roomRef, 'chat'), {
            player: displayName,
            profileImage: photoURL,
            text: message,
            timestamp: serverTimestamp()
        });
    } else {
        console.log('User not signed in');
    }

    chatInput.value = '';
}

function renderMessages(snapshot) {
    chatMessages.innerHTML = '';
    snapshot.forEach(doc => {
        const message = doc.data();
        chatMessages.innerHTML += `
            <div class="message">
                <img src="${message.profileImage}" alt="Profile Image">
                <p><strong>${message.player}:</strong> ${message.text}</p>
            </div>`;
    });
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

async function signUp() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    const displayName = displayNameInput.value.trim();
    const profileImageFile = profileImageInput.files[0];

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        let photoURL = '';
        if (profileImageFile) {
            const storageRef = ref(storage, 'profileImages/' + user.uid + '/' + profileImageFile.name);
            await uploadBytes(storageRef, profileImageFile);
            photoURL = await getDownloadURL(storageRef);
        }

        await updateProfile(user, {
            displayName: displayName,
            photoURL: photoURL
        });

        console.log('Signed up:', user.uid);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function signIn() {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log('Signed in:', user.uid);
    } catch (error) {
        console.error('Error:', error.message);
    }
}

async function signOutUser() {
    try {
        await signOut(auth);
        console.log('Signed out');
    } catch (error) {
        console.error('Error:', error.message);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    cells.forEach(cell => cell.addEventListener('click', handleCellClick));
    resetBtn.addEventListener('click', () => resetGame(doc(db, 'rooms', roomName)));
    joinRoomBtn.addEventListener('click', joinRoom);
    sendChatBtn.addEventListener('click', sendMessage);
    signUpBtn.addEventListener('click', signUp);
    signInBtn.addEventListener('click', signIn);
    signOutBtn.addEventListener('click', signOutUser);
    
});

