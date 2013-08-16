// TEMP global for testing
var currentSong = null

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
  reader.readAsArrayBuffer(file)
}

function handleReaderLoad(event) {
  $('#progressbar').hide();
  var arrbuff = event.target.result;
  currentSong = arrbuff
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

  $('#download').click(function () {
    socket.emit('offer')
  })

  try {
    window.AudioContext = window.AudioContext || window.webkitAudioContext;
    context = new AudioContext();
  }
  catch(exc) {
    alert('Web Audio API is not supported in this browser.');
  }
})

/* WebSocket */
var socket = io.connect('http://localhost:5555')
socket.emit('identify', me)

/* Presence messages */
socket.on('join', function (user) {
  document.querySelector('ul.users').innerHTML += user.name + ' joined. <br/>'
})

socket.on('leave', function (user) {
  document.querySelector('ul.users').innerHTML += user.name + ' left. <br/>'
})


var channels = {}

/* File download messages */
socket.on('file', function (msg) {
  if (msg.user.id === me.id) return
  console.log('A new file "' + msg.id + '" available from ' + msg.user.name)

  var pc = new PeerChannel(msg.user.id, true)
})

socket.on('connectionOffer', function (msg) {
  peer = new PeerChannel(msg['from'], false)
  console.log('Received connection offer from peer  ' + msg['from'] + '.')
  peer.onConnectionOffer(msg['offer'])
})

socket.on('connectionAnswer', function (msg) {
  channels[msg['from']].onConnectionAnswer(msg.answer)
  // TODO: Handle stray msg['from'] from unknown peers
})

socket.on('iceCandidate', function (msg) {
  channels[msg['from']].onIceCandidate(msg.candidate)
})

/* WebRTC */

/* Cross-browser */
var _RTCPeerConnection =
  window.mozRTCPeerConnection || window.webkitRTCPeerConnection
var _RTCSessionDescription =
  window.mozRTCSessionDescription || window.RTCSessionDescription
var _RTCIceCandidate = window.mozRTCIceCandidate || window.RTCIceCandidate

/* Configuration */
var config = {
  isFirefox: false
}

config.stun = {
  'iceServers': [
    {'url': config.isFirefox
      ? 'stun:23.21.150.121'
      : 'stun:stun.l.google.com:19302'
    }
  ]
}

config.peerConnectionOptions = {
  'optional': config.isFirefox ? [] : [{ 'RtpDataChannels': true }]
}

config.dataChannelOptions = config.isFirefox
  ? { 'outOfOrderAllowed': true, 'maxRetransmitNum': 0 }
  : { 'reliable': false } // Chrome doesn't support reliable yet

config.peerConnectionConstraints = {}


