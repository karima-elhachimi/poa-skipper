const app = require('./app')

app.listen(process.env.PORT || 8080, () => {
    console.log("Express server listening on port %d in %s mode", this.address().port, app.settings.env);
});
