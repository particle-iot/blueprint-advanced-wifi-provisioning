// Import the framework and instantiate it
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import Particle from "particle-api-js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
app.use(cors());
app.use(express.json());

const auth = process.env.PARTICLE_ACCESS_TOKEN;
if (!auth) {
  console.error("Missing PARTICLE_ACCESS_TOKEN");
  process.exit(1);
}

const particle = new Particle({
  baseUrl: "https://api.particle.io",
  clientId: "particle-cli",
  clientSecret: "particle-cli",
});

// Declare a route
app.post("/unprotect/:deviceId", async function handler(request, response) {
  const { deviceId } = request.params;
  const body = request.body || {};

  try {
    const result = await particle.unprotectDevice({
      deviceId,
      auth,
      ...body,
    });

    response.status(result.statusCode).json(result.body);
  } catch (err) {
    console.error("Error:", err);
    response.status(500).json({ error: err.message || err });
  }
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
