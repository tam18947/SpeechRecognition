// append/bottom/br.js
const SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();

recognition.onresult = (event) => {
  document.querySelector("#text").innerHTML += event.results[0][0].transcript + '。<br>';

  var element = document.documentElement;
  var bottom = element.scrollHeight - element.clientHeight;
  window.scrollTo({
    top: bottom,
    behavior: 'smooth',
  });
};

recognition.onend = () => recognition.start();

recognition.start();
