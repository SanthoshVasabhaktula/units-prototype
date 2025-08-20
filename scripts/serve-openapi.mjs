#!/usr/bin/env node

import express from 'express';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = 8080;

// Serve static files
app.use(express.static(join(__dirname, '../')));

// Serve OpenAPI spec
app.get('/api-docs', (req, res) => {
  const openapiPath = join(__dirname, '../openapi.yaml');
  if (fs.existsSync(openapiPath)) {
    res.setHeader('Content-Type', 'text/yaml');
    res.send(fs.readFileSync(openapiPath, 'utf8'));
  } else {
    res.status(404).send('OpenAPI spec not found');
  }
});

// Serve Swagger UI
app.get('/', (req, res) => {
  const swaggerHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="description" content="Units Prototype ZK Proof System API Documentation" />
    <title>Units Prototype API - Swagger UI</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js" crossorigin></script>
    <script>
        window.onload = () => {
            window.ui = SwaggerUIBundle({
                url: '/api-docs',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout"
            });
        };
    </script>
</body>
</html>`;
  res.send(swaggerHtml);
});

app.listen(PORT, () => {
  console.log(`📚 OpenAPI Documentation Server running on http://localhost:${PORT}`);
  console.log(`📖 Swagger UI: http://localhost:${PORT}`);
  console.log(`📄 OpenAPI Spec: http://localhost:${PORT}/api-docs`);
  console.log(`\n💡 You can also import the openapi.yaml file into:`);
  console.log(`   - Postman`);
  console.log(`   - Insomnia`);
  console.log(`   - Any OpenAPI-compatible tool`);
});
