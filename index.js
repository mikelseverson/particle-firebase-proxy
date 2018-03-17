const Particle = require('particle-api-js'),
  firebase = require('firebase'),
  CronJob = require('cron').CronJob,
  _ = require('lodash'),
  env = require('node-env-file')('./credentials.env');

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
  }, error => {
    console.log(error);
  });
}

const initializeFifteenMinCron = () =>
  new CronJob('* */15 * * * *', () => cronHandler)();

const newData = data => {
  const timestamp = Date.now();
  switch (data.name) {
    case 'PH':
      const PH = Number(data.data)
      db.ref('current/ph').set(PH)
      db.ref(`PH/gathering/${Date.now()}`).set(PH);
      break;
    case 'humidity':
      const humidity = data.data + "%"
      db.ref('current/humidity').set(humidity)
      db.ref(`Humidity/gathering/${Date.now()}`).set(data.data)
      break;
    case 'tempF':
      const temperature = data.data + "°"
      db.ref('current/temperature').set(temperature)
      db.ref(`Temperature/gathering/${Date.now()}`).set(data.data)
      break;
    case 'lightValue':
      db.ref('current/light').set(data.data)
      db.ref(`Lights/gathering/${Date.now()}`).set(data.data);
      break;
  }
}

const propagateData = (data, ref) => {
  let meanData,
    dataArray = [];

  _.forOwn(data, dataSnapshot => {
    dataArray.push(dataSnapshot.value);
  });

  ref.child('gathering').set({});
  ref.child('mean').child(Date.now()).set(_.mean(dataArray));
}

const cronHandler = () => [
    db.ref('Humidity'),
    db.ref('Temperature'),
    db.ref('Lights'),
    db.ref('PH'),
  ].map(ref =>
    ref.child('gathering').once('value')
    .then(dataSnap => {
      const data = dataSnap.val(),
        parsedData = [];

      _.forOwn(data, (data, timestamp) => {
        parsedData.push({
          value: data,
          timestamp: timestamp
        });
      });
      if (parsedData.length >= 1) {
        propagateData(parsedData, ref);
      }
    }), null, true, 'America/Los_Angeles');