function PeerChannel (peerId, isInitiator) {
  var self = this

  /**
   * ID of the peer that this channel is connected to.
   * @type {string}
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
  var self = this
  try {
    self.peerConnection = new _RTCPeerConnection(config.stun, config.peerConnectionOptions)
  } catch (e) {
    console.error('Failed to create RTCPeerConnection.', e)
    return
  }

  channels[self.peerId] = self

  // HACK: to support Chrome 26 and Firefox. This API changed in Chrome 27.
  var onsignalingstatechange = 'onsignalingstatechange' // Spec
  try {
    if (typeof self.peerConnection.onstatechange !== 'undefined') {
      onsignalingstatechange = 'onstatechange' // Old
    }
  } catch (e) {}

  var oniceconnectionstatechange = 'oniceconnectionstatechange' // Spec
  try {
    if (typeof self.peerConnection.onicechange !== 'undefined') {
      oniceconnectionstatechange = 'onicechange' // Old
    }
  } catch (e) {}
  // END HACK

  self.peerConnection.onicecandidate = function (e) {
    socket.emit('iceCandidate', {to: self.peerId, from: me.id, candidate: e['candidate']})
  }

  self.peerConnection[onsignalingstatechange] = function (e) {
    var signalingState = (typeof e === 'string')
      ? e // Firefox
      : e.target.signalingState // Spec?
    console.log('STATE CHANGE to peer #' + self.peerId + ': ' + signalingState)
  }

  self.peerConnection[oniceconnectionstatechange] = function (e) {
    var iceConnectionState = (typeof e === 'string')
      ? e // Firefox
      : e.target.iceConnectionState // Spec

    console.log('ICE CHANGE to peer #' + self.peerId + ': ' + iceConnectionState)

    // Clean up channel if it has been disconnected.
    if (iceConnectionState === 'disconnected') {
      // TODO
      // self.close()
    }
  }

  if (self.isInitiator) {
    try {
      // Create a data channel
      self.dataChannel = self.peerConnection.createDataChannel('peerCDN-' + self.peerId, config.dataChannelOptions)
    } catch (e) {
      console.error('Failed to create DataChannel.')
      console.error(e)
      return
    }

    self.dataChannel.binaryType = 'arraybuffer'
    self.setupDataChannelEvents()

    self.dataChannel.onopen = function (e) {
      console.log('DataChannel "onopen" here (initator)')
      self.isOpen = true
    }

    self.peerConnection.createOffer(function (offer) {
      console.log('Created offer description')
      // TODO: offer['sdp'] = self.transformSDP(offer['sdp'])
      self.peerConnection.setLocalDescription(offer, function () {
        console.log('Local offer description set')
      }, function (err) {
        console.error('setLocalDescription failed', err)
      })

      // Send connection offer
      socket.emit('connectionOffer', {to: self.peerId, from: me.id, offer: offer})

      }, function (err) {
        console.error('createOffer failed', err)
    }, config.peerConnectionConstraints)

  } else {
    // Triggered when DataChannel is created by peer
    self.peerConnection.ondatachannel = function (e) {
      console.log('Connected with remotely-initiated DataChannel.')
      self.dataChannel = e['channel']

      self.dataChannel.binaryType = 'arraybuffer'
      self.setupDataChannelEvents()

      self.dataChannel.onopen = function (e) {
        console.log('DataChannel "onopen" here (not initiator).')
        self.isOpen = true

        // Send the file
        if (currentSong) {
          console.log('Sending file ' + currentSong.byteLength + ' long')
          self.dataChannel.send(buf2str(currentSong))
        }
      }
    }
  }
}

PeerChannel.prototype.onConnectionOffer = function (offer) {
  var self = this
  var sdp = new _RTCSessionDescription(offer)

  self.peerConnection.setRemoteDescription(sdp, function () {
    console.log('setRemoteDescription suceeded')
  }, function (err) {
    console.error('setRemoteDescription failed', err)
  })


  // Reply with the connection answer
  self.peerConnection.createAnswer(function (answer) {

    // TODO
    //answer['sdp'] = self.transformSDP(answer['sdp'])

    self.peerConnection.setLocalDescription(answer, function () {
      console.log('Local answer description set')
    }, function (err) {
      console.error('setLocalDescription failed', err)
    })

    socket.emit('connectionAnswer', {to: self.peerId, from: me.id, answer: answer})

  }, function (err) {
    log.error('createAnswer failed', err)
  }, config.peerConnectionConstraints)
}

PeerChannel.prototype.onConnectionAnswer = function (answer) {
  var self = this
  var sdp = new _RTCSessionDescription(answer)

  self.peerConnection.setRemoteDescription(sdp, function () {
    console.log('setRemoteDescription suceeded')
  }, function (err) {
    console.error('setRemoteDescription failed', err)
  })
}

PeerChannel.prototype.onIceCandidate = function (candidate) {
  var self = this
  if (candidate) {
    candidate = new _RTCIceCandidate(candidate)
    self.peerConnection.addIceCandidate(candidate)
  } else {
    // When null, should expect no more candidates from this peer.
    console.log('Done receiving ICE candidates.')
  }
}

PeerChannel.prototype.setupDataChannelEvents = function () {
  var self = this
  self.dataChannel.onmessage = function (e) {
    console.log('DataChannel RECEIVE: ' + e.data.byteLength)
  }
}

/* Utilities */
function ab2str(buf) {
  return String.fromCharCode.apply(null, new Uint16Array(buf));
}

function arrayBuffer2String(buf, callback) {
    var bb = new BlobBuilder();
    bb.append(buf);
    var f = new FileReader();
    f.onload = function(e) {
        callback(e.target.result)
    }
    f.readAsText(bb.getBlob());
}

function str2ab(str) {
  var buf = new ArrayBuffer(str.length*2); // 2 bytes for each char
  var bufView = new Uint16Array(buf);
  for (var i=0, strLen=str.length; i<strLen; i++) {
    bufView[i] = str.charCodeAt(i);
  }
  return buf;
}


function buf2str(bufView) {
  var binaryString = ''
  for (var i = 0; i < bufView.byteLength; i++) {
    binaryString += String.fromCharCode(bufView[i])
  }
  console.log(binaryString.length)
  return btoa(binaryString)
}

function str2buf(str) {
  str = atob(str)
  // TODO: use one constructor!
  var buf = new ArrayBuffer(str.length) // 1 byte for each char
  var bufView = new Uint8Array(buf)
  for (var i = 0, len = str.length; i < len; i++) {
    bufView[i] = str.charCodeAt(i)
  }
  return bufView
}