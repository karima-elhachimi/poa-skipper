const app = require('./app')
var port = process.env.PORT || 8080;
app.listen(port/*, '0.0.0.0'*/, function() {
    console.log('Our app is running on http://localhost:' + port);
});
