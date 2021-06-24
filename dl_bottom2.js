const SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();

recognition.interimResults = true;
recognition.continuous = false;
var str = "";
var sHeight = 0;

recognition.onresult = (event) => {
  document.querySelector("#text").innerHTML = str + event.results[0][0].transcript;//'。';//'<br>';
  if (event.results[0].isFinal)
  {
    str += event.results[0][0].transcript + '。';

    var element = document.documentElement;
    var bottom = element.scrollHeight - element.clientHeight;
    window.scrollTo({
      top: bottom,
      behavior: 'smooth',
    });
  }
};

recognition.onend = () => recognition.start();

recognition.start();