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

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});