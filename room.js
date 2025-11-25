const urlParams = new URLSearchParams(window.location.search);
const entry_id = urlParams.get("entry_id");
const isMain = urlParams.get("is_main") === "true";
const tg_id = urlParams.get("tg_id");

const video = document.getElementById("video");
const roomIdDisplay = document.getElementById("entry_id_display");
const userStatus = document.getElementById("user_status");
const mainControls = document.getElementById("main_controls");
const chatMessages = document.getElementById("chatMessages");
const chatInput = document.getElementById("chatInput");
const sendMessageBtn = document.getElementById("sendMessage");

// Хранилище для имени пользователя
let username = `User_${tg_id}`;

// Отображаем информацию о комнате
roomIdDisplay.textContent = entry_id;
userStatus.textContent = isMain ? "👑 Главный" : "👥 Участник";

// Показываем кнопки управления только для главного
if (isMain) {
  mainControls.style.display = 'block';
} else {
  video.controls = false;
}

// Запрашиваем имя пользователя
username = prompt("Введите ваше имя для чата:", username) || username;

// WebSocket
let ws;
let wsReady = false;
let isSyncing = false;

function connectWS() {
  ws = new WebSocket(`wss://otzoviktg.ru/ws/${entry_id}?tg_id=${tg_id}`);

  ws.onopen = () => {
    wsReady = true;
    console.log("✅ WebSocket подключен");
    addSystemMessage("Вы подключились к чату");
  };

  ws.onclose = () => {
    wsReady = false;
    console.log("❌ WebSocket закрыт");
    addSystemMessage("Соединение потеряно. Переподключение...");
    setTimeout(connectWS, 2000);
  };

  ws.onerror = (err) => {
    console.error("Ошибка WS:", err);
    addSystemMessage("Ошибка соединения");
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log("📩 Получено:", msg);

    isSyncing = true;

    if (msg.action === "sync" || ["play","pause","seek","jump", "change_video"].includes(msg.action)) {
      if (msg.action === "change_video") {
        changeVideoSource(msg.videoUrl, msg.videoTitle);
      } else {
        video.currentTime = msg.seconds;
        if (msg.paused) {
          video.pause();
        } else {
          video.play().catch(e => console.log("Автовоспроизведение заблокировано"));
        }
      }
    } else if (msg.action === "chat_message") {
      displayChatMessage(msg.username, msg.message, msg.timestamp, msg.isOwn);
    } else if (msg.action === "user_joined") {
      addSystemMessage(`${msg.username} присоединился к чату`);
    } else if (msg.action === "user_left") {
      addSystemMessage(`${msg.username} покинул чат`);
    }

    setTimeout(() => { isSyncing = false; }, 100);
  };
}

// Функции для работы с чатом
function addSystemMessage(text) {
  const messageDiv = document.createElement('div');
  messageDiv.className = 'message message-system';
  messageDiv.textContent = text;
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function displayChatMessage(sender, text, timestamp, isOwn = false) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${isOwn ? 'own' : 'other'}`;
  
  const time = new Date(timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
  
  if (!isOwn) {
    const senderDiv = document.createElement('div');
    senderDiv.className = 'message-sender';
    senderDiv.textContent = `${sender} (${time})`;
    messageDiv.appendChild(senderDiv);
  } else {
    const senderDiv = document.createElement('div');
    senderDiv.className = 'message-sender';
    senderDiv.textContent = `Вы (${time})`;
    messageDiv.appendChild(senderDiv);
  }
  
  const textDiv = document.createElement('div');
  textDiv.textContent = text;
  messageDiv.appendChild(textDiv);
  
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function sendChatMessage() {
  const message = chatInput.value.trim();
  if (!message || !wsReady) return;
  
  const timestamp = new Date().toISOString();
  
  // Отправляем сообщение через WebSocket
  sendWS({
    action: "chat_message",
    message: message,
    username: username,
    timestamp: timestamp
  });
  
  // Очищаем поле ввода
  chatInput.value = '';
}

// Обработчики для чата
sendMessageBtn.addEventListener('click', sendChatMessage);
chatInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    sendChatMessage();
  }
});

connectWS();

// Безопасная отправка
let isSendingCommand = false;

// Модифицируем функцию отправки
function sendWS(data) {
  if (!isMain && !data.action.startsWith("chat_")) {
    return;
  }
  
  if (isSendingCommand) {
    console.log("⚠️ Команда уже отправляется, пропускаем");
    return;
  }
  
  if (wsReady && ws.readyState === WebSocket.OPEN) {
    isSendingCommand = true;
    ws.send(JSON.stringify(data));
    console.log('✅ WS данные отправлены:', data);
    
    // Сбрасываем флаг через небольшую задержку
    setTimeout(() => {
      isSendingCommand = false;
    }, 100);
  } else {
    console.warn("⚠️ WS ещё не готов");
  }
}


// Остальной код управления видео остается без изменений...
// [остальная часть кода из оригинального room.js]


if (isMain) {
// Воспроизведение

video.addEventListener('play', () => {
  if (isSyncing) return;
  console.log("▶️ Воспроизведение начато");
  sendWS({ 
    action: "play", 
    seconds: video.currentTime, 
    paused: false 
  });
});

// Пауза
video.addEventListener('pause', () => {
  if (isSyncing) return;
  console.log("⏸ Воспроизведение приостановлено");
  sendWS({ 
    action: "pause", 
    seconds: video.currentTime, 
    paused: true 
  });
});

// Перемотка (срабатывает когда пользователь перематывает видео)
video.addEventListener('seeked', () => {
  if (isSyncing) return;
  console.log("↔️ Перемотка на", video.currentTime);
  sendWS({ 
    action: "seek", 
    seconds: video.currentTime, 
    paused: video.paused 
  });
});

// Также обрабатываем изменение времени через полосу прокрутки
video.addEventListener('timeupdate', () => {
  if (isSyncing) return;
  // Отправляем синхронизацию только если разница во времени значительная
  // Это предотвращает слишком частые отправки
  if (Math.abs(video.currentTime - lastSentTime) > 2) {
    console.log("🕒 Синхронизация времени:", video.currentTime);
    sendWS({ 
      action: "sync_time", 
      seconds: video.currentTime, 
      paused: video.paused 
    });
    lastSentTime = video.currentTime;
  }
});

  // --- Кнопки управления временем ---
  document.getElementById("back_10s").onclick = () => {
    video.currentTime = Math.max(0, video.currentTime - 10);
    console.log("⏪ Отмотка на 10 секунд назад");
    sendWS({ 
      action: "jump", 
      seconds: video.currentTime, 
      paused: video.paused 
    });
  };

  document.getElementById("forward_10s").onclick = () => {
    video.currentTime = Math.min(video.duration, video.currentTime + 10);
    console.log("⏩ Перемотка на 10 секунд вперед");
    sendWS({ 
      action: "jump", 
      seconds: video.currentTime, 
      paused: video.paused 
    });
  };

  // Переменная для отслеживания последнего отправленного времени
  let lastSentTime = 0;
  var btns = document.getElementsByClassName("video-controls-overlay")
  btns.className.remove("invisible")
}

// Функция смены видео (при получении команды)
function changeVideoSource(url, title) {
  video.src = url;
  document.getElementById('video_title').textContent = title;
  video.load();
}

document.getElementById("fullscreenBtn").onclick = () => {
  let video = document.getElementById("video");
  if (video.requestFullscreen) video.requestFullscreen();
};
