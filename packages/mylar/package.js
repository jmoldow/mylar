Package.describe({
    summary: "Protect data confidentiality from server attacks.",
});

Package.on_use(function (api) {

    var where = ['client', 'server'];

    api.imply(['principal', 'accounts-idp']);

    api.export('USE_MYLAR');
});
