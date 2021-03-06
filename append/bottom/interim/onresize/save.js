// /append/bottom/interim/onresize/save.js
const SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();

// 音声認識用設定
recognition.lang = 'ja';
recognition.interimResults = true;
recognition.continuous = false;
let txt = "";
let sHeight = 0;

recognition.onresult = (event) => {
  let str = txt + event.results[0][0].transcript;
  if (event.results[0].isFinal) {
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
};

recognition.onend = () => recognition.start();

recognition.start();

window.onresize = function () {
  let element = document.documentElement;
  sHeight = element.scrollHeight;
};

document.addEventListener("DOMContentLoaded", function(){
  let button = document.getElementById("btn");
  button.addEventListener('click', saveText);

  function saveText() {
    download(new Blob([txt]), 'text.txt');
  }
}, false);

function download(blob, filename) {
  const objectURL = window.URL.createObjectURL(blob),
    a = document.createElement('a'),
    e = document.createEvent('MouseEvent');

  //a要素のdownload属性にファイル名を設定
  a.download = filename;
  a.href = objectURL;

  //clickイベントを着火
  e.initEvent("click", true, true, window, 1, 0, 0, 0, 0, false, false, false, false, 0, null);
  a.dispatchEvent(e);
}
