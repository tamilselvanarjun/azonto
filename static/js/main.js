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

/* WebSocket */
var socket = io.connect('http://localhost:5555')
socket.emit('identify', me)

socket.on('join', function (user) {
  document.querySelector('ul.users').innerHTML += user.name + ' joined. <br/>'
})

socket.on('leave', function (user) {
  document.querySelector('ul.users').innerHTML += user.name + ' left. <br/>'
})

/* WebRTC */

var config = {
  isFirefox: false,
  stun: {
    'iceServers': [
      {'url': config.isFirefox
        ? 'stun:23.21.150.121'
        : 'stun:stun.l.google.com:19302'
      }
    ]
  },
  {
    'optional': config.isFirefox ? [] : [{ 'RtpDataChannels': true }]
  }
}

var _RTCPeerConnection =
  window.mozRTCPeerConnection || window.webkitRTCPeerConnection
var _RTCSessionDescription =
  window.mozRTCSessionDescription || window.RTCSessionDescription
var _RTCIceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate

function PeerChannel (peerId, isInitiator) {
  var self = this

  /**
   * ID of the peer that this channel is connected to.
   * @type {number}
   */
  self.peerId = peerId

  /**
   * Did this client initiate the connection to the peer?
   * @type {boolean}
   */
  self.isInitiator = isInitiator

  /**
   * DataChannel instance. Returned from createDataChannel().
   * @type {RTCDataChannel}
   */
  self.dataChannel = null

  /**
   * Is the DataChannel open?
   * @type {boolean}
   */
  self.isOpen = false

  self.init()
}

PeerChannel.prototype.init = function () {
  try {
    self.peerConnection = new _RTCPeerConnection(config.stun, config.peerConnectionOptions)
  } catch (e) {
    console.error('Failed to create RTCPeerConnection.', e)
    return
  }
}