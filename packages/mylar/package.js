Package.describe({
    summary: "Protect data confidentiality from server attacks.",
});

Package.on_use(function (api) {

    var where = ['client', 'server'];

    api.use(['principal', 'accounts-idp'], where);
    api.imply(['principal', 'accounts-idp'], where);
    api.add_files(['mylar.js'], where);
    api.export('USE_MYLAR');
});
