const app = require("../src/app");
const { connectToDatabase } = require("../src/lib/db");
const { seedDatabase } = require("../src/lib/data-store");

let readyPromise;

module.exports = async (req, res) => {
  if (!readyPromise) {
    readyPromise = connectToDatabase().then(() => seedDatabase());
  }

  await readyPromise;
  return app(req, res);
};
