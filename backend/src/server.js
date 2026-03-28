const app = require("./app");
const { port } = require("./config");
const { connectToDatabase } = require("./lib/db");
const { seedDatabase } = require("./lib/data-store");

async function startServer() {
  const connection = await connectToDatabase();
  await seedDatabase();
  const dbName = connection.name || "unknown";
  console.log(`MongoDB connected to database: ${dbName}`);

  app.listen(port, () => {
    console.log(`Backend running on http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Failed to start backend:", error);
  process.exit(1);
});
