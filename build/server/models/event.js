// Generated by CoffeeScript 1.9.0
var Event, User, async, cozydb, log, momentTz,
  __indexOf = [].indexOf || function(item) { for (var i = 0, l = this.length; i < l; i++) { if (i in this && this[i] === item) return i; } return -1; };

cozydb = require('cozy-db-pouchdb');

momentTz = require('moment-timezone');

async = require('async');

log = require('printit')({
  prefix: 'event:model'
});

User = require('./user');

module.exports = Event = cozydb.getModel('Event', {
  start: {
    type: String
  },
  end: {
    type: String
  },
  place: {
    type: String
  },
  details: {
    type: String
  },
  description: {
    type: String
  },
  rrule: {
    type: String
  },
  tags: [String],
  attendees: {
    type: [Object]
  },
  related: {
    type: String,
    "default": null
  },
  timezone: {
    type: String
  },
  alarms: {
    type: [Object]
  },
  created: {
    type: String
  },
  lastModification: {
    type: String
  }
});

Event.dateFormat = 'YYYY-MM-DD';

Event.ambiguousDTFormat = 'YYYY-MM-DD[T]HH:mm:00.000';

Event.utcDTFormat = 'YYYY-MM-DD[T]HH:mm:00.000[Z]';

Event.alarmTriggRegex = /(\+?|-)PT?(\d+)(W|D|H|M|S)/;

require('cozy-ical').decorateEvent(Event);

Event.byCalendar = function(calendarId, callback) {
  return Event.request('byCalendar', {
    key: calendarId
  }, callback);
};

Event.tags = function(callback) {
  return Event.rawRequest("tags", {
    group: true
  }, function(err, results) {
    var out, result, tag, type, _i, _len, _ref;
    if (err) {
      return callback(err);
    }
    out = {
      calendar: [],
      tag: []
    };
    for (_i = 0, _len = results.length; _i < _len; _i++) {
      result = results[_i];
      _ref = result.key, type = _ref[0], tag = _ref[1];
      out[type].push(tag);
    }
    return callback(null, out);
  });
};

Event.createOrGetIfImport = function(data, callback) {
  if (data["import"]) {
    return Event.request('byDate', {
      key: data.start
    }, function(err, events) {
      if (err) {
        log.error(err);
        return Event.create(data, callback);
      } else if (events.length === 0) {
        return Event.create(data, callback);
      } else if (data.description === events[0].description) {
        log.warn('Event already exists, it was not created.');
        return callback(null, events[0]);
      } else {
        return Event.create(data, callback);
      }
    });
  } else {
    return Event.create(data, callback);
  }
};

Event.prototype.isAllDayEvent = function() {
  return this.start.length === 10;
};

Event.prototype.formatStart = function(dateFormat) {
  var date, formattedDate;
  if (this.rrule) {
    date = momentTz.tz(this.start, this.timezone);
  } else {
    date = momentTz(this.start);
  }
  date.tz(User.timezone);
  formattedDate = date.format(dateFormat);
  if (!this.isAllDayEvent()) {
    formattedDate += " (" + User.timezone + ")";
  }
  return formattedDate;
};

Event.prototype.getGuest = function(key) {
  var currentguest, guests;
  guests = this.attendees || [];
  currentguest = guests.filter(function(guest) {
    return guest.key === key;
  })[0];
  if (currentguest) {
    currentguest.setStatus = (function(_this) {
      return function(status, callback) {
        currentguest.status = status;
        return _this.updateAttributes({
          attendees: guests
        }, callback);
      };
    })(this);
  }
  return currentguest;
};

Event.prototype.getAlarmAttendeesEmail = function() {
  return [User.email];
};

Event.prototype.migrateDoctype = function(callback) {
  var hasMigrate;
  hasMigrate = this.migrateDateTime('start');
  if (!hasMigrate) {
    return callback();
  } else {
    this.migrateDateTime('end');
    if (this.rrule) {
      this.timezone = User.timezone;
    } else {
      this.timezone = void 0;
    }
    return this.save(callback);
  }
};

Event.prototype.migrateDateTime = function(dateField) {
  var d, dateStr, m, timezone;
  dateStr = this[dateField];
  if (!dateStr) {
    return false;
  }
  if (dateStr.length === 10 || dateStr.charAt(10) === 'T') {
    return false;
  }
  d = dateStr;
  if (__indexOf.call(dateStr, "GMT") < 0) {
    d = d + " GMT+0000";
  }
  m = momentTz.tz(d, 'UTC');
  if (this.rrule) {
    timezone = User.timezone || "Europe/Paris";
    this[dateField] = m.tz(timezone).format(Event.ambiguousDTFormat);
  } else {
    this[dateField] = m.format(Event.utcDTFormat);
  }
  return true;
};

Event.prototype.patchTag = function(callback) {
  if ((this.tags == null) || (this.tags[0] == null)) {
    return this.updateAttributes({
      tags: ['my-calendar']
    }, callback);
  } else {
    return callback();
  }
};

Event.migrateAll = function(callback) {
  return Event.all({}, function(err, events) {
    if (err != null) {
      console.log(err);
      return callback();
    } else {
      return async.eachLimit(events, 10, function(event, done) {
        return event.migrateDoctype(function() {
          return event.patchTag(done);
        });
      }, callback);
    }
  });
};

Event.bulkCalendarRename = function(oldName, newName, callback) {
  return Event.request('byCalendar', {
    key: oldName
  }, function(err, events) {
    return async.eachLimit(events, 10, function(event, done) {
      var tags;
      tags = [].concat(event.tags);
      tags[0] = newName;
      return event.updateAttributes({
        tags: tags
      }, done);
    }, function(err) {
      return callback(err, events);
    });
  });
};

Event.bulkDelete = function(calendarName, callback) {
  return Event.request('byCalendar', {
    key: calendarName
  }, function(err, events) {
    return async.eachLimit(events, 10, function(event, done) {
      return event.destroy(done);
    });
  });
};
