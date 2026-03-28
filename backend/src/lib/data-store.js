const seed = require("../data/seed");
const { Charity, User, Draw } = require("../models");

async function seedDatabase() {
  const [charityCount, userCount, drawCount] = await Promise.all([
    Charity.countDocuments(),
    User.countDocuments(),
    Draw.countDocuments()
  ]);

  if (charityCount === 0) {
    await Charity.insertMany(seed.charities);
  }

  if (userCount === 0) {
    await User.insertMany(seed.users);
  }

  if (drawCount === 0) {
    await Draw.insertMany(seed.draws);
  }
}

async function listCharities() {
  return Charity.find().sort({ featured: -1, name: 1 }).lean();
}

async function getCharity(id) {
  return Charity.findOne({ id }).lean();
}

async function saveCharity(charity) {
  await Charity.updateOne({ id: charity.id }, charity, { upsert: true });
  return getCharity(charity.id);
}

async function deleteCharity(id) {
  await Charity.deleteOne({ id });
}

async function listUsers() {
  return User.find().sort({ createdAt: -1 }).lean();
}

async function getUserById(id) {
  return User.findOne({ id }).lean();
}

async function getUserByEmail(email) {
  return User.findOne({ email: email.toLowerCase() }).lean();
}

async function saveUser(user) {
  const payload = { ...user, email: user.email.toLowerCase() };
  await User.updateOne({ id: payload.id }, payload, { upsert: true });
  return getUserById(payload.id);
}

async function listDraws() {
  return Draw.find().sort({ month: -1, createdAt: -1 }).lean();
}

async function saveDraw(draw) {
  await Draw.updateOne({ id: draw.id }, draw, { upsert: true });
  return Draw.findOne({ id: draw.id }).lean();
}

module.exports = {
  seedDatabase,
  listCharities,
  getCharity,
  saveCharity,
  deleteCharity,
  listUsers,
  getUserById,
  getUserByEmail,
  saveUser,
  listDraws,
  saveDraw
};
