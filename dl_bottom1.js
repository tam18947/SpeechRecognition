const SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();

recognition.interimResults = true;
recognition.continuous = false;
var str = "> ";
var sHeight = 0;
var cHeight = 0;

recognition.onresult = (event) => {
  document.querySelector("#text").innerHTML = str + event.results[0][0].transcript + '<br><br>>';//'。';//'<br>';
  if (event.results[0].isFinal)
  {
    str += event.results[0][0].transcript + '。';
  }

  var element = document.documentElement;
  if (sHeight < element.scrollHeight)
  {
    sHeight = element.scrollHeight;
    cHeight = element.clientHeight;
  }
  else
  {
    cHeight = element.clientHeight + element.scrollHeight - sHeight;
  }
  var bottom = element.scrollHeight - cHeight;
  window.scrollTo({
    top: bottom,
    behavior: 'smooth',
  });
};

recognition.onend = () => recognition.start();

recognition.start();
