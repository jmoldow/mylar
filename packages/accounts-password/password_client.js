// Attempt to log in with a password.
//
// @param selector {String|Object} One of the following:
//   - {username: (username)}
//   - {email: (email)}
//   - a string which may be a username or email, depending on whether
//     it contains "@".
// @param password {String}
// @param callback {Function(error|undefined)}
Meteor.loginWithPassword = function (selector, password, callback) {
  var srp = new Meteor._srp.Client(password);
  var request = srp.startExchange();

    var uname;

    if (typeof selector === 'string') {
	if (selector.indexOf('@') === -1){
	    uname = selector;
	    selector = {username: selector};
	}
	else {
	    uname = selector;
	    selector = {email: selector};
	}
    } else {
	if (selector['username']) {
	    uname = selector['username'];
	} else {
	    throw new Error("cannot login user without some username");
	}
    }
    
    request.user = selector;
    
    // Normally, we only set Meteor.loggingIn() to true within
    // Accounts.callLoginMethod, but we'd also like it to be true during the
    // password exchange. So we set it to true here, and clear it on error; in
    // the non-error case, it gets cleared by callLoginMethod.
    Accounts._setLoggingIn(true);
    Meteor.apply('beginPasswordExchange', [request], function (error, result) {
	if (error || !result) {
	    Accounts._setLoggingIn(false);
	    error = error || new Error("No result from call to beginPasswordExchange");
	    callback && callback(error);
	    return;
	}
	
	var response = srp.respondToChallenge(result);
	
	console.log("logging in user " + uname);
	if (loadedPrincipal()) {
	    console.log("EXECUTING!");
	    idp.get_keys(uname, password, function(keys) {
		if (!keys) {
		    throw new Error("idp error, cannot login this user");
		}
 		localStorage['user_princ_keys']= keys;
		Accounts.callLoginMethod({
		    methodArguments: [{srp: response}],
		    validateResult: function (result) {
			if (!srp.verifyConfirmation({HAMK: result.HAMK}))
			    throw new Error("Server is cheating!");
		    },
		    userCallback: callback});
	    });
	} else {
	    console.log("NOT LOADED PRINC");
	    
	    Accounts.callLoginMethod({
		methodArguments: [{srp: response}],
		validateResult: function (result) {
		    if (!srp.verifyConfirmation({HAMK: result.HAMK}))
			throw new Error("Server is cheating!");
		},
		userCallback: callback});
	}
    });
    
};

// Attempt to log in as a new user.
Accounts.createUser = function (options, callback) {
    options = _.clone(options); // we'll be modifying options

    var uname = options.username;
    var pwd = options.password;

    if (!pwd)
	throw new Error("Must set options.password");
    
    if (!uname) {
	throw new Error("Meteor-enc needs username when creating account");
    }

    var verifier = Meteor._srp.generateVerifier(options.password);
    // strip old password, replacing with the verifier object
    delete options.password;
    options.srp = verifier;

    if (loadedPrincipal()) {
	console.log("LOADED PRINC");
	Principal.create("user", uname, null, function(uprinc){
	    var ser_keys = serialize_keys(uprinc.keys);
	    
	    // store user keys in local storage
	    // localStorage can only deal with serialized strings
	    localStorage['user_princ_keys'] = serialize_keys(uprinc.keys);
	    
	    idp.set_keys(uname, pwd, ser_keys, function(){
		Accounts.callLoginMethod({
		    methodName: 'createUser',
		    methodArguments: [options],
		    userCallback: callback
		});    
	    });
	    
	});
    } else {
	console.log("NOT LOADED PRINC");
	Accounts.callLoginMethod({
	    methodName: 'createUser',
	    methodArguments: [options],
	    userCallback: callback
	}); 
    }
};



// Change password. Must be logged in.
//
// @param oldPassword {String|null} By default servers no longer allow
//   changing password without the old password, but they could so we
//   support passing no password to the server and letting it decide.
// @param newPassword {String}
// @param callback {Function(error|undefined)}
Accounts.changePassword = function (oldPassword, newPassword, callback) {
  if (!Meteor.user()) {
    callback && callback(new Error("Must be logged in to change password."));
    return;
  }

  var verifier = Meteor._srp.generateVerifier(newPassword);

  if (!oldPassword) {
    Meteor.apply('changePassword', [{srp: verifier}], function (error, result) {
      if (error || !result) {
        callback && callback(
          error || new Error("No result from changePassword."));
      } else {
        callback && callback();
      }
    });
  } else { // oldPassword
    var srp = new Meteor._srp.Client(oldPassword);
    var request = srp.startExchange();
    request.user = {id: Meteor.user()._id};
    Meteor.apply('beginPasswordExchange', [request], function (error, result) {
      if (error || !result) {
        callback && callback(
          error || new Error("No result from call to beginPasswordExchange"));
        return;
      }

      var response = srp.respondToChallenge(result);
      response.srp = verifier;
      Meteor.apply('changePassword', [response], function (error, result) {
        if (error || !result) {
          callback && callback(
            error || new Error("No result from changePassword."));
        } else {
          if (!srp.verifyConfirmation(result)) {
            // Monkey business!
            callback && callback(new Error("Old password verification failed."));
          } else {
            callback && callback();
          }
        }
      });
    });
  }
};

// Sends an email to a user with a link that can be used to reset
// their password
//
// @param options {Object}
//   - email: (email)
// @param callback (optional) {Function(error|undefined)}
Accounts.forgotPassword = function(options, callback) {
  if (!options.email)
    throw new Error("Must pass options.email");
  Meteor.call("forgotPassword", options, callback);
};

// Resets a password based on a token originally created by
// Accounts.forgotPassword, and then logs in the matching user.
//
// @param token {String}
// @param newPassword {String}
// @param callback (optional) {Function(error|undefined)}
Accounts.resetPassword = function(token, newPassword, callback) {
  if (!token)
    throw new Error("Need to pass token");
  if (!newPassword)
    throw new Error("Need to pass newPassword");

  var verifier = Meteor._srp.generateVerifier(newPassword);
  Accounts.callLoginMethod({
    methodName: 'resetPassword',
    methodArguments: [token, verifier],
    userCallback: callback});
};

// Verifies a user's email address based on a token originally
// created by Accounts.sendVerificationEmail
//
// @param token {String}
// @param callback (optional) {Function(error|undefined)}
Accounts.verifyEmail = function(token, callback) {
  if (!token)
    throw new Error("Need to pass token");

  Accounts.callLoginMethod({
    methodName: 'verifyEmail',
    methodArguments: [token],
    userCallback: callback});
};
