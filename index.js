// index.js
const express = require('express');
const http = require('http');
const cors = require('cors');
const { Server } = require('socket.io');

const app = express();
app.use(cors()); 

const server = http.createServer(app);

const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Store connected users
const users = [];
let gameState = {
    quizActive: false,
    currentQuestionIndex: 0,
    questionTimer: null,
    countdownInterval: null,
    waitingForPlayers: true
};

const quizQuestions = [
  {
    question: "What was Google's original name?",
    options: ["SearchEngine", "BackRub", "Googolplex", "The Answer"],
    answer: "BackRub"
  },
  {
    question: "What year was Google founded?",
    options: ["1996", "1998", "2000", "2004"],
    answer: "1998"
  },
  {
    question: "What is the name of Google's operating system for mobile devices?",
    options: ["Chrome OS", "Android", "Google Phone OS", "Flutter"],
    answer: "Android"
  },
  {
    question: "Who co-founded Google with Larry Page?",
    options: ["Elon Musk", "Steve Wozniak", "Sergey Brin", "Bill Gates"],
    answer: "Sergey Brin"
  },
  {
    question: "What is the name of the company that owns Google?",
    options: ["Alphabet Inc.", "Microsoft", "Meta", "Google X"],
    answer: "Alphabet Inc."
  },
  {
    question: "What is the name of Google's cloud storage service?",
    options: ["Google Cloud", "Google Drive", "Google Photos", "Google Docs"],
    answer: "Google Drive"
  },
  {
    question: "What is the programming language that was developed by Google?",
    options: ["Python", "Java", "Go", "C++"],
    answer: "Go"
  },
  {
    question: "What is the name of Google's headquarter complex?",
    options: ["Google HQ", "The Campus", "Googleplex", "Google Park"],
    answer: "Googleplex"
  },
  {
    question: "What is the name of Google's AI assistant?",
    options: ["Siri", "Alexa", "Cortana", "Google Assistant"],
    answer: "Google Assistant"
  },
  {
    question: "What is the official name of the Google logo with the 'G' and four colors?",
    options: ["The Google G", "The Alphabet", "The Logomark", "The Google Mark"],
    answer: "The Google Mark"
  }
];

const QUESTION_DURATION = 15000; // 15 seconds
const QUIZ_START_DELAY = 5000; // 5 seconds delay before starting quiz

function clearTimers() {
  if (gameState.questionTimer) {
    clearTimeout(gameState.questionTimer);
    gameState.questionTimer = null;
  }
  if (gameState.countdownInterval) {
    clearInterval(gameState.countdownInterval);
    gameState.countdownInterval = null;
  }
}

function sendNextQuestion() {
  clearTimers();

  if (gameState.currentQuestionIndex < quizQuestions.length) {
    const questionData = quizQuestions[gameState.currentQuestionIndex];
    const questionToSend = {
      question: questionData.question,
      options: questionData.options,
      questionNumber: gameState.currentQuestionIndex + 1,
      totalQuestions: quizQuestions.length
    };
    
    console.log(`Sending Question ${gameState.currentQuestionIndex + 1}: ${questionData.question}`);
    
    // Reset user answers for this question
    users.forEach(user => {
      user.hasAnswered = false;
    });
    
    // Start countdown timer
    let timeLeft = QUESTION_DURATION / 1000;
    io.emit('timerUpdate', timeLeft);
    io.emit('newQuestion', questionToSend);

    gameState.countdownInterval = setInterval(() => {
        timeLeft--;
        io.emit('timerUpdate', timeLeft);
        
        if (timeLeft <= 0) {
          clearInterval(gameState.countdownInterval);
        }
    }, 1000);

    // Set timeout for next question
    gameState.questionTimer = setTimeout(() => {
      gameState.currentQuestionIndex++;
      sendNextQuestion();
    }, QUESTION_DURATION);

  } else {
    // Quiz finished
    endQuiz();
  }
}

function endQuiz() {
  gameState.quizActive = false;
  clearTimers();
  
  console.log('Quiz finished!');
  console.log('Final scores:', users.map(u => `${u.name}: ${u.score}`));
  
  io.emit('quizFinished');
  io.emit('updateLeaderboard', users);
  
  // Reset for next game
  setTimeout(() => {
    resetGame();
  }, 30000); // Reset after 30 seconds
}

function resetGame() {
  gameState = {
    quizActive: false,
    currentQuestionIndex: 0,
    questionTimer: null,
    countdownInterval: null,
    waitingForPlayers: true
  };
  
  // Reset all user scores
  users.forEach(user => {
    user.score = 0;
    user.hasAnswered = false;
  });
  
  io.emit('gameReset');
  console.log('Game reset - ready for new players');
}

function startQuizCountdown() {
  if (gameState.quizActive || !gameState.waitingForPlayers) return;
  
  gameState.waitingForPlayers = false;
  console.log('Starting quiz countdown...');
  
  io.emit('quizStarting', { countdown: QUIZ_START_DELAY / 1000 });
  
  setTimeout(() => {
    if (users.length > 0) {
      gameState.quizActive = true;
      gameState.currentQuestionIndex = 0;
      console.log('Quiz starting with', users.length, 'players');
      sendNextQuestion();
    } else {
      gameState.waitingForPlayers = true;
      console.log('No players found, resetting to waiting state');
    }
  }, QUIZ_START_DELAY);
}

