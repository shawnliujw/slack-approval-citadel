
const Approval = function(cacheKey,client,approvals) {
    this.approvals = approvals || 1;
    this.cacheKey = cacheKey;
    this.message = [];
    this.approvedCount = 0;
    this.rejected = false;
    this.client = client;
    this.ex = 3600;
}

Approval.prototype._syncRead = async function () {
    const jsonstring = await this.client.get(this.cacheKey);
    if(!jsonstring) {
        return;
    }
    try {
        const json = JSON.parse(jsonstring);
        this.message = json.message;
        this.approvedCount = json.approvedCount ? parseInt(json.approvedCount) : 0;
        this.approvals = json.approvals ? parseInt(json.approvals) : 1;
        this.rejected = json.rejected;
    }catch (e) {
        console.error(e);
    }

}
Approval.prototype._syncWrite = async function (ttl) {
    try {
        const json1 = {
            message: this.message,
            approvedCount: this.approvedCount,
            approvals: this.approvals,
            rejected: this.rejected
        }
        await this.client.set(this.cacheKey, JSON.stringify(json1), 'ex', ttl || this.ex);
    }catch (e) {
        console.error(e);
    }
}

Approval.prototype.getResult = async function() {
    await this._syncRead();
    const list = this.message.slice(0);
    const approved = this.approvals == this.approvedCount && this.approvedCount != 0;
    if(approved) {
        list.push(`Approval is approved.`);
    }else if(this.approvals != this.approvedCount && this.approvedCount == 0 && !this.rejected) {
        list.push(`Approval is waiting: progress (${this.approvedCount}/${this.approvals})`)
    }
    this.message = []
    if(approved) {
        // expire the approved result after 1 minute, means , same pipeline need approve again after 1 minute
        await this._syncWrite(60);
    } else {
        await this._syncWrite();
    }
    return {
        message: list,
        approved,
        rejected: this.rejected
    };
}

Approval.prototype.isApproved = function() {
    return this.approvals == this.approvedCount && this.approvedCount != 0;
}

Approval.prototype.approve = async function(msg)  {
    if(this.rejected) {
        return;
    }
    await this._syncRead();
    this.message.push(msg);
    this.approvedCount++;
    const approved = this.approvals == this.approvedCount && this.approvedCount != 0;
    if(approved) {
        console.log(`Approval '${this.cacheKey}' has been approved`);
    }
    await this._syncWrite();
}

Approval.prototype.reject = async function(msg) {
    await this._syncRead();
    this.message.push(msg);
    this.rejected = true;
    console.log(`Approval '${this.cacheKey}' has been rejected`);
    await this._syncWrite();
}

// Approval.prototype.exist = async function() {
//     //TODO check whether this key exist in redis
// }



exports.getCache = async (key, init, approvals) => {
    const {redis} = global;
    if(!redis) {
        throw new Error('redis client not found');
    }
    if(!key) {
        throw new Error('key is required');
    }
    let t = await redis.get(key);
    if(init) {
        t = new Approval(key,redis, approvals);
        await t._syncWrite();
    }
    if(t && typeof t === 'string') {
        t = new Approval(key,redis);
        await t._syncRead();
    }
    return t;
}
