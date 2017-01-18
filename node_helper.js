/* Magic Mirror
 * Module: MMM-Traffic
 *
 * By Sam Lewis https://github.com/SamLewis0602
 * MIT Licensed.
 */

var NodeHelper = require('node_helper');
var request = require('request');

module.exports = NodeHelper.create({
  start: function () {
    console.log('MMM-Traffic helper started ...');
  },

  getCommute: function(api_url) {
    var self = this;
    console.log(api_url + "&departure_time=now");
    request({url: api_url + "&departure_time=now", method: 'GET'}, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var trafficComparison = 0;
	if((JSON.parse(body).status)=='OVER_QUERY_LIMIT')
	{
		console.log("API-Call Quote reached for today -> no more calls until 0:00 PST");
	}
	else
	{
        var routes = [];
        var json = JSON.parse(body);
        json.routes.forEach(function(route) {
          if (route.legs[0].duration_in_traffic) {
            var commute = route.legs[0].duration_in_traffic.text;
            var noTrafficValue = route.legs[0].duration.value;
            var withTrafficValue = route.legs[0].duration_in_traffic.value;
            trafficComparison = parseInt(withTrafficValue)/parseInt(noTrafficValue);
          } else {
            var commute = route.legs[0].duration.text;
          }
          var summary = route.summary;
          routes.push({'commute': commute, 'trafficComparison': trafficComparison, 'summary': summary});
        });
        console.log(routes.length);
        console.log(routes.length ? routes[0].commute : '');
        self.sendSocketNotification('TRAFFIC_COMMUTE', {
          'commute':routes.length ? routes[0].commute : '', 
          'url':api_url, 
          'trafficComparison': routes.length ? routes[0].trafficComparison : '',
          'summary':routes.length ? routes[0].summary : '',
          'routes':routes
        });
      }
	}
    });
  },

  getTiming: function(api_url, arrivalTime) {
    var self = this;
    var newTiming = 0;
    request({url: api_url + "&departure_time=now", method: 'GET'}, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        var durationValue = JSON.parse(body).routes[0].legs[0].duration.value;
        newTiming = self.timeSub(arrivalTime, durationValue, 0);
	      self.getTimingFinal(api_url, newTiming, arrivalTime);
      }
    });
  },

  getTimingFinal: function(api_url, newTiming, arrivalTime) {
    var self = this;
    request({url: api_url + "&departure_time=" + newTiming, method: 'GET'}, function(error, response, body) {
      if (!error && response.statusCode == 200) {
        if (JSON.parse(body).routes[0].legs[0].duration_in_traffic) {
          var trafficValue = JSON.parse(body).routes[0].legs[0].duration_in_traffic.value;
        } else {
          var trafficValue = JSON.parse(body).routes[0].legs[0].duration.value;
        }
        var summary = JSON.parse(body).routes[0].summary;
        var finalTime = self.timeSub(arrivalTime, trafficValue, 1);
        self.sendSocketNotification('TRAFFIC_TIMING', {'commute':finalTime,'summary':summary, 'url':api_url});
      }
    });

  },

  timeSub: function(arrivalTime, durationValue, lookPretty) {
    var currentDate = new Date();
    var nowY = currentDate.getFullYear();
    var nowM = (currentDate.getMonth() + 1).toString();
    if (nowM.length == 1) {
      nowM = "0" + nowM;
    }
    var nowD = currentDate.getDate();
    nowD = nowD.toString();
    if (nowD.length == 1) {
      nowD = "0" + nowD;
    }
    var nowH = arrivalTime.substr(0,2);
    var nowMin = arrivalTime.substring(2,4);
    var testDate = new Date(nowY + "-" + nowM + "-" + nowD + " " + nowH + ":" + nowMin + ":00");
    if (lookPretty == 0) {
      if (currentDate >= testDate) {
        var goodDate = new Date (testDate.getTime() + 86400000 - (durationValue*1000)); // Next day minus uncalibrated duration
        return Math.floor(goodDate / 1000);
      } else {
	      var goodDate = new Date (testDate.getTime() - (durationValue*1000)); // Minus uncalibrated duration
        return Math.floor(testDate / 1000);
      }
    } else {
      var finalDate = new Date (testDate.getTime() - (durationValue * 1000));
      var finalHours = finalDate.getHours();
      finalHours = finalHours.toString();
      if (finalHours.length == 1) {
        finalHours = "0" + finalHours;
      }
      var finalMins = finalDate.getMinutes();
      finalMins = finalMins.toString();
      if (finalMins.length == 1) {
        finalMins = "0" + finalMins;
      }
      return finalHours + ":" + finalMins;
    }
  },

  //Subclass socketNotificationReceived received.
  socketNotificationReceived: function(notification, payload) {
    if (notification === 'TRAFFIC_URL') {
      this.getCommute(payload);
    } else if (notification === 'LEAVE_BY') {
      this.getTiming(payload.url, payload.arrival);
    }
  }

});
