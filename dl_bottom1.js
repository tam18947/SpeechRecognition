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
  }

  var element = document.documentElement;
  if (element.scrollHeight > element.clientHeight)
  {
    var tmp = '<br>>';
    //if (sHeight >= element.scrollHeight)
    while (sHeight >= element.scrollHeight)
    {
      document.querySelector("#text").innerHTML = str + event.results[0][0].transcript + tmp;
      tmp += '<br>>';
      element = document.documentElement;
    }
    tmp = '<br>>';
  }
  sHeight = element.scrollHeight;
  var bottom = element.scrollHeight - element.clientHeight;
  window.scrollTo({
    top: bottom,
    behavior: 'smooth',
  });
};

recognition.onend = () => recognition.start();

recognition.start();
