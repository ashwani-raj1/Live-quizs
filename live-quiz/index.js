// index.js
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const users = [];

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
  }
];

let currentQuestionIndex = 0;
let quizActive = false;
let questionTimer = null;
const QUESTION_DURATION = 15000; // 15 seconds

// --- NEW CODE: Countdown interval ---
let countdownInterval = null;

function sendNextQuestion() {
  // Clear any previous timers and intervals
  if (questionTimer) clearTimeout(questionTimer);
  if (countdownInterval) clearInterval(countdownInterval);

  if (currentQuestionIndex < quizQuestions.length) {
    const questionData = quizQuestions[currentQuestionIndex];
    const questionToSend = {
      question: questionData.question,
      options: questionData.options,
      questionNumber: currentQuestionIndex + 1
    };
    
    // --- NEW CODE: Send the initial timer value ---
    let timeLeft = QUESTION_DURATION / 1000;
    io.emit('timerUpdate', timeLeft);

    // Start a new countdown
    countdownInterval = setInterval(() => {
        timeLeft--;
        io.emit('timerUpdate', timeLeft);
    }, 1000);

    io.emit('newQuestion', questionToSend);
    console.log(`Sending Question ${currentQuestionIndex + 1}: ${questionData.question}`);

    questionTimer = setTimeout(() => {
      // Clear the countdown interval when the time runs out
      clearInterval(countdownInterval);
      currentQuestionIndex++;
      sendNextQuestion();
    }, QUESTION_DURATION);

  } else {
    quizActive = false;
    io.emit('quizFinished');
    console.log('Quiz finished!');
  }
}

function handleAnswer(socket, answer) {
  if (!quizActive || currentQuestionIndex >= quizQuestions.length) return;

  const correctAnswer = quizQuestions[currentQuestionIndex].answer;
  const user = users.find(u => u.id === socket.id);
  const isCorrect = (answer === correctAnswer);
  
  if (user && isCorrect) {
    const points = 10;
    user.score += points;
    console.log(`${user.name} got the correct answer! New score: ${user.score}`);
    io.emit('updateLeaderboard', users);
  } else {
    console.log(`${user.name} answered incorrectly or too late.`);
  }

  socket.emit('answerResult', { isCorrect, correctAnswer });
}

app.get('/', (req, res) => {
  res.sendFile(__dirname + '/index.html');
});

io.on('connection', (socket) => {
  console.log('A user connected');

  socket.on('register', (userName) => {
    const newUser = {
      id: socket.id,
      name: userName,
      score: 0,
    };
    users.push(newUser);
    console.log(`User registered: ${newUser.name}`);
    io.emit('updateLeaderboard', users);

    if (!quizActive && users.length >= 1) {
      quizActive = true;
      currentQuestionIndex = 0;
      console.log("Starting quiz...");
      sendNextQuestion();
    }
  });

  socket.on('submitAnswer', (answer) => {
    handleAnswer(socket, answer);
  });

  socket.on('disconnect', () => {
    const index = users.findIndex(user => user.id === socket.id);
    if (index !== -1) {
      const user = users[index];
      users.splice(index, 1);
      console.log(`${user.name} disconnected.`);
      io.emit('updateLeaderboard', users);
      
      if (users.length === 0 && questionTimer) {
        clearTimeout(questionTimer);
        clearInterval(countdownInterval);
        quizActive = false;
        console.log("All users disconnected. Quiz stopped.");
      }
    }
  });
});

server.listen(3000, () => {
  console.log('Server is running on http://localhost:3000');
});