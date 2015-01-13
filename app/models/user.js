var db = require('../config');
var bcrypt = require('bcrypt-nodejs');
// var Promise = require('bluebird');

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  makeHash: function(password) {
    var hash = bcrypt.hashSync(password);
    this.set('password', hash);
    return this
  },
  checkHash: function(password) {
    var storedHash = this.get('password');
    return bcrypt.compareSync(password, storedHash);
  }

});

module.exports = User;
