const socket = io();

let currentUser = null;
let chart = null;
let chartData = {
  labels: [],
  datasets: [{
    label: 'ضریب انفجار',
    data: [],
    borderColor: '#f1c40f',
    backgroundColor: 'rgba(241, 196, 15, 0.2)',
    fill: true,
    tension: 0.3,
  }]
};

function setupChart() {
  const ctx = document.getElementById('crashChart').getContext('2d');
  chart = new Chart(ctx, {
    type: 'line',
    data: chartData,
    options: {
      animation: {
        duration: 0
      },
      scales: {
        y: {
          beginAtZero: true,
          suggestedMin: 1,
          suggestedMax: 10
        }
      },
      plugins: {
        legend: { display: false }
      }
    }
  });
}

function updateChart(multiplier) {
  if (chartData.labels.length > 50) {
    chartData.labels.shift();
    chartData.datasets[0].data.shift();
  }
  chartData.labels.push(chartData.labels.length + 1);
  chartData.datasets[0].data.push(multiplier);
  chart.update();
}

function login() {
  const username = document.getElementById('username').value.trim();
  if (!username) {
    showLoginMessage('لطفا نام کاربری وارد کنید');
    return;
  }
  socket.emit('login', username);
}

socket.on('loginFailed', msg => showLoginMessage(msg));
socket.on('loginSuccess', user => {
  currentUser = user;
  document.getElementById('login').style.display = 'none';
  document.getElementById('game').style.display = 'block';
  document.getElementById('balance').textContent = currentUser.balance;
  populateCryptoSelects();
  setupChart();
});

function showLoginMessage(msg) {
  document.getElementById('loginMessage').textContent = msg;
}

function placeBet() {
  const amount = Number(document.getElementById('betAmount').value);
  if (!amount || amount <= 0) {
    addMessage('مقدار شرط باید بیشتر از صفر باشد');
    return;
  }
  socket.emit('placeBet', amount);
}

socket.on('betFailed', msg => addMessage(msg));
socket.on('betPlaced', amount => addMessage(`شرط ${amount} تومان ثبت شد`));

function cashOut() {
  socket.emit('cashOut');
}

socket.on('cashedOut', payout => {
  addMessage(`برداشت با مبلغ ${payout.toFixed(2)} تومان انجام شد`);
  currentUser.balance += payout;
  updateBalance();
});

socket.on('multiplierUpdate', multiplier => {
  document.getElementById('multiplier').textContent = multiplier.toFixed(2) + 'x';
  updateChart(mult