function handleAnswer(socket, answer) {
  if (!gameState.quizActive || gameState.currentQuestionIndex >= quizQuestions.length) {
    console.log('Answer submitted but quiz not active or finished');
    return;
  }

  const user = users.find(u => u.id === socket.id);
  if (!user) {
    console.log('User not found for answer submission');
    return;
  }
  
  if (user.hasAnswered) {
    console.log(`${user.name} already answered this question`);
    return;
  }

  const correctAnswer = quizQuestions[gameState.currentQuestionIndex].answer;
  const isCorrect = (answer === correctAnswer);
  
  user.hasAnswered = true;
  
  if (isCorrect) {
    const points = 10;
    user.score += points;
    console.log(`${user.name} got the correct answer! New score: ${user.score}`);
  } else {
    console.log(`${user.name} answered incorrectly. Answer was: ${answer}, Correct: ${correctAnswer}`);
  }

  // Send result to the specific user
  socket.emit('answerResult', { isCorrect, correctAnswer });
  
  // Update leaderboard for all users
  io.emit('updateLeaderboard', users);
  
  // Check if all users have answered
  const allAnswered = users.every(u => u.hasAnswered);
  if (allAnswered) {
    console.log('All users answered - moving to next question');
    clearTimers();
    setTimeout(() => {
      gameState.currentQuestionIndex++;
      sendNextQuestion();
    }, 2000); // 2 second delay to show results
  }
}

function removeUser(socketId) {
  const userIndex = users.findIndex(u => u.id === socketId);
  if (userIndex !== -1) {
    const removedUser = users.splice(userIndex, 1)[0];
    console.log(`User disconnected: ${removedUser.name}`);
    io.emit('updateLeaderboard', users);
    
    // If no users left and quiz is active, reset the game
    if (users.length === 0 && gameState.quizActive) {
      console.log('No users left - resetting game');
      endQuiz();
    }
  }
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('New connection:', socket.id);
  
  // Send current game state to new connection
  socket.emit('gameState', {
    quizActive: gameState.quizActive,
    waitingForPlayers: gameState.waitingForPlayers,
    userCount: users.length
  });
  
  socket.emit('updateLeaderboard', users);

  socket.on('register', (userName) => {
    if (!userName || typeof userName !== 'string') {
      socket.emit('registrationError', 'Invalid username');
      return;
    }
    
    // Check if username already exists
    const existingUser = users.find(u => u.name === userName);
    if (existingUser) {
      socket.emit('registrationError', 'Username already taken');
      return;
    }
    
    const user = { 
      id: socket.id, 
      name: userName.trim(), 
      score: 0,
      hasAnswered: false 
    };
    
    users.push(user);
    console.log(`User registered: ${userName} (Total users: ${users.length})`);
    
    socket.emit('registrationSuccess', user);
    io.emit('updateLeaderboard', users);
    
    // Start quiz countdown if this is the first user and we're waiting
    if (users.length === 1 && gameState.waitingForPlayers && !gameState.quizActive) {
      startQuizCountdown();
    }
  });

  socket.on('submitAnswer', (answer) => {
    handleAnswer(socket, answer);
  });
  
  socket.on('adminStartQuiz', () => {
    // Admin command to start quiz immediately
    if (!gameState.quizActive && users.length > 0) {
      gameState.waitingForPlayers = false;
      gameState.quizActive = true;
      gameState.currentQuestionIndex = 0;
      console.log('Admin started quiz with', users.length, 'players');
      sendNextQuestion();
    }
  });
  
  socket.on('adminResetQuiz', () => {
    // Admin command to reset quiz
    console.log('Admin reset quiz');
    endQuiz();
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    removeUser(socket.id);
  });
  
  socket.on('error', (error) => {
    console.error('Socket error:', error);
  });
});

// Express routes
app.get('/', (req, res) => {
  res.json({
    message: 'Google GDG Quiz Server is running!',
    status: 'active',
    users: users.length,
    quizActive: gameState.quizActive,
    currentQuestion: gameState.currentQuestionIndex + 1,
    totalQuestions: quizQuestions.length
  });
});

app.get('/stats', (req, res) => {
  res.json({
    connectedUsers: users.length,
    gameState: {
      quizActive: gameState.quizActive,
      currentQuestionIndex: gameState.currentQuestionIndex,
      waitingForPlayers: gameState.waitingForPlayers
    },
    leaderboard: users.sort((a, b) => b.score - a.score)
  });
});

app.get('/reset', (req, res) => {
  resetGame();
  res.json({ message: 'Game reset successfully' });
});

// Error handling
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    process.exit(0);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Google GDG Quiz Server is running on port ${PORT}`);
  console.log(`📊 Access stats at: http://localhost:${PORT}/stats`);
  console.log(`🔄 Reset game at: http://localhost:${PORT}/reset`);
});