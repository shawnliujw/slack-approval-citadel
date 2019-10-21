const moment = require('moment');
const dateFormat = 'YYYY-MM-DD HH:mm:ss';
module.exports = {
  nowString() {
    return moment().format(dateFormat);
  }
};
