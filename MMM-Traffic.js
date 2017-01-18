/* global Module */

/* Magic Mirror
 * Module: MMM-Traffic
 *
 * By Sam Lewis https://github.com/SamLewis0602
 * MIT Licensed.
 */

Module.register('MMM-Traffic', {

    defaults: {
        api_key: '',
        mode: 'driving',
        interval: 300000, //all modules use milliseconds
        origin: '',
        destination: '',
        traffic_model: 'best_guess',
        departure_time: 'now',
        arrival_time: '',
        loadingText: 'Loading commute...',
        prependText: 'Current commute is',
        changeColor: false,
        limitYellow: 10,
        limitRed: 30,
        showGreen: true,
        language: config.language,
        show_summary: true,
        show_alternatives: false
    },

    start: function() {
        Log.info('Starting module: ' + this.name);
        if (this.data.classes === 'MMM-Traffic') {
          this.data.classes = 'bright medium';
        }
        this.loaded = false;
        this.leaveBy = '';
        this.url = encodeURI('https://maps.googleapis.com/maps/api/directions/json' + this.getParams());
        this.symbols = {
            'driving': 'fa fa-car',
            'walking': 'fa fa-odnoklassniki',
            'bicycling': 'fa fa-bicycle',
            'transit': 'fa fa-train'
        };
        this.commute = '';
        this.summary = '';
        this.updateCommute(this);
    },

    updateCommute: function(self) {
        if (self.config.arrival_time.length == 4) {
          self.sendSocketNotification('LEAVE_BY', {'url':self.url, 'arrival':self.config.arrival_time});
        } else {
          self.sendSocketNotification('TRAFFIC_URL', self.url);
        }
        setTimeout(self.updateCommute, self.config.interval, self);
    },

    getStyles: function() {
        return ['traffic.css', 'font-awesome.css'];
    },

    getDom: function() {
        var wrapper = document.createElement("div");
        var commuteInfo = document.createElement('div'); //support for config.changeColor

        if (!this.loaded) {
            wrapper.innerHTML = this.config.loadingText;
            return wrapper;
        }

        //symbol
        var symbol = document.createElement('span');
        symbol.className = this.symbols[this.config.mode] + ' symbol';
        commuteInfo.appendChild(symbol);

        function getColor(data, config) {
          if (!config.changeColor) return '';
          if (data.trafficComparison >= 1 + (config.limitRed / 100)) return 'red';
          if (data.trafficComparison >= 1 + (config.limitYellow / 100)) return ' yellow';
          if (config.showGreen) return ' green';
          return '';
        }
        
        if (this.config.arrival_time == '') {
          //commute time
          var trafficInfo = document.createElement('span');
          trafficInfo.innerHTML = this.config.prependText + ' ' + this.commute;
          commuteInfo.appendChild(trafficInfo);

          //change color if desired and append
          commuteInfo.className += ' ' + getColor(this, this.config);
          wrapper.appendChild(commuteInfo);

          //routeName & alternatives
          if (this.config.route_name) {
            for (var x=0; x < this.routes.length; x++) {
              var routeName = document.createElement('div');
              routeName.className = 'dimmed small ' + getColor(this.routes[x], this.config);
              if (this.routes[x].summary.length > 0 && this.config.show_summary){
                routeName.innerHTML = this.config.route_name + ' via ' + this.routes[x].summary + ' - ' + this.routes[x].commute; //todo translatable?
              } else {
                routeName.innerHTML = this.config.route_name;
              }
              wrapper.appendChild(routeName);
            }
          }
        } else {
          //leave-by time
          var trafficInfo = document.createElement('span');
          trafficInfo.innerHTML = "Leave by " + this.leaveBy;
          commuteInfo.appendChild(trafficInfo);
  	      wrapper.appendChild(commuteInfo);

          //routeName
          if (this.config.route_name) {
            var routeName = document.createElement('div');
            routeName.className = 'dimmed small';
            if (this.summary.length > 0 && this.config.show_summary){
              routeName.innerHTML = this.config.route_name + ' via ' + this.summary + " to arrive by " + this.config.arrival_time.substring(0,2) + ":" + this.config.arrival_time.substring(2,4);
            } else {
	      console.log(typeof this.config.arrival_time );
              routeName.innerHTML = this.config.route_name + " to arrive by " + this.config.arrival_time.substring(0,2) + ":" + this.config.arrival_time.substring(2,4);
            }
            wrapper.appendChild(routeName);
          }
        }
        return wrapper;
    },

    getParams: function() {
        var params = '?';
        params += 'mode=' + this.config.mode;
        params += '&origin=' + this.config.origin;
        params += '&destination=' + this.config.destination;
        params += '&key=' + this.config.api_key;
        params += '&traffic_model=' + this.config.traffic_model;
        params += '&language=' + this.config.language;
        params += '&alternatives=' + this.config.show_alternatives;
        return params;
    },

    socketNotificationReceived: function(notification, payload) {
        this.leaveBy = '';
        if (notification === 'TRAFFIC_COMMUTE' && payload.url === this.url) {
            Log.info('received TRAFFIC_COMMUTE');
            this.commute = payload.commute;
            this.summary = payload.summary;
            this.trafficComparison = payload.trafficComparison;
            this.routes = payload.routes;
            this.loaded = true;
            this.updateDom(1000);
        } else if (notification === 'TRAFFIC_TIMING' && payload.url === this.url) {
            Log.info('received TRAFFIC_TIMING');
            this.leaveBy = payload.commute;
            this.summary = payload.summary;
            this.loaded = true;
            this.updateDom(1000);
        }
    }

});
