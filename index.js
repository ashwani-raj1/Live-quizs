// index.js
const express = require('express');
const http = require('http');
const cors = require('cors'); // NEW
const { Server } = require('socket.io');

const app = express();
app.use(cors()); // NEW
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allows any origin to connect, be careful in production
        methods: ["GET", "POST"]
    }
});

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
let countdownInterval = null;
const QUESTION_DURATION = 15000;

function sendNextQuestion() {
  if (questionTimer) clearTimeout(questionTimer);
  if (countdownInterval) clearInterval(countdownInterval);

  if (currentQuestionIndex < quizQuestions.length) {
    const questionData = quizQuestions[currentQuestionIndex];
    const questionToSend = {
      question: questionData.question,
      options: questionData.options,
      questionNumber: currentQuestionIndex + 1
    };
    
    let timeLeft = QUESTION_DURATION / 1000;
    io.emit('timerUpdate', timeLeft);

    countdownInterval = setInterval(() => {
        timeLeft--;
        io.emit('timerUpdate', timeLeft);
    }, 1000);

    io.emit('newQuestion', questionToSend);
    console.log(`Sending Question ${currentQuestionIndex + 1}: ${questionData.question}`);

    questionTimer = setTimeout(() => {
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
  res.send('Server is running. Access the frontend via GitHub Pages.');
});

// NEW: Use the port provided by the hosting service
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});