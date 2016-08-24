var Particle = require('particle-api-js'),
    firebase = require('firebase');
    env      = require('node-env-file')

firebase.initializeApp({
    databaseURL: process.env.DATABASE_URL,
    serviceAccount: "./serviceAccountCredentials.json"
})

var particle = new Particle();
env('./credentials.env');
var db = firebase.database();

particle.login({username: process.env.USERNAME, password: process.env.PASSWORD}).then(
  function(data){
        console.log(`Successfully logged into particle`);
        particle.getEventStream({ deviceId: process.env.DEVICE_ID, auth: data.body.access_token }).then(function(stream) {
        stream.on('event', function(data) {
            switch(data.name) {
                case 'humidity': 
                    db.ref('Humidity').set(data.data + "%")
                    break;
                case 'tempF': 
                    db.ref('Temperature').set(data.data + "°")
                    break;
                case 'lightValue': 
                    if(data.data > 100) {
                        db.ref('Lights').set(true)
                    } else {
                        db.ref('Lights').set(false)
                    }
                    break;
            }
        });
    });
  },
  function(err) {
    console.log('API call completed on promise fail: ', err);
  }
);
