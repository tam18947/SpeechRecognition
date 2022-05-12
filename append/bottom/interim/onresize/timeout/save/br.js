// /append/bottom/interim/onresize/timeout/save/br.js
const SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();

recognition.interimResults = true;
recognition.continuous = false;
let txt = "";
let sHeight = 0;
let date;
let startDate;

recognition.onresult = (event) => {
  let str = txt + event.results[0][0].transcript;
  if (event.results[0].isFinal) {
    if (txt == "") {
      startDate = new Date();
    }
    str += '。<br>';
    txt = str;
  }
  document.querySelector("#text").innerHTML = str;

  let element = document.documentElement;
  if (element.scrollHeight > element.clientHeight) {
    let tmp = '<br>';
    while (sHeight > element.scrollHeight) {
    //for (let i = 0; i < 5 && sHeight > element.scrollHeight; i++) {
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

  // 60秒で消去
  date = new Date();
  setTimeout(timeout, 10000, date);
};

recognition.onend = () => recognition.start();

recognition.start();

window.onresize = function () {
  let element = document.documentElement;
  sHeight = element.scrollHeight;
};

function timeout(d) {
  if (date == d) {
    download(new Blob([txt.replace(/<br>/g,'\n')]), startDate + '.txt');
    txt = "";
    document.querySelector("#text").innerHTML = txt;
  }
}

function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  document.body.appendChild(a);
  a.download = filename;
  a.href = url;
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
