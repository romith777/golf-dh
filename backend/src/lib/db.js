const mongoose = require("mongoose");
const { mongoUri } = require("../config");

async function connectToDatabase() {
  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  await mongoose.connect(mongoUri);
  return mongoose.connection;
}

module.exports = {
  connectToDatabase
};
