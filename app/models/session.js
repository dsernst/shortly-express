var db = require('../config');
var crypto = require('crypto');

var Session = db.Model.extend({
  tableName: 'sessions',
  hasTimestamps: true,
  initialize: function(){
    this.on('creating', function(model, attrs, options){
      var shasum = crypto.createHash('sha1');
      shasum.update(model.get('username'));
      shasum.update(new Date().toString());
      model.set('session_key', shasum.digest('hex'));
    });
  }
});

module.exports = Session;
