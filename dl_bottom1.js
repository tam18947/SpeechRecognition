const SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();
//const recogResult = new SpeechRecognitionResult();

recognition.interimResults = true;
recognition.continuous = false;
var str = "";

recognition.onresult = (event) => {
  document.querySelector("#text").innerHTML = str + event.results[0][0].transcript + '。';//'<br>';
  if (SpeechRecognitionResult.isFinal)
  {
    str += event.results[0][0].transcript + '。';
  }

  var element = document.documentElement;
  var bottom = element.scrollHeight - element.clientHeight;
  //window.scroll(0, bottom);
  window.scrollTo({
    top: bottom,
    behavior: 'smooth',
  });
};

recognition.onend = () => recognition.start();

recognition.start();
