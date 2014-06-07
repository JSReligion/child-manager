function Thread(num, file) {
    var i;
    
    this.name = file;
    this.threadArray = new Array();
    this.cp = require('child_process');
    this.nextAvailThread = 0;
    this.totalNumThreads = num;
    
    for(i=0; i<num; i++) {
        this.threadArray.push(this.cp.fork(file));
        this.threadArray[i].on('message', function(out) {
                console.log("Done with thread execution", out);
            });
    }
}

Thread.prototype.execute = function(params) {
    console.log("Executing on thread: ", this.nextAvailThread);
    console.log(this.threadArray[this.nextAvailThread].pid);
    
    
    this.threadArray[this.nextAvailThread].send(params);
    this.nextAvailThread++;
    if(this.nextAvailThread == this.totalNumThreads)
        this.nextAvailThread = 0;

};

Thread.prototype.close = function() {
    for(var i in this.threadArray) {
        this.threadArray[i].kill();
    }
};
    
exports = module.exports = Thread;