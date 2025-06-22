const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);

const PORT = process.env.PORT || 3000;

app.use(express.static('public'));

let users = {};
let prices = {
  Bitcoin: 50000,
  Ethereum: 4000,
  BNB: 500,
  Litecoin: 150,
  Dogecoin: 0.25,
  Solana: 150,
  Tron: 0.1,
  Ripple: 1,
  Cardano: 2,
  Polkadot: 30,
};

function getRichestUsers() {
  return Object.values(users)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 10);
}

let roundData = {
  explodeAt: 0,
  inProgress: false,
  currentMultiplier: 1,
};

function startRound() {
  roundData.inProgress = true;
  roundData.currentMultiplier = 1;
  roundData.explodeAt = (Math.random() * 5) + 1.5;

  let interval = setInterval(() => {
    if (!roundData.inProgress) {
      clearInterval(interval);
      return;
    }
    roundData.currentMultiplier = Number((roundData.currentMultiplier + 0.05).toFixed(2));
    io.emit('multiplierUpdate', roundData.currentMultiplier);

    if (roundData.currentMultiplier >= roundData.explodeAt) {
      io.emit('roundEnd', roundData.explodeAt);
      roundData.inProgress = false;
      clearInterval(interval);
      setTimeout(() => {
        startRound();
      }, 4000);
    }
  }, 100);
}

io.on('connection', (socket) => {
  console.log('User connected', socket.id);

  socket.on('login', (username) => {
    if (!username || users[username]) {
      socket.emit('loginFailed', 'نام کاربری تکراری یا نامعتبر است');
      return;
    }
    users[username] = { balance: 1000, socketId: socket.id, bets: {}, username };
    socket.username = username;
    socket.emit('loginSuccess', users[username]);
    io.emit('leaderboard', getRichestUsers());
  });

  socket.on('placeBet', (amount) => {
    let user = users[socket.username];
    if (!user) return;
    amount = Number(amount);
    if (amount > user.balance) {
      socket.emit('betFailed', 'موجودی کافی نیست');
      return;
    }
    user.balance -= amount;
    user.bets.currentBet = amount;
    user.currentMultiplier = 1;
    socket.emit('betPlaced', amount);
    io.emit('leaderboard', getRichestUsers());
  });

  socket.on('cashOut', () => {
    let user = users[socket.username];
    if (!user || !user.bets.currentBet) return;
    let payout = Number((user.bets.currentBet * roundData.currentMultiplier).toFixed(2));
    user.balance += payout;
    delete user.bets.currentBet;
    socket.emit('cashedOut', payout);
    io.emit('leaderboard', getRichestUsers());
  });

  socket.on('updatePrice', ({ currency, price, adminPass }) => {
    if (adminPass !== 'arion76') return socket.emit('adminFailed', 'رمز ادمین اشتباه است');
    if (prices[currency] !== undefined) {
      prices[currency] = Number(price);
      io.emit('priceUpdate', prices);
    }
  });

  socket.on('buyCrypto', ({ currency, amount }) => {
    let user = users[socket.username];
    if (!user) return;
    let cost = amount * prices[currency];
    if (user.balance < cost) {
      socket.emit('buyFailed', 'موجودی کافی نیست');
      return;
    }
    user.balance -= cost;
    user.bets[currency] = (user.bets[currency] || 0) + amount;
    socket.emit('buySuccess', { currency, amount });
    io.emit('leaderboard', getRichestUsers());
  });

  socket.on('sellCrypto', ({ currency, amount }) => {
    let user = users[socket.username];
    if (!user) return;
    if (!user.bets[currency] || user.bets[currency] < amount) {
      socket.emit('sellFailed', 'مقدار ارز کافی نیست');
      return;
    }
    user.bets[currency] -= amount;
    let gain = amount * prices[currency];
    user.balance += gain;
    socket.emit('sellSuccess', { currency, amount });
    io.emit('leaderboard', getRichestUsers());
  });

  socket.on('chargeUser', ({ username, amount, adminPass }) => {
    if (adminPass !== 'arion76') return socket.emit('adminFailed', 'رمز ادمین اشتباه است');
    if (users[username]) {
      users[username].balance += Number(amount);
      io.to(users[username].socketId).emit('charged', amount);
      io.emit('leaderboard', getRichestUsers());
    }
  });

  socket.on('deleteUser', ({ username, adminPass }) => {
    if (adminPass !== 'arion76') return socket.emit('adminFailed', 'رمز ادمین اشتباه است');
    if (users[username]) {
      io.to(users[username].socketId).emit('deleted');
      delete users[username];
      io.emit('leaderboard', getRichestUsers());
    }
  });

  socket.on('disconnect', () => {
    if (socket.username && users[socket.username]) {
      delete users[socket.username];
      io.emit('leaderboard', getRichestUsers());
    }
    console.log('User disconnected', socket.id);
  });
});

startRound();

http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
