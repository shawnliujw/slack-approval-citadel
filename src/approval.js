const _ = require('lodash');
const utils = require('./utils');

const Approval = function(cacheKey, client, assignee) {
  this.assignee = assignee
    ? assignee.map(t => {
        const a = t.split('|');
        return {
          id: a[0],
          name: a[1]
        };
      })
    : [];
  this.approved = [];
  this.cacheKey = cacheKey;
  this.rejected = null;
  this.client = client;
  this.ex = 3600;
};

Approval.prototype._syncRead = async function() {
  const jsonstring = await this.client.get(this.cacheKey);
  if (!jsonstring) {
    return;
  }
  try {
    const json = JSON.parse(jsonstring);
    this.assignee = json.assignee;
    this.rejected = json.rejected;
    await this._approvedGet();
  } catch (e) {
    console.error(e);
  }
};
Approval.prototype._syncWrite = async function(init) {
  try {
    const json1 = {
      assignee: this.assignee,
      rejected: this.rejected
    };
    if (init) {
      const multi = this.client.multi();
      multi.del(`${this.cacheKey}_message`);
      multi.del(`${this.cacheKey}_approved`);
      await multi.exec();
    }
    await this.client.set(this.cacheKey, JSON.stringify(json1), 'ex', this.ex);
  } catch (e) {
    console.error(e);
  }
};

Approval.prototype._messagePush = async function(message) {
  if (!message) {
    return;
  }
  const key = `${this.cacheKey}_message`;
  const actions = this.approved.length + (this.rejected ? 1 : 0);
  await this.client.rpush(key, `${message} | progress: ${actions}/${this.assignee.length || 1}`);
  await this.client.expire(key, this.ex);
};
Approval.prototype._messagePop = async function() {
  const list = [];
  const key = `${this.cacheKey}_message`;
  let m = await this.client.lpop(key);
  do {
    if (!m) {
      break;
    }
    list.push(m);
    m = await this.client.lpop(key);
  } while (m);
  // while (true) {
  //   const key = `${this.cacheKey}_message`;
  //   const m = await this.client.lpop(key);
  //   if (!m) {
  //     break;
  //   }
  //   list.push(m);
  // }
  return list;
};
Approval.prototype._approvedPush = async function(obj) {
  if (!obj) {
    return obj;
  }
  const key = `${this.cacheKey}_approved`;
  await this.client.sadd(key, JSON.stringify(obj));
  this.approved.push(obj);
  await this.client.expire(key, this.ex);
};
Approval.prototype._approvedGet = async function() {
  const key = `${this.cacheKey}_approved`;
  const m = await this.client.smembers(key);
  const t1 = m.map(t => JSON.parse(t));
  this.approved = t1;
  return t1;
};

Approval.prototype.getResult = async function() {
  const list = await this._messagePop();
  const status = await this.isApproved();
  if (status.approved) {
    list.push(status.message);
  } else if (this.approved.length <= this.assignee.length && !this.rejected) {
    list.push(`Application is waiting approvals...... | progress: ${this.approved.length}/${this.assignee.length || 1} `);
  }
  return {
    message: list,
    approved: status.approved,
    rejected: !!this.rejected
  };
};

Approval.prototype.isApproved = async function() {
  await this._syncRead();
  const approved = this.approved.length !== 0 && this.approved.length >= this.assignee.length;
  return {
    approved,
    rejected: !!this.rejected,
    message: 'This application has all been proceed already'
  };
};

Approval.prototype._findAssignee = function(userId, username) {
  if (this.assignee.length) {
    const o = _.find(this.assignee, { id: userId });
    return {
      privilege: !!o,
      assignee: Object.assign(o, {
        name: o.name || username
      })
    };
  }
  return {
    privilege: true,
    assignee: {
      id: userId,
      name: username
    }
  };
};

Approval.prototype.approve = async function(userId, username) {
  await this._syncRead();
  const result = {
    message: '',
    success: false
  };
  if (this.rejected) {
    result.message = `<@${userId}> This application has been rejected by <@${this.rejected.name}> at ${this.rejected.date}`;
    return result;
  }
  const assigneePrivilege = this._findAssignee(userId, username);
  if (!assigneePrivilege.privilege) {
    // don't have privilege to approve
    result.message = `<@${userId}> Sorry, this application is not assigned to you , thanks for your action.`;
    await this._messagePush(`${assigneePrivilege.assignee.name} just tried to approve , but he(she) is not in the assignee list.`);
  } else {
    await this._approvedPush(assigneePrivilege.assignee);
    await this._messagePush(`${assigneePrivilege.assignee.name} approved the application at ${utils.nowString()}.`);
    result.message = `<@${userId}> approved the application at ${utils.nowString()}`;
    result.success = true;
  }
  return result;
};

Approval.prototype.reject = async function(userId, username) {
  await this._syncRead();
  const result = {
    message: '',
    success: false
  };
  if (this.rejected) {
    result.message = `<@${userId}> This application has been rejected by <@${this.rejected.name}> at ${this.rejected.date}`;
    return result;
  }
  const assigneePrivilege = this._findAssignee(userId, username);
  if (!assigneePrivilege.privilege) {
    // don't have privilege to approve
    result.message = `<@${userId}> Sorry, this application is not assigned to you , thanks for your action.`;
    await this._messagePush(`${assigneePrivilege.assignee.name} just tried to reject the application , but he(she) is not in the assignee list.`);
  } else {
    const s = utils.nowString();

    this.rejected = {
      id: userId,
      name: username,
      date: s
    };
    result.message = `<@${userId}> rejected the application at ${s}`;
    result.success = true;
    await this._messagePush(`${assigneePrivilege.assignee.name} rejected the application at ${s}.`);
    await this._syncWrite();
  }

  return result;
};

// Approval.prototype.exist = async function() {
//     //TODO check whether this key exist in redis
// }

module.exports = {
  fetch: async (key, init, assignee) => {
    const { redis } = global;
    if (!redis) {
      throw new Error('redis client not found');
    }
    if (!key) {
      throw new Error('key is required');
    }
    let t = await redis.get(key);
    if (init) {
      t = new Approval(key, redis, assignee);
      await t._syncWrite(true);
    }
    if (t && typeof t === 'string') {
      t = new Approval(key, redis);
      await t._syncRead();
    }
    return t;
  }
};
