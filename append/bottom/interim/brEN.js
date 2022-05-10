// /append/bottom/interim/br.js
const SpeechRecognition =
  window.webkitSpeechRecognition || window.SpeechRecognition;
const recognition = new SpeechRecognition();

recognition.interimResults = true;
recognition.continuous = false;
let txt = "";
let transTxt = "";

// 翻訳API用設定
var request = new XMLHttpRequest();
// 翻訳用設定
var trans_sourcelang = 'ja';
var trans_destlang = 'en';
var TRANS_URL = 'https://script.google.com/macros/s/' + 'AKfycbyoTPxFy7lwr8by0d3GRVqsyqnjeUZ2wFFUOLJNJnwu8OSgAPZPYgtXtDeorHg71R4' + '/exec';
var query = '';

recognition.onresult = (event) => {
  let str = txt + event.results[0][0].transcript;
  if (event.results[0].isFinal) {
    str += '。';
    query = TRANS_URL + '?text=' + str + '&source=' + trans_sourcelang + '&target=' + trans_destlang;
    request.open('GET', query, true);
    request.onreadystatechange = function(){
      if (request.readyState === 4 && request.status === 200){
        transTxt += request.responseText + '<br>';
        document.querySelector("#text").innerHTML = transTxt;
        txt = "";
      }
    }
    request.send(null);
  }
  document.querySelector("#text").innerHTML = transTxt + str;

  let element = document.documentElement;
  let bottom = element.scrollHeight - element.clientHeight;
  window.scrollTo({
    top: bottom,
    behavior: 'smooth',
  });
};

recognition.onend = () => recognition.start();

recognition.start();
