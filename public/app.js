// app.js - Grok Bot Terminal Logic

const botData = {
  status: {
    running: true,
    uptime: "04:05:41",
    balance: 903.91,
    startBalance: 1200.00,
    trades: 25
  },
  agents: {
    scout: { seen: 818 },
    filter: { killed: 746 },
    analyst: { scored: 72, score: 78 },
    executor: { trades: 29 },
    risk: { stops: 27 },
    logger: { logs: "#913" }
  },
  trade: {
    token: "$ZORBI",
    profit: "+2.8%",
    status: "OPEN · STOP ARMED"
  },
  stats: {
    scanned: 818,
    filtered: 746,
    scored: 72,
    tradesTaken: 29,
    bestTrade: "+$157.70"
  }
};

// Simulasi pembaruan data
function updateScore() {
  const scoreEl = document.querySelector('.score-circle');
  if (scoreEl) {
    setInterval(() => {
      const newScore = Math.floor(Math.random() * 10) + 70;
      scoreEl.textContent = newScore;
      scoreEl.style.background = 
        `conic-gradient(#a855f7 0% ${newScore}%, #2a2a4e ${newScore}% 100%)`;
    }, 5000);
  }
}

function updateTime() {
  const statusEl = document.querySelector('.status');
  if (statusEl) {
    setInterval(() => {
      const [h, m, s] = botData.status.uptime.split(':').map(Number);
      let totalSec = h * 3600 + m * 60 + s + 1;
      const nh = Math.floor(totalSec / 3600);
      const nm = Math.floor((totalSec % 3600) / 60);
      const ns = totalSec % 60;
      botData.status.uptime = 
        `${nh.toString().padStart(2,'0')}:${nm.toString().padStart(2,'0')}:${ns.toString().padStart(2,'0')}`;
      statusEl.textContent = `● running · ${botData.status.uptime}`;
    }, 1000);
  }
}

// Inisialisasi saat halaman siap
document.addEventListener('DOMContentLoaded', () => {
  console.log('🤖 Grok Bot Terminal dimulai!');
  updateScore();
  updateTime();
});
