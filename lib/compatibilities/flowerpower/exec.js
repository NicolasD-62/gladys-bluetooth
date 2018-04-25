const Promise = require('bluebird');
const rp = require('request-promise');
const async = require('async');
const FlowerPower = require('flower-power');
const globalConfig = require('../../../config.js');
const shared = require('../../shared.js');
const config = require('./config.js');

var delays = {
  airTemperature: intervalToDelay(config.updateIntervalAirTemperature),
  soilTemperature: intervalToDelay(config.updateIntervalSoilTemperature),
  light: intervalToDelay(config.updateIntervalLight),
  moisture: intervalToDelay(config.updateIntervalMoisture),
  soilEC: intervalToDelay(config.updateIntervalSoilEC),
  batteryLevel: intervalToDelay(config.updateIntervalBatteryLevel)
};

module.exports = function exec(peripheral) {
  var now = new Date();

  var identifier;
  if (peripheral.address && peripheral.address !== 'unknown') {
    identifier = peripheral.address;
  } else {
    identifier = peripheral.id;
  }

  // We look in local memory DB is the bluetooth device exists and is known.
  if (shared.devices[identifier]) {
    var toUpdate = false;
    var typeToUpdate = [];
    var devicetypeId = [];

    var options = {
      method: 'GET',
      uri: `${globalConfig.gladysUrl}/device/${shared.devices[identifier].id}/devicetype?token=${globalConfig.token}`,
      json: true
    };

    rp(options)
      .then(function (devicetypes) {
        // For each DeviceType
        Promise.map(devicetypes, function (devicetype) {
          devicetypeId[devicetype.type] = devicetype.id;

          // Get last change date of the DeviceType
          var lastChanged = new Date(devicetype.lastChanged);
          var delay = now - lastChanged;

          // Is update needed?
          typeToUpdate[devicetype.type] = !lastChanged || delay >= delays[devicetype.type];
          toUpdate = toUpdate || !lastChanged || typeToUpdate[devicetype.type];
        })
          .then(function () {
            if (toUpdate) {
              FlowerPower.discoverById(peripheral.id, function(flowerPower) {
                console.log(`flowerpower discovered - ${flowerPower}`);
                async.series([
                  function(callback) {
                    flowerPower.on('disconnect', function() {
                      console.log(`flowerpower - disconnected`);
                    });

                    flowerPower.on('sunlightChange', function(value) {
                      var type = 'light';
                      if (typeToUpdate[type]) {
                        console.log(`flowerpower - updating ${type}`);
                        sendDevicestate(type, devicetypeId[type], photonsToLux(value));
                        typeToUpdate[type] = false;
                      }
                    });

                    flowerPower.on('airTemperatureChange', function(value) {
                      var type = 'airTemperature';
                      if (typeToUpdate[type]) {
                          console.log(`flowerpower - updating ${type}`);
                          sendDevicestate(type, devicetypeId[type], value.toFixed(2));
                          typeToUpdate[type] = false;
                        }
                    });

                    flowerPower.on('soilTemperatureChange', function(value) {
                      var type = 'soilTemperature';
                      if (typeToUpdate[type]) {
                          console.log(`flowerpower - updating ${type}`);
                          sendDevicestate(type, devicetypeId[type], value.toFixed(2));
                          typeToUpdate[type] = false;
                        }
                    });

                    flowerPower.on('soilMoistureChange', function(value) {
                      var type = 'moisture';
                      if (typeToUpdate[type]) {
                          console.log(`flowerpower - updating ${type}`);
                          sendDevicestate(type, devicetypeId[type], value.toFixed(2));
                          typeToUpdate[type] = false;
                        }
                    });

                    flowerPower.on('soilElectricalConductivityChange', function(value) {
                      var type = 'soilEC';
                      if (typeToUpdate[type]) {
                          console.log(`flowerpower - updating ${type}`);
                          sendDevicestate(type, devicetypeId[type], (value / 1000).toFixed(2));
                          typeToUpdate[type] = false;
                        }
                    });

                    console.log(`flowerpower - connecting...`);
                    flowerPower.connect(callback);
                  },
                  function(callback) {
                    flowerPower.discoverServicesAndCharacteristics(callback);
                  },
/* use LiveMode only
                  function(callback) {
                    var type = 'light';
                    if (typeToUpdate[type]) {
                      console.log(`flowerpower - updating ${type}`);
                      flowerPower.readSunlight(function (error, value) {
                          sendDevicestate(type, devicetypeId[type], photonsToLux(value));
                          typeToUpdate[type] = false;
                          callback();
                      });
                    } else callback();
                  },
                  function(callback) {
                    var type = 'airTemperature';
                    if (typeToUpdate[type]) {
                      console.log(`flowerpower - updating ${type}`);
                      flowerPower.readAirTemperature(function (error, value) {
                          sendDevicestate(type, devicetypeId[type], value.toFixed(2));
                          typeToUpdate[type] = false;
                          callback();
                    });
                    } else callback();
                  },
                  function(callback) {
                    var type = 'soilTemperature';
                    if (typeToUpdate[type]) {
                      console.log(`flowerpower - updating ${type}`);
                      flowerPower.readSoilTemperature(function (error, value) {
                          sendDevicestate(type, devicetypeId[type], value.toFixed(2));
                          typeToUpdate[type] = false;
                          callback();
                      });
                    } else callback();
                  },
                  function(callback) {
                    var type = 'moisture';
                    if (typeToUpdate[type]) {
                      console.log(`flowerpower - updating ${type}`);
                      flowerPower.readSoilMoisture(function (error, value) {
                          sendDevicestate(type, devicetypeId[type], value);
                          typeToUpdate[type] = false;
                          callback();
                      });
                    } else callback();
                  },
                  function(callback) {
                    var type = 'soilEC';
                    if (typeToUpdate[type]) {
                      console.log(`flowerpower - updating ${type}`);
                      flowerPower.readSoilElectricalConductivity(function (error, value) {
                          sendDevicestate(type, devicetypeId[type], (value / 1000).toFixed(2));
                          typeToUpdate[type] = false;
                          callback();
                      });
                    } else callback();
                  },
*/
                  function(callback) {
                    var type = 'batteryLevel';
                    if (typeToUpdate[type]) {
                      console.log(`flowerpower - updating ${type}`);
                      flowerPower.readBatteryLevel(function (error, value) {
                        sendDevicestate(type, devicetypeId[type], value);
                        typeToUpdate[type] = false;
                        callback();
                      });
                    } else callback();
                  },
                  // realtime values
                  function(callback) {
                    console.log(`flowerpower - enable LiveMode`);
                    flowerPower.enableLiveMode(callback);
                  },
                  function(callback) {
                    setTimeout(callback, 5000);
                  },
                  function(callback) {
                   console.log(`flowerpower - disable LiveMode`);
                    flowerPower.disableLiveMode(callback);
                  },
                  // disconnect
                  function(callback) {
                    console.log(`flowerpower - disconnect Device ${identifier}`);
                    flowerPower.disconnect(callback);
                  }
                ])
              });
            }
          });
      })
      .catch(function (err) {
        console.error('flowerpower - Error while getting DeviceTypes from Gladys:');
        console.error(err);
      });
  }
};

function sendDevicestate(type, id, value) {
  setDevicestate(id, value)
    .then(function (parsedResult) {
      console.log(`DeviceType "${parsedResult.devicetype}" and DeviceState "${type}" inserted with success !`);
    })
    .catch(function (err) {
      logSendingError(err, type);
    });
}

function setDevicestate(id, value) {
  var options = {
    method: 'POST',
    uri: `${globalConfig.gladysUrl}/devicestate?token=${globalConfig.token}`,
    body: {
      devicetype: id,
      value: value
    },
    json: true
  };

  return rp(options);
}

function logSendingError(err, type) {
  console.error(`flowerpower - Error while sending ${type} to Gladys:`);
  console.error(err);
}

function intervalToDelay(interval) {
  return parseInt(interval, 10) * 60 * 1000;
}

function photonsToLux(value) {
  return (value * 1250).toFixed(0);
}