const SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();

recognition.onresult = (event) => {
  document.querySelector("#text").innerHTML += event.results[0][0].transcript;
};

recognition.onend = () => recognition.start();

recognition.start();

var element = document.documentElement;
var bottom = element.scrollHeight - element.clientHeight;
window.scroll(0, bottom);