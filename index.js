var Particle = require('particle-api-js'),
    firebase = require('firebase'),
    CronJob  = require('cron').CronJob,
    _        = require('lodash');

require('node-env-file')('./credentials.env');

firebase.initializeApp({
    databaseURL: process.env.DATABASE_URL,
    serviceAccount: "./serviceAccountCredentials.json"
});

var particle = new Particle();
var db = firebase.database();

particleLogin();

function particleLogin() {
  particle.login({
    username: process.env.USERNAME,
    password: process.env.PASSWORD
  }).then(data => {
      console.log(`Successfully logged into particle`);
      particle.getEventStream({
        deviceId: process.env.DEVICE_ID,
        auth: data.body.access_token
      }).then(stream => {
        stream.on('event', newData);
      });
    }, error => {
      console.log('Failed to log into Particle: ', error);
    });
}

const newData = data => {
  const timestamp = Date.now();
  switch(data.name) {
      case 'humidity':
          const humidity = data.data + "%"
          db.ref('current/humidity').set(humidity)
          db.ref('Humidity/gathering/' + timestamp).set(humidity)
          break;
      case 'tempF':
          const temperature = data.data + "°"
          db.ref('current/temperature').set(temperature)
          db.ref('Temperature/gathering/' + timestamp).set(temperature)
          break;
      case 'lightValue':
          db.ref('Lights/gathering/' + timestamp).set(data.data);
          break;
  }
}

const averageCron = new CronJob('0 0 * * * *', () => {
  const refs = [db.ref('Humidity'), db.ref('Temperature'), db.ref('Lights')];
  _.forEach(refs, ref => {
    const dataArray = [];
    ref.child('gathering').once('value', data => {
      data.forEach(data => {
        const dataInt = parseInt(data.val(), 10);
        if(Number.isInteger(dataInt)) {
          dataArray.push(dataInt);
        }
      });
      if(dataArray.length > 1) {
        const mean = _.mean(dataArray);
        ref.child('gathering').set({});
        const d = new Date();
        d.setMinutes(d.getMinutes() + 30);
        d.setMinutes(0);
        ref.child('mean').child(d.getTime()).set(mean);
      }
    });
  })
}, null, true, 'America/Los_Angeles');
