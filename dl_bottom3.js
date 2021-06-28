const SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();

recognition.interimResults = true;
recognition.continuous = false;
let str = "";
let sHeight = 0;
let date;

recognition.onresult = (event) => {
  if (event.results[0].isFinal)
  {
    str += event.results[0][0].transcript + '。<br>';
  }
  document.querySelector("#text").innerHTML = str + event.results[0][0].transcript;

  let element = document.documentElement;
  if (element.scrollHeight > element.clientHeight)
  {
    let tmp = '<br>';
    while (sHeight > element.scrollHeight)
    {
      document.querySelector("#text").innerHTML = str + event.results[0][0].transcript + tmp;
      tmp += '<br>';
      element = document.documentElement;
    }
    sHeight = element.scrollHeight;
  }
  let bottom = element.scrollHeight - element.clientHeight;
  window.scrollTo({
    top: bottom,
    behavior: 'smooth',
  });

  date = new Date();
  setTimeout(timeReset, 10000, date);
};

recognition.onend = () => recognition.start();

recognition.start();

window.onresize = function () {
  let element = document.documentElement;
  sHeight = element.scrollHeight;
};

function timeReset(da) {
  if (date == da) {
    document.querySelector("#text").innerHTML = "";
    str = "";
  }
};
