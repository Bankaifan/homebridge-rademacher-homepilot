var tools = require("./tools.js");
var RademacherAccessory = require("./RademacherAccessory.js");

function RademacherBlindsAccessory(log, debug, accessory, blind, session, inverted) {
    RademacherAccessory.call(this, log, debug, accessory, blind, session);

    this.inverted = inverted;
    this.blind = blind;

    var position=0;
    if (this.blind.hasOwnProperty("statusesMap") && this.blind.statusesMap.hasOwnProperty("Position"))
    {
        position=this.blind.statusesMap.Position;
    }
    else
    {
        this.log("no position in blind object %o", blind)
    }
    this.lastPosition = this.inverted ? tools.reversePercentage(position) : position;
    this.currentTargetPosition = this.lastPosition;

    this.service = this.accessory.getService(global.Service.WindowCovering);
    
    this.service
        .getCharacteristic(global.Characteristic.CurrentPosition)
        .setValue(this.inverted ? tools.reversePercentage(position) : position)
        .on('get', this.getCurrentPosition.bind(this));

    this.service
        .getCharacteristic(global.Characteristic.TargetPosition)
        .setValue(this.currentTargetPosition)
        .on('get', this.getTargetPosition.bind(this))
        .on('set', this.setTargetPosition.bind(this));

    this.service.getCharacteristic(global.Characteristic.PositionState)
        .setValue(global.Characteristic.PositionState.STOPPED)
        .on('get', this.getPositionState.bind(this));

    this.service.getCharacteristic(Characteristic.ObstructionDetected)
        .setValue(this.blind.hasErrors)
        .on('get', this.getObstructionDetected.bind(this));

    // TODO configure interval
    setInterval(this.update.bind(this), 20000);

}

RademacherBlindsAccessory.prototype = Object.create(RademacherAccessory.prototype);

RademacherBlindsAccessory.prototype.setTargetPosition = function(value, callback) {
    this.log("%s [%s] - setting target position: %s", this.accessory.displayName, this.blind.did, value);

    var self = this;
    this.currentTargetPosition = value;
    var target = self.inverted ? tools.reversePercentage(value) : value;

    var params = {name: "GOTO_POS_CMD", value: target};
    this.session.put("/devices/"+this.blind.did, params, 5000, function(e) {
        if(e) return callback(new Error("Request failed: "+e), null);
        self.service.setCharacteristic(global.Characteristic.CurrentPosition, self.currentTargetPosition);
        self.lastPosition = self.currentTargetPosition;
        callback(null, self.currentTargetPosition);
    });
};

RademacherBlindsAccessory.prototype.getTargetPosition = function(callback) {
    if (this.debug) this.log("%s [%s] - Current target position: %s", this.accessory.displayName, this.blind.did,this.currentTargetPosition);
    var self = this;

    this.getDevice(function(e, d) {
        if(e) return callback(e, null);
        if (d.hasOwnProperty("statusesMap"))
        {
            var map=d.statusesMap;
            var pos = self.inverted ? tools.reversePercentage(map.Position) : map.Position;
            if (self.debug) self.log("%s [%s] - current target: %s", self.accessory.displayName, self.blind.did,pos);
            callback(null, pos);
        }
        else
        {
            if (self.debug) self.log("%s [%s] - no current target in %o", self.accessory.displayName, self.blind.did,o);
            callback("no current target",null);
        }
    });
};

RademacherBlindsAccessory.prototype.getCurrentPosition = function(callback) {
    if (this.debug) this.log("%s [%s] - getting current position", this.accessory.displayName, this.blind.did);

    var self = this;

    this.getDevice(function(e, d) {
        if(e) return callback(e, null);
        if (d.hasOwnProperty("statusesMap"))
        {
            var map=d.statusesMap;
            var pos = self.inverted ? tools.reversePercentage(map.Position) : map.Position;
            if (self.debug) self.log("%s [%s] - current position: %s", self.accessory.displayName, self.blind.did,pos);
            self.currentTargetPosition=pos;
            self.lastPosition=pos;
            callback(null, pos);
        }
        else
        {
            if (self.debug) elf.log("%s [%s] - no current position in %o", self.accessory.displayName, self.blind.did,o);
            callback("no current position",null);
        }
    });
};

RademacherBlindsAccessory.prototype.getPositionState = function(callback) {
    callback(null, global.Characteristic.PositionState.STOPPED);
};

RademacherBlindsAccessory.prototype.getObstructionDetected = function(callback) {
    if (this.debug) this.log("%s [%s] - getting obstruction detected", this.accessory.displayName, this.blind.did);

    var self = this;
    this.getDevice(function(e, d) {
        if(e) return callback(e, null);
        if (d.hasOwnProperty("hasErrors"))
        {
            if (self.debug) self.log("%s [%s] - obstruction detected: %s errors", self.accessory.displayName, self.blind.did, d.hasErrors);
            callback(null, d.hasErrors>0);
        }
        else
        {
            if (self.debug) self.log("%s [%s] - could not detect obstruction from %o", self.accessory.displayName, self.blind.did,d);
            callback(null, null);
        }
    });
};

RademacherBlindsAccessory.prototype.update = function() {
    //if (this.blind.did==10015) this.debug=true
    if (this.debug) this.log(`%s - [%s] updating`, this.accessory.displayName, this.blind.did);
    var self = this;

    // Switch state
    this.getCurrentPosition(function(err, pos) {
        if (err)
        {
            self.log(`%s [%s] - error getting position: %s`, self.accessory.displayName, self.blind.did, err);
        }
        else if (pos===null)
        {
            self.log(`%s [%s] - got null position`, self.accessory.displayName, self.blind.did);
        }
        else
        {
            if (self.debug) self.log(`%s [%s] - updated position to %s`, self.accessory.displayName, self.blind.did, pos);
            self.service.updateCharacteristic(Characteristic.CurrentPosition, pos);
            self.service.updateCharacteristic(Characteristic.TargetPosition, pos);    
        }
    }.bind(this));

};

module.exports = RademacherBlindsAccessory;