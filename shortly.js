var express = require('express');
var util = require('./lib/utility');
var partials = require('express-partials');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');


var db = require('./app/config');
var Users = require('./app/collections/users');
var User = require('./app/models/user');
var Links = require('./app/collections/links');
var Link = require('./app/models/link');
var Click = require('./app/models/click');
var Session = require('./app/models/session');

var passport = require('passport');
var GitHubStrategy = require('passport-github').Strategy;

var GITHUB_CLIENT_ID = require('githubSecrets.js').client_id;
var GITHUB_CLIENT_SECRET = require('githubSecrets.js').client_secret;

// Use the GitHubStrategy within Passport.
//   Strategies in Passport require a `verify` function, which accept credentials (in this case, an accessToken, refreshToken, and GitHub profile), and invoke a callback with a user object.
passport.use(new GitHubStrategy({
    clientID: GITHUB_CLIENT_ID,
    clientSecret: GITHUB_CLIENT_SECRET,
    callbackURL: "http://127.0.0.1:4568/auth/github/callback"
  },
  function(accessToken, refreshToken, profile, done) {
    // asynchronous verification, for effect...
    process.nextTick(function () {

      // To keep the example simple, the user's GitHub profile is returned to represent the logged-in user.  In a typical application, you would want to associate the GitHub account with a user record in your database, and return that user instead.
      return done(null, profile);
    });
  }
));

var app = express();

app.set('views', __dirname + '/views');
app.set('view engine', 'ejs');
app.use(partials());
// Parse JSON (uniform resource locators)
app.use(bodyParser.json());
// Parse forms (signup/login)
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(__dirname + '/public'));
app.use(cookieParser());
app.use(passport.initialize());
app.use(passport.session());


// var checkUser = function(req, res, next) {
//   var cookieSession = req.cookies.session;
//   if (cookieSession) {
//     new Session({session_key: cookieSession}).fetch().then(function(found) {
//       if (found) {
//         next();
//       } else {
//         res.redirect('login');
//       }
//     });
//   } else {
//     res.redirect('login');
//   }
// };



app.get('/', checkUser, function(req, res) {
  res.render('index');
});

app.get('/login', function(req, res) {
  res.render('login');
});

app.get('/signup', function(req, res) {
  res.render('signup')
})

// GET /auth/github
//   Use passport.authenticate() as route middleware to authenticate the request. The first step in GitHub authentication will involve redirecting the user to github.com. After authorization, GitHub will redirect the user back to this application at /auth/github/callback
app.get('/auth/github',
  passport.authenticate('github'),
  function(req, res){
    // The request will be redirected to GitHub for authentication, so this function will not be called.
  });


// GET /auth/github/callback
//   Use passport.authenticate() as route middleware to authenticate the request. If authentication fails, the user will be redirected back to the login page. Otherwise, the primary route function function will be called, which, in this example, will redirect the user to the home page.
app.get('/auth/github/callback',
  passport.authenticate('github', { failureRedirect: '/login' }),
  function(req, res) {
    res.redirect('/');
  });

app.get('/create', checkUser, function(req, res) {
  res.render('index');
});

app.get('/links', checkUser, function(req, res) {
  Links.reset().fetch().then(function(links) {
    res.send(200, links.models);
  });
});


app.post('/links', function(req, res) {
  var uri = req.body.url;

  if (!util.isValidUrl(uri)) {
    console.log('Not a valid url: ', uri);
    return res.send(404);
  }

  new Link({ url: uri }).fetch().then(function(found) {
    if (found) {
      res.send(200, found.attributes);
    } else {
      util.getUrlTitle(uri, function(err, title) {
        if (err) {
          console.log('Error reading URL heading: ', err);
          return res.send(404);
        }

        var link = new Link({
          url: uri,
          title: title,
          base_url: req.headers.origin
        });

        link.save().then(function(newLink) {
          Links.add(newLink);
          res.send(200, newLink);
        });
      });
    }
  });
});

app.post('/signup', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username }).fetch().then(function(found) {
    if (found) {
      res.send(200, "username taken");
    } else {
      new User({username: username}).makeHash(password);
      var session = new Session({username: username});
      session.save().then(function() {
        res.cookie('session', session.get('session_key'));
        res.redirect('/');
      });
    }
  });
});

app.post('/login', function(req, res) {
  var username = req.body.username;
  var password = req.body.password;

  new User({ username: username }).fetch().then(function(found) {
    if (found) {
      if (found.checkHash(password)) {
        var session = new Session({username: username});
        session.save().then(function() {
          res.cookie('session', session.get('session_key'));
          res.redirect('/');
        })
      } else {
        res.redirect('/login');
      }
    } else {
      res.redirect('/signup');
    }
  });
});

// app.delete('/session', checkUser, function(req, res) {
//   new Session({session_key: req.cookies.session}).fetch().then(function (found) {
//     found.destroy()
//   });
//   res.cookie('session', '');
//   res.end();
// });

app.get('/logout', function(req, res){
  req.logout();
  res.redirect('/');
});


/************************************************************/
// Handle the wildcard route last - if all other routes fail
// assume the route is a short code and try and handle it here.
// If the short-code doesn't exist, send the user to '/'
/************************************************************/

app.get('/*', function(req, res) {
  new Link({ code: req.params[0] }).fetch().then(function(link) {
    if (!link) {
      res.redirect('/');
    } else {
      var click = new Click({
        link_id: link.get('id')
      });

      click.save().then(function() {
        db.knex('links')
          .where('code', '=', link.get('code'))
          .update({
            visits: link.get('visits') + 1,
          }).then(function() {
            return res.redirect(link.get('url'));
          });
      });
    }
  });
});

console.log('Shortly is listening on 4568');
app.listen(4568);

// Simple route middleware to ensure user is authenticated.
//   Use this route middleware on any resource that needs to be protected. If the request is authenticated (typically via a persistent login session), the request will proceed. Otherwise, the user will be redirected to the login page.
function checkUser(req, res, next) {
  if (req.isAuthenticated()) { return next(); }
  res.redirect('/login')
}


