const SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();

recognition.interimResults = true;
recognition.continuous = false;
let txt = "";
let sHeight = 0;
let date;

recognition.onresult = (event) => {
  let str = txt + event.results[0][0].transcript;
  if (event.results[0].isFinal) {
    str += '。<br>';
    txt = str;
  }
  document.querySelector("#text").innerHTML = str;

  let element = document.documentElement;
  if (element.scrollHeight > element.clientHeight) {
    let tmp = '<br>';
    //while (sHeight > element.scrollHeight) {
    for (let i = 0; i < 3 && sHeight > element.scrollHeight; i++) {
      document.querySelector("#text").innerHTML = str + tmp;
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
  setTimeout(timeReset, 30000, date);
};

recognition.onend = () => recognition.start();

recognition.start();

window.onresize = function () {
  let element = document.documentElement;
  sHeight = element.scrollHeight;
};

function timeReset(da) {
  if (date == da) {
    txt = "";
    document.querySelector("#text").innerHTML = txt;
  }
};
