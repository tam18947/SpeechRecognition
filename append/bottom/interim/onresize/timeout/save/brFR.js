// /append/bottom/interim/onresize/timeout/save/brEN.js
const SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();

recognition.interimResults = true;
recognition.continuous = false;
let txt = "";
let sHeight = 0;
let date;
let startDate;

// 翻訳API用設定
var request = new XMLHttpRequest();
// 翻訳用設定
var trans_sourcelang = 'ja';
var trans_destlang = 'fr'; // フランス語
var TRANS_URL = 'https://script.google.com/macros/s/' + 'AKfycbyoTPxFy7lwr8by0d3GRVqsyqnjeUZ2wFFUOLJNJnwu8OSgAPZPYgtXtDeorHg71R4' + '/exec';
var query = '';

recognition.onresult = (event) => {
  let str = event.results[0][0].transcript;
  if (event.results[0].isFinal) {
    if (txt == "") {
      startDate = new Date();
    }
    str += '。';
    query = TRANS_URL + '?text=' + str + '&source=' + trans_sourcelang + '&target=' + trans_destlang;
    request.open('GET', query, true);
    request.onreadystatechange = function(){
      if (request.readyState === 4 && request.status === 200){
        txt += request.responseText + '<br>';
        document.querySelector("#text").innerHTML = txt;

        let element = document.documentElement;
        if (element.scrollHeight > element.clientHeight) {
          let tmp = '<br>';
          while (sHeight > element.scrollHeight) {
          //for (let i = 0; i < 5 && sHeight > element.scrollHeight; i++) {
            document.querySelector("#text").innerHTML = txt + tmp;
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
      }
    }
    request.send(null);
  }
  document.querySelector("#text").innerHTML = txt + str;

  let element = document.documentElement;
  if (element.scrollHeight > element.clientHeight) {
    let tmp = '<br>';
    while (sHeight > element.scrollHeight) {
    //for (let i = 0; i < 5 && sHeight > element.scrollHeight; i++) {
      document.querySelector("#text").innerHTML = txt + str + tmp;
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
  setTimeout(timeout, 60000, date);
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
