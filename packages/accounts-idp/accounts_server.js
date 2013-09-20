
Accounts.certifyFunc(function(options, user) {
    // check certificate
    var cert = options.cert;
    var uname = options.username;

    var ok = idp_check("register", uname, cert, idp_pk);

    if (!ok) {
	user._validate = false;
    } else {
	user._validate = true;
	user._wrap_privkey = options.wrap_privkey;
	user._pubkey_cert = options.key_cert;
	user_pk = options.pub_keys;
    }

    delete options.wrap_privkey;
    delete option.key_cert;
    delete options.cert;
    delete options.pub_keys;

    return user;
});

Meteor.methods({
    GetWrapPrivKey: function(){
	console.log("returning wrap key " +
		    Meteor.user()._wrap_privkey);
	return Meteor.user()._wrap_privkey;
    }
});

//gets called after onCreateUser
Accounts.validateNewUser(function(user){
    return user._validate;
});

