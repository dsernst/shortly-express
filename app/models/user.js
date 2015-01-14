var db = require('../config');
//require('bcrypt-nodejs');
var Promise = require('bluebird');
var bcrypt = Promise.promisifyAll(require('bcrypt-nodejs'));

var User = db.Model.extend({
  tableName: 'users',
  hasTimestamps: true,
  makeHash: function(password) {
    var that = this;
    bcrypt.hashAsync(password, bcrypt.genSaltSync(), function(){})
    .then(function(hash){
      that.set('password', hash);
      that.save();
    })
    .catch(function(err){
      console.log(err);
    });
  },
  checkHash: function(password) {
    var storedHash = this.get('password');
    return bcrypt.compareSync(password, storedHash);
  }

});

module.exports = User;
