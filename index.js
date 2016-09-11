const Particle = require('particle-api-js'),
      firebase = require('firebase'),
      CronJob  = require('cron').CronJob,
      _        = require('lodash');
      env      = require('node-env-file')('./credentials.env');

firebase.initializeApp({
    databaseURL: process.env.DATABASE_URL,
    serviceAccount: process.env.SERVICE_ACCOUNT
});

const particle = new Particle();
const db = firebase.database();

particle.login({
  username: process.env.USERNAME,
  password: process.env.PASSWORD
}).then(data => {
    console.log(`Successfully logged into particle`);
    particleStream(data.body.access_token);
  }, error => {
    console.log('Failed to log into Particle: ', error);
  });

const particleStream = auth => {
  particle.getEventStream({
    deviceId: process.env.DEVICE_ID,
    auth: auth
  }).then(stream => {
    stream.on('event', newData);
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
          db.ref('current/light').set(data.data)
          db.ref('Lights/gathering/' + timestamp).set(data.data);
          break;
  }
}

const propagateData = (dataArray, ref) => {
  const meanData  = _.mean(dataArray),
        timestamp = new Date();

  timestamp.setMinutes(timestamp.getMinutes() + 30);
  timestamp.setMinutes(0);

  ref.child('gathering').set({});
  ref.child('mean').child(timestamp.getTime()).set(mean);
}

const averageCron = new CronJob('0 0 * * * *', () => {
  const refs = [db.ref('Humidity'),
                db.ref('Temperature'),
                db.ref('Lights')];

  _.forEach(refs, ref => {
    ref.child('gathering').once('value')
     .then(data => {
      const gatheredData = [];
      data.forEach(data => {
        const dataInt = parseInt(data.val(), 10);
        if(Number.isInteger(dataInt)) {
          gatheredData.push(dataInt);
        }
      });
      if(gatheredData.length >= 1) {
        propagateData(gatheredData, ref);
      }
    });
  })
}, null, true, 'America/Los_Angeles');
