module.exports = SimpleApp

var config = require('./config')
var debug = require('debug')('simple-app')
var express = require('express')
var fs = require('fs')
var http = require('http')
var jade = require('jade')
var path = require('path')

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

  app.get('/', function (req, res) { res.render('index') })

  // Static files
  app.use(express.static(path.join(config.rootPath, 'static')))
  app.use('/components', express.static(path.join(config.rootPath, 'components')))

  app.use(express.errorHandler())

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