const SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();

// 音声認識用設定
recognition.lang = 'ja';
recognition.interimResults = true;
recognition.continuous = false;

recognition.onresult = (event) => {
  document.querySelector("#text").innerHTML += event.results[0][0].transcript;
};

recognition.onend = () => recognition.start();

recognition.start();
