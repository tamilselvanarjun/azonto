module.exports = SimpleApp

var config = require('./config')
var debug = require('debug')('azonto')
var express = require('express')
var fs = require('fs')
var http = require('http')
var jade = require('jade')
var path = require('path')
var randword = require('randword')
var sio = require('socket.io')
var uuid = require('node-uuid')

function SimpleApp (opts, cb) {

  var self = this

  /**
   * @type {string}
   */
  self.name = (opts && opts.name) || 'SimpleApp'

  /**
   * @type {number}
   */
  self.port = (opts && opts.port) || config.port

  self.start(cb)
}

SimpleApp.prototype.start = function (cb) {
  var self = this

  // Set up the HTTP server.
  var app = express()
  self.app = app
  self.server = http.createServer(app)

  app.disable('x-powered-by') // disable advertising

  // Use jade for templating
  app.set('views', path.join(config.rootPath, '/static/views'))
  app.set('view engine', 'jade')

  app.get('/', function (req, res) {
    randword(function (err, word) {
      if (err) {
        var name = 'User ' + Math.round(Math.random() * 10)
      } else {
        var name = word
      }
      res.render('index', {id: uuid.v4(), name: name})
    })
  })

  // Static files
  app.use(express.static(path.join(config.rootPath, 'static')))
  app.use('/components', express.static(path.join(config.rootPath, 'components')))

  app.use(express.errorHandler())

  // Websocket server (for WebRTC signalling)
  var io = sio.listen(self.server)
  var sockets = []
  var socketMap = {}
  io.sockets.on('connection', function (socket) {
    socket.on('identify', function (user) {
      socket.set('user', user, function () {
        socketMap[user.id] = socket
        sockets.forEach(function (socket) {
          socket.emit('join', user)
        })
        sockets.push(socket)
      })
    })

    socket.on('disconnect', function () {
      socket.get('user', function (err, user) {
        // Note: An error can only occur if the user hasn't identified yet
        // in which case, the other users in the room wouldn't know of her
        // existence anyway so we don't have to broadcast anything.
        if (!err) {
          sockets.forEach(function (socket) {
            socket.emit('leave', user)
          })
        }
      })
    })

    socket.on('offer', function () {
      socket.get('user', function (err, user) {
        debug('Received offer from ' + user.name)
        // Tell everyone to connect to this user
        sockets.forEach(function (socket) {
          socket.emit('file', {id: 'music', user: user})
        })
      })
    })

    socket.on('iceCandidate', function (msg) {
      socketMap[msg.to].emit('iceCandidate', msg)
    })

    socket.on('connectionOffer', function (msg) {
      socketMap[msg.to].emit('connectionOffer', msg)
    })

    socket.on('connectionAnswer', function (msg) {
      socketMap[msg.to].emit('connectionAnswer', msg)
    })

  })


  self.server.listen(self.port, function (err) {
    if (!err) {
      debug(self.name + ' started on port ' + self.port)
    } else {
      throw new Error(err)
    }
  })
}


SimpleApp.prototype.close = function (done) {
  var self = this

  self.server.close(function (err) {
    if (!err) debug(self.name + ' closed on port ' + self.port)
    done && done(err)
  })
}

new SimpleApp()