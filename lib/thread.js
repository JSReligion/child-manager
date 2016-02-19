"use strict";
//
class Thread extends require("events") {
    constructor(proc, next, numThreads) {
        super();
        var err = new Error("Invalid number of threads requested");
        if (numThreads < 1) throw err;

        this.numCPUs = require('os').cpus().length;
        if (numThreads != null) {
            if (numThreads > this.numCPUs) {
                console.log("Warning: Allocating more threads than available CPUs(" + this.numCPUs + ")");
            }
            this.numCPUs = numThreads;
        }
        if (typeof proc === "string") {
            proc = [proc];
        };

        this.proc = proc;
        this.next = next;

        this.name = proc[0];
        this.threadArray = new Array();
        this.cp = require('child_process');
        this.nextAvailThread = 0;

        for (var i = 0; i < this.numCPUs; i++) {
            this.threadArray.push(this.cp.fork.apply(null, proc));
            this.threadArray[i].on('message', function (out) {
                next(out);
            });
        }
    }
};

Thread.prototype.execute = function(params, affinity) {
    var nextAvailThread = this.nextAvailThread;
    var updateNextAvailThreadFlag = true;

    if(affinity != null) {
        var err = new Error("Invalid thread affinity");
        if( (affinity > (this.numCPUs-1)) || 
            (affinity < 0) ) throw err;
        if(affinity > -1) {
            nextAvailThread = affinity;
            updateNextAvailThreadFlag = false;
        }
    }

    console.log("Executing on thread: " + nextAvailThread +
                " with process id: ", this.threadArray[nextAvailThread].pid);
       
    this.threadArray[nextAvailThread].send(params);

    if(updateNextAvailThreadFlag) {
        this.nextAvailThread++;
        if(this.nextAvailThread == this.numCPUs)
            this.nextAvailThread = 0;
    }
}

Thread.prototype.close = function() {
    for(var i in this.threadArray) {
        this.threadArray[i].kill();
    }
};

Thread.prototype.bindEvents= function( threadInd ){
    this.threadArray.forEach( ( cp, i ) => {
        if( threadInd !== undefined && threadInd !== i ) return;
        cp
            .on("close",      ( code, signal ) => this.emit("down", "close", cp, code, signal ) )
            .on("disconnect", ()               => this.emit("down", "disconnect", cp ) )
            .on("exit",       ( code, signal ) => this.emit("down", "exit", cp, code, signal ) )
            .on("error",      ( err )          => this.emit("error","error", cp, err ) );
    } );
};

Thread.prototype.makePersistent= function() {
    this.on( "down", ( type, cp ) => {
        for( let i = 0; i < this.threadArray.length; i++ ){
            if( this.threadArray[i].pid === cp.pid && cp.killed === false ){
                this.threadArray[i].kill();
                this.threadArray[i]= this.cp.fork.apply(null, this.proc);
                this.threadArray[i].on('message', this.next);
                this.bindEvents( i );
                break;
            };
        };
    });
};

exports = module.exports = Thread;