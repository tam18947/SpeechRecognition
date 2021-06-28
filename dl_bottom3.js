const SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();

recognition.interimResults = true;
recognition.continuous = false;
let str = "";
let sHeight = 0;
let count = 0;

recognition.onresult = (event) => {
  document.querySelector("#text").innerHTML = str + event.results[0][0].transcript;
  setTimeout(timeReset(++count), 10000)
  if (event.results[0].isFinal)
  {
    str += event.results[0][0].transcript + '。<br>';
  }

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
};

recognition.onend = () => recognition.start();

recognition.start();

window.onresize = function () {
  let element = document.documentElement;
  sHeight = element.scrollHeight;
};

function timeReset(cnt) {
  if (count == cnt) {
    document.querySelector("#text").innerHTML = "";
    str = count;
    count = 0;
  }
}
