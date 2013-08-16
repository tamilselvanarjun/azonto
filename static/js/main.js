function handleDrag(event) {
  event.stopPropagation();
  event.preventDefault();
  event.target.className = (event.type == "dragenter" ? "hover" : "");
}

function handleDragOver(event) {
  event.stopPropagation();
  event.preventDefault();
}

function handleFileDrop(event) {
  event.stopPropagation();
  event.preventDefault();

  event.target.className = "";
  var files = event.dataTransfer.files;
  handleFiles(files);
}

function updateProgress(event) {
  if (event.lengthComputable) {
  document.getElementById('progressbar').value = event.loaded;
  }
}

function handleFiles(files) {
  var file = files[0];
  //TODO: check that filetype is valid mp3
  var reader = new FileReader();
  reader.onloadstart = function(event) {
  var pbar = document.getElementById('progressbar');
  $('#progressbar').show();
  pbar.max = event.total;
  };
  reader.onprogress = updateProgress;
  reader.onload = handleReaderLoad;
  reader.readAsArrayBuffer(file);
}

function handleReaderLoad(event) {
  $('#progressbar').hide();
  var arrbuff = event.target.result;
  context.decodeAudioData(arrbuff, function(audiobuf) {
    source = context.createBufferSource();
    source.buffer = audiobuf;
    source.connect(context.destination);
    $('#togglebtn').show();
  }, onDecodeError);
  //send to other people in this room with webrtc
}

function playSong() {
  source.start(0);
}

function stopSong() {
  //TODO: actually implement pausing, stop should only be called once.
  source.stop(0);
}

function toggleSong() {
  this.playing ? this.stopSong() : this.playSong();
  this.playing = !this.playing;
}

function onDecodeError(err) {
  alert("Error decoding audio file: "+err);
  console.log("decodeAudioData error: "+err);
}

var context;
var source;
$(document).ready(function () {
  if (!(window.File && window.FileReader)) {
    $('#unsupported').show();
  }

  var dragRegion = document.getElementById('dragregion');
  dragRegion.addEventListener('dragenter', handleDrag, false);
  dragRegion.addEventListener('dragover', handleDragOver, false);
  dragRegion.addEventListener('dragleave', handleDrag, false);
  dragRegion.addEventListener('drop', handleFileDrop, false);

  try {
    window.AudioContext = window.AudioContext||window.webkitAudioContext;
    context = new AudioContext();
  }
  catch(exc) {
    alert('Web Audio API is not supported in this browser.');
  }
